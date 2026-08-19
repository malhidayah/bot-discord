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

// Groq pakai format API yang kompatibel dengan OpenAI (Chat Completions),
// jadi endpoint & body-nya mirip, cuma beda base URL, header auth, dan nama model.
function getGroqConfig() {
  const endpoint = (process.env.GROQ_API_ENDPOINT || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');
  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error('Groq belum dikonfigurasi. Set GROQ_API_KEY di .env.');
  return { endpoint, model, key };
}

async function askAI({ channelId, userId, prompt, context }) {
  const { endpoint, model, key } = getGroqConfig();
  const url = `${endpoint}/chat/completions`;

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

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.aiTimeout);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: config.aiMaxTokens,
        temperature: config.temperature,
        top_p: config.topP,
        frequency_penalty: 0.65,
        presence_penalty: 0.3,
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`Groq ${response.status}: ${await response.text()}`);
    const data = await response.json();
    return data?.choices?.[0]?.message?.content?.trim() || '';
  } finally {
    clearTimeout(timeout);
  }
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
