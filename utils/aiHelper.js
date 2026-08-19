const { SYSTEM_PROMPT } = require('../prompts/systemPrompt');
const config = require('../config');
const memoryHelper = require('./memoryHelper');
const contextHelper = require('./contextHelper');
const { extractMedia } = require('./mediaHelper');
const { replaceMentionsWithTokens, resolveMentionTokens } = require('./textHelper');
const { searchGif } = require('./giphySearch');

// Inget subjek gambar terakhir yang dicari tiap user, biar pesan susulan
// pendek ("mana fotonya wo", "kirim lagi") bisa nyari ulang tanpa perlu
// user ngetik ulang subjeknya dari nol.
const lastImageSubject = new Map();
const IMAGE_SUBJECT_TTL = 10 * 60 * 1000; // 10 menit

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Berapa lama sebuah provider di-skip otomatis setelah gagal dengan cara
// tertentu, biar tiap chat baru nggak nyoba-nyoba ulang provider yang
// jelas-jelas lagi bermasalah (buang waktu response + spam log).
const COOLDOWN_MS = {
  payment: 6 * 60 * 60 * 1000, // 402 -> butuh isi billing manual, nggak akan pulih sendiri
  configError: 60 * 60 * 1000, // 404/400 -> kemungkinan nama model/env salah, butuh dicek manusia
  rateLimitDefault: 60 * 1000, // 429 tanpa info retry-after yang jelas
};
// Kalau provider kena rate limit dan waktu tunggunya pendek, mending nunggu
// sebentar lalu retry di provider yang sama daripada langsung lempar ke
// provider berikutnya (yang mungkin kualitasnya beda / juga limit).
const RATE_LIMIT_INLINE_RETRY_MAX_MS = 10 * 1000;

const providerCooldowns = new Map(); // providerName -> timestamp sampai kapan di-skip

function isOnCooldown(name) {
  const until = providerCooldowns.get(name);
  return Boolean(until && Date.now() < until);
}

function setCooldown(name, ms) {
  providerCooldowns.set(name, Date.now() + ms);
}

// Kalau OpenRouter bilang model default udah nggak gratis, kita simpen model
// pengganti di sini biar request-request SELANJUTNYA langsung pakai model
// itu duluan, nggak perlu kena 404 dulu tiap kali.
let openRouterModelOverride = null;

// Cache daftar model :free OpenRouter (yang beneran $0, dicek dari API-nya
// sendiri) biar nggak fetch ulang tiap kali ada 404.
let freeModelCache = { list: [], ts: 0 };
const FREE_MODEL_CACHE_TTL = 60 * 60 * 1000; // 1 jam

async function getOpenRouterFreeModels() {
  if (freeModelCache.list.length && Date.now() - freeModelCache.ts < FREE_MODEL_CACHE_TTL) {
    return freeModelCache.list;
  }
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (!res.ok) return freeModelCache.list;
    const data = await res.json();
    const list = (data?.data || [])
      .filter((m) => typeof m.id === 'string' && m.id.endsWith(':free'))
      .filter((m) => Number(m.pricing?.prompt || 0) === 0 && Number(m.pricing?.completion || 0) === 0)
      // Buang model non-chat (embedding/tts/asr/dll) yang nggak nyambung sama chat.completions
      .filter((m) => !/embed|rerank|tts|asr|whisper|stt|moderation/i.test(m.id))
      .map((m) => m.id);
    freeModelCache = { list, ts: Date.now() };
    return list;
  } catch (err) {
    console.error('[AI] Gagal ambil daftar model gratis OpenRouter:', err.message);
    return freeModelCache.list;
  }
}

// Ambil pesan/kode error dari response, format tiap provider agak beda
// (ada yang nested di "error", ada yang rata di root).
function extractRetryMs(body) {
  const msg = body?.error?.message || body?.message || '';
  const match = msg.match(/try again in ([\d.]+)s/i);
  if (!match) return null;
  return Math.ceil(parseFloat(match[1]) * 1000) + 500; // + buffer 0.5s
}

// Semua provider di bawah pakai format Chat Completions yang kompatibel
// OpenAI, jadi cuma beda base URL, cara kirim API key, dan nama model.
// Urutan array ini = urutan coba: Groq -> Google AI Studio -> OpenRouter ->
// NVIDIA NIM -> Cerebras. Semuanya gratis tanpa kartu debit/kredit KECUALI
// Cerebras, yang sekarang minta billing (lihat error 402 di log) — makanya
// ditaruh paling akhir, cuma dicoba kalau semua yang lain gagal/cooldown.
// Provider cuma masuk chain kalau env key-nya diisi; kalau nggak mau pakai
// salah satunya, tinggal jangan isi/hapus env var-nya.
function getProviderChain() {
  const providers = [];

  if (process.env.GROQ_API_KEY) {
    providers.push({
      name: 'Groq',
      endpoint: (process.env.GROQ_API_ENDPOINT || 'https://api.groq.com/openai/v1').replace(/\/+$/, ''),
      model: process.env.GROQ_MODEL || 'openai/gpt-oss-120b',
      key: process.env.GROQ_API_KEY,
      authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    });
  }

  // Google AI Studio (Gemini) — gratis tanpa kartu, tinggal login akun Google.
  // Lewat lapisan kompatibilitas OpenAI-nya jadi bisa dipakai format yang sama.
  if (process.env.GOOGLE_AI_API_KEY) {
    providers.push({
      name: 'Google AI Studio',
      endpoint: (process.env.GOOGLE_AI_API_ENDPOINT || 'https://generativelanguage.googleapis.com/v1beta/openai').replace(/\/+$/, ''),
      model: process.env.GOOGLE_AI_MODEL || 'gemini-2.5-flash',
      key: process.env.GOOGLE_AI_API_KEY,
      authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    });
  }

  if (process.env.OPENROUTER_API_KEY) {
    providers.push({
      name: 'OpenRouter',
      endpoint: (process.env.OPENROUTER_API_ENDPOINT || 'https://openrouter.ai/api/v1').replace(/\/+$/, ''),
      model: openRouterModelOverride || process.env.OPENROUTER_MODEL || 'nvidia/nemotron-3-ultra-550b-a55b:free',
      key: process.env.OPENROUTER_API_KEY,
      authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    });
  }

  // NVIDIA NIM — daftar di build.nvidia.com, gratis tanpa kartu, key diawali "nvapi-".
  // Cek model yang mau dipakai punya "Free Endpoint" di katalognya sebelum dipasang.
  if (process.env.NVIDIA_NIM_API_KEY) {
    providers.push({
      name: 'NVIDIA NIM',
      endpoint: (process.env.NVIDIA_NIM_API_ENDPOINT || 'https://integrate.api.nvidia.com/v1').replace(/\/+$/, ''),
      model: process.env.NVIDIA_NIM_MODEL || 'meta/llama-3.3-70b-instruct',
      key: process.env.NVIDIA_NIM_API_KEY,
      authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    });
  }

  if (process.env.CEREBRAS_API_KEY) {
    providers.push({
      name: 'Cerebras',
      endpoint: (process.env.CEREBRAS_API_ENDPOINT || 'https://api.cerebras.ai/v1').replace(/\/+$/, ''),
      model: process.env.CEREBRAS_MODEL || 'gpt-oss-120b',
      key: process.env.CEREBRAS_API_KEY,
      authHeader: (key) => ({ Authorization: `Bearer ${key}` }),
    });
  }

  if (!providers.length) {
    throw new Error('Belum ada provider AI yang dikonfigurasi. Set minimal GROQ_API_KEY di .env.');
  }

  return providers;
}

async function callProvider(provider, messages) {
  const url = `${provider.endpoint}/chat/completions`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.aiTimeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...provider.authHeader(provider.key),
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        max_tokens: config.aiMaxTokens,
        temperature: config.temperature,
        top_p: config.topP,
        frequency_penalty: 0.65,
        presence_penalty: 0.3,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const text = await response.text();
      let body = null;
      try { body = JSON.parse(text); } catch { /* balasan bukan JSON, biarin body null */ }

      const err = new Error(`${provider.name} ${response.status}: ${text}`);
      err.status = response.status;
      err.body = body;
      throw err;
    }

    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || '';
  } finally {
    clearTimeout(timeout);
  }
}

// Bungkus callProvider dengan retry yang "worth it" — dicoba inline (dalam
// request yang sama) daripada langsung nyerah ke provider berikutnya.
async function callProviderWithRetry(provider, messages) {
  try {
    return await callProvider(provider, messages);
  } catch (err) {
    // Rate limit sebentar -> nunggu lalu retry sekali di provider yang sama.
    if (err.status === 429) {
      const waitMs = extractRetryMs(err.body);
      if (waitMs && waitMs <= RATE_LIMIT_INLINE_RETRY_MAX_MS) {
        console.warn(`[AI] ${provider.name} kena rate limit, nunggu ${(waitMs / 1000).toFixed(1)}s lalu retry sekali.`);
        await sleep(waitMs);
        return await callProvider(provider, messages);
      }
    }

    // OpenRouter bilang model default udah nggak gratis -> cari model :free
    // lain yang beneran $0 (dicek dari API-nya sendiri, bukan tebak-tebakan)
    // dan retry sekali. Kalau berhasil, simpen jadi default buat request
    // selanjutnya biar nggak 404 lagi tiap chat.
    if (provider.name === 'OpenRouter' && err.status === 404) {
      const freeModels = await getOpenRouterFreeModels();
      const fallbackModel = freeModels.find((id) => id !== provider.model);
      if (fallbackModel) {
        console.warn(`[AI] Model OpenRouter "${provider.model}" kayaknya udah nggak gratis, nyoba model gratis lain: ${fallbackModel}`);
        const result = await callProvider({ ...provider, model: fallbackModel }, messages);
        openRouterModelOverride = fallbackModel;
        return result;
      }
    }

    throw err;
  }
}

async function askAI({ channelId, userId, prompt, context }) {
  const history = memoryHelper.getConversation(channelId, userId);
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }];

  if (context) messages.push({ role: 'system', content: context });

  if (history.length) {
    messages.push({
      role: 'system',
      content: `RIWAYAT PERCAKAPAN:\n${history.map((item) => `${item.role}: ${item.content}`).join('\n')}`,
    });
  }

  messages.push({ role: 'user', content: prompt });

  const providers = getProviderChain();
  let lastError;

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    const isLastOption = i === providers.length - 1;

    // Skip provider yang lagi cooldown (kecuali dia satu-satunya opsi yang
    // tersisa -- lebih baik tetap dicoba & dapet error asli daripada nggak
    // dicoba sama sekali).
    if (isOnCooldown(provider.name) && !isLastOption) {
      console.warn(`[AI] ${provider.name} lagi cooldown (billing/limit/config bermasalah), skip ke provider berikutnya.`);
      continue;
    }

    try {
      return await callProviderWithRetry(provider, messages);
    } catch (err) {
      lastError = err;
      console.error(`[AI] ${provider.name} gagal, coba provider berikutnya kalau ada:`, err.message);

      if (err.status === 402) {
        console.warn(`[AI] ${provider.name} butuh isi billing/kuota. Di-skip sementara ${COOLDOWN_MS.payment / 60000} menit biar nggak buang waktu tiap chat.`);
        setCooldown(provider.name, COOLDOWN_MS.payment);
      } else if (err.status === 429) {
        const waitMs = extractRetryMs(err.body) || COOLDOWN_MS.rateLimitDefault;
        setCooldown(provider.name, waitMs);
      } else if (err.status === 404 || err.status === 400) {
        setCooldown(provider.name, COOLDOWN_MS.configError);
      }
    }
  }

  throw lastError;
}

module.exports = {
  generateHumanReply: async (message, options = {}) => {
    const guildId = message.guild?.id || 'DM';
    const channelId = message.channel.id;
    const userId = message.author.id;

    let content = message.content || '';
    if (message.client.user) {
      content = content.replace(new RegExp(`<@!?${message.client.user.id}>`, 'g'), '').trim();
    }

    const targets = contextHelper.extractMentionTargets(message);
    content = replaceMentionsWithTokens(content, targets);

    const intent = contextHelper.detectIntent(content);
    const isFlirt = intent === 'flirt' || contextHelper.isFlirtRequest(content);

    // 1. BASE CONTEXT (Profil & Personality)
    let context = contextHelper.buildPersonalityContext(guildId, userId);
    context += `\n============================================================\nMODE\n============================================================\n${intent}\n`;

    // 2. PROFILE ANALYSIS (Avatar, Status Discord, Aktivitas)
    context += memoryHelper.getProfileAnalysis(message);

    // 3. FLIRT CONTEXT
    if (isFlirt) {
      context += contextHelper.buildFlirtContext(content, guildId, userId);
    }

    
    // 3b. QUOTE / KATA BIJAK CONTEXT
    if (intent === 'quote') {
      context += contextHelper.buildQuoteContext(content);
    }

    // 4. ROAST CONTEXT
    if (options.roast) {
      context += `\n============================================================\nROAST MODE\n============================================================\nLANGSUNG ROAST. Jangan bertanya. Jangan meminta bahan. Cari kebiasaan, gaya bicara, kalimat user, kontradiksi antara ucapan dan sikapnya. Manfaatkan data USER PERSONALITY CONTEXT di atas (kata yang sering dipakai, skor rough/playful/affectionate/flirty) sebagai bahan, jangan cuma andalkan status Discord/aktivitas — itu cuma satu opsi dari banyak, jangan dipakai berulang-ulang di roast yang beruntun. Buat SATU punchline paling tajam — jangan gabungin banyak lelucon lembek. Serang insecurity yang kelihatan dari chatnya. Akhiri di titik paling nyelekit, JANGAN ditutup nada manis/flirty/minta maaf — itu bikin roast kerasa dibungkus bubble wrap. Kalau user bales marah, itu artinya kena, lanjut roast makin dalam pakai reaksinya sebagai bahan baru, jangan mengalah.\n`;
    }

    // 4b. PENCARIAN GIF/GAMBAR NYATA (kalau user minta foto/gambar sesuatu)
    const stateKey = `${guildId}:${userId}`;
    let imageQuery = contextHelper.detectImageRequest(content);
    if (imageQuery) {
      lastImageSubject.set(stateKey, { subject: imageQuery, ts: Date.now() });
    } else if (contextHelper.isImageFollowup(content)) {
      const cached = lastImageSubject.get(stateKey);
      if (cached && Date.now() - cached.ts < IMAGE_SUBJECT_TTL) {
        imageQuery = cached.subject;
      }
    }
    if (imageQuery) {
      const foundUrl = await searchGif(imageQuery);
      if (foundUrl) {
        context += `\n============================================================\nGAMBAR/GIF DITEMUKAN\n============================================================\nUser minta foto/gambar "${imageQuery}". Hasil pencarian nyata: ${foundUrl}\nPAKAI URL INI PERSIS di format [MEDIA:${foundUrl}] di akhir balasanmu. JANGAN mengarang URL lain.\n`;
      } else {
        context += `\n============================================================\nGAMBAR TIDAK DITEMUKAN\n============================================================\nUser minta foto/gambar "${imageQuery}" tapi pencarian tidak menemukan hasil. JANGAN mengarang URL gambar apapun. Bilang jujur nggak nemu, dengan gaya santai.\n`;
      }
    } else {
      // 4c. GIF AKSI/EKSPRESI (tampar, peluk, kesel, marah, ketawa, dll)
      const actionQuery = contextHelper.detectActionRequest(content);
      if (actionQuery) {
        const foundUrl = await searchGif(actionQuery);
        if (foundUrl) {
          context += `\n============================================================\nGIF AKSI/EKSPRESI DITEMUKAN\n============================================================\nUser lagi mengekspresikan/minta aksi terkait "${actionQuery}". Hasil pencarian nyata: ${foundUrl}\nKalau memang pas dan natural, sertakan di akhir balasanmu pakai format [MEDIA:${foundUrl}]. Kalau targetnya jelas (ada yang di-mention), boleh sebut targetnya di teks balasan. JANGAN mengarang URL lain kalau nggak dipakai.\n`;
        }
      }
    }

    // 5. RELATIONSHIP / JODOH CONTEXT
    if (intent === 'jodoh' || intent === 'compare') {
      context += contextHelper.buildRelationshipContext(guildId, channelId, targets);
    }

    // 6. TARGET INFO (Jika ada yang di-mention)
    if (targets.length) {
      context += `\n============================================================\nTARGET INFORMATION\n============================================================\n`;
      for (const target of targets) {
        const facts = contextHelper.getUserFacts(guildId, target.id);
        context += `\nNama: ${target.name}\nPesan: ${facts.messages}\nKata: ${facts.topWords}\nRough: ${facts.rough}\nPlayful: ${facts.playful}\nAffectionate: ${facts.affectionate}\nFlirty: ${facts.flirty}\n`;
      }
    }

    // 7. RECENT CHAT
    const recent = memoryHelper.getRecentMessages(channelId, 30);
    if (recent.length) {
      context += `\n============================================================\nCHAT TERBARU\n============================================================\n${recent.map((item) => `${item.username}: ${item.content}`).join('\n')}\n`;
    }

    const prompt = `Pesan user:\n${content}\n\nJawab secara natural. Prioritas: pahami maksud user, jawab inti, gunakan konteks. Jika flirting buat rayuan personal. Jika user menggoda, counter-flirt. Jika roast buat punchline. Jangan bertele-tele. Jawab seperti chat Discord, bukan artikel.`;

    // KIRIM KE AI
    let rawResponse = await askAI({ channelId, userId, prompt, context });

    // BALIKIN MENTION USER
    rawResponse = resolveMentionTokens(rawResponse, targets);

    // PISAHKAN TEKS DAN URL GAMBAR/GIF
    return extractMedia(rawResponse);
  },
};
