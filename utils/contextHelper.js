const memoryHelper = require('./memoryHelper');
const { normalize } = require('./textHelper');

function extractMentionTargets(message) {
  const targets = [];
  for (const [id, user] of message.mentions.users) {
    if (message.client.user && id === message.client.user.id) continue;
    const member = message.mentions.members?.get(id);
    targets.push({
      id,
      username: user.username,
      name: member?.displayName || user.globalName || user.username,
    });
  }
  return targets;
}

function detectIntent(text) {
  const t = normalize(text);
  if (/godain|gombal|rayu|flirt|flirting|genit|modus|romantis|baper/.test(t)) return 'flirt';
  if (/jodoh|cocok|serasi|pasangan|pacaran|soulmate|jadian/.test(t)) return 'jodoh';
  if (/lebih ganteng|lebih cantik|lebih lucu|lebih gemes|siapa yang lebih/.test(t)) return 'compare';
  if (/ganteng|cakep|good looking|keren/.test(t)) return 'ganteng';
  if (/cantik|ayu|manis|pretty/.test(t)) return 'cantik';
  if (/lucu|gemes|gemesin|imut|cute|menggemaskan|adorable/.test(t)) return 'gemes';
  if (/kuyang|siluman|hantu|setan|iblis|npc|alien|robot|mafia|dukun/.test(t)) return 'absurd';
  if (/siapa dia|siapakah dia|dia itu siapa|sebenarnya dia siapa/.test(t)) return 'identity';
  if (/aura|vibes|vibe/.test(t)) return 'aura';
  if (/kata kata|kata-kata|ucapan buat|pesan buat/.test(t)) return 'message';
  if (/^(apa itu|apa arti|siapa itu|siapa yang|kapan|kenapa|mengapa|berapa|dimana|di mana|gimana cara|bagaimana cara|jelaskan|sebutkan|apakah|jelasin|apa bedanya|apa perbedaan)\b/.test(t)) return 'knowledge';
  return 'chat';
}

function isFlirtRequest(text) {
  const t = normalize(text);
  return ['godain', 'gombal', 'gombalin', 'rayu', 'rayuan', 'flirt', 'flirting', 'genit', 'modus', 'bikin salting', 'bikin baper', 'pickup line', 'romantis'].some((p) => t.includes(p));
}

function detectFlirtMode(text) {
  const t = normalize(text);
  if (/mommy|tante|mama|bunda|ibu|kak|mbak|sis/.test(t)) return 'mature';
  if (/nakal|berani|liar|hot|panas|menggoda|genit banget/.test(t)) return 'naughty';
  if (/sayang|cinta|kangen|rindu|suka|jatuh hati|baper/.test(t)) return 'romantic';
  return 'playful';
}

function getUserFacts(guildId, userId) {
  const profile = memoryHelper.getUserProfile(guildId, userId);
  return {
    messages: profile.messages,
    topWords:
      Object.entries(profile.words)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([w, c]) => `${w} (${c}x)`)
        .join(', ') || '-',
    rough: profile.style.rough,
    playful: profile.style.playful,
    affectionate: profile.style.affectionate,
    flirty: profile.style.flirty,
    topInteractions: Object.entries(profile.interactions || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id]) => id),
  };
}

function detectImageRequest(text) {
  const t = normalize(text);
  const match = t.match(/(?:kirim(?:in)?|kasih|carikan|cariin|show|kirimkan)\s+(?:foto|gambar|pic|pict)\s+(.+)/i)
    || t.match(/(?:foto|gambar|pic|pict)\s+(.+?)\s+(?:dong|dund|donk)?$/i);
  if (!match) return null;
  const query = match[1].replace(/\b(dong|dund|donk|wo|woy|ya|nya)\b/gi, "").trim();
  return query.length >= 2 ? query : null;
}

module.exports = {
  extractMentionTargets,
  detectIntent,
  isFlirtRequest,
  detectFlirtMode,
  getUserFacts,
  detectImageRequest,

  buildPersonalityContext: (guildId, userId) => {
    const profile = getUserFacts(guildId, userId);
    const vocabulary = memoryHelper.getServerVocabulary(guildId);
    return `
============================================================
USER PERSONALITY CONTEXT
============================================================
Pesan tercatat: ${profile.messages}
Kata yang sering digunakan: ${profile.topWords}
Rough: ${profile.rough}
Playful: ${profile.playful}
Affectionate: ${profile.affectionate}
Flirty: ${profile.flirty}
Kosakata server: ${vocabulary || '-'}

Gunakan informasi ini secara natural. Jangan mengatakan statistik ini kepada user.
`;
  },

  buildFlirtContext: (text, guildId, userId) => {
    const mode = detectFlirtMode(text);
    const profile = getUserFacts(guildId, userId);
    let modeRules = '';

    switch (mode) {
      case 'mature':
        modeRules = `MODE MATURE: User meminta gaya mommy/tante/kak. Gunakan flirting confident, dewasa, elegan, teasing, sedikit nakal, tidak vulgar.`;
        break;
      case 'naughty':
        modeRules = `MODE NAUGHTY-LIGHT: Gunakan teasing, confidence, sedikit suggestive, playful. Jangan masuk ke deskripsi seksual eksplisit.`;
        break;
      case 'romantic':
        modeRules = `MODE ROMANTIC: Gunakan perhatian, warmth, chemistry, compliment spesifik, emotional intimacy. Hindari gombalan terlalu cheesy.`;
        break;
      default:
        modeRules = `MODE PLAYFUL: Gunakan gaya jahil, genit, teasing, confident, spontan.`;
    }

    return `
============================================================
FLIRT ENGINE
============================================================
MODE: ${mode}
USER MESSAGE: ${text}
USER STYLE: Rough: ${profile.rough}, Playful: ${profile.playful}, Affectionate: ${profile.affectionate}, Flirty: ${profile.flirty}

 ${modeRules}

ATURAN UTAMA FLIRTING:
1. Jangan memakai pickup line generik.
2. Ambil minimal satu detail dari pesan user kalau memungkinkan.
3. Jadikan detail tersebut bahan rayuan.
4. Kalau user menggoda bot, COUNTER-FLIRT.
5. Jangan menjadi romantis secara berlebihan kalau konteksnya tidak mendukung.
6. Boleh romantis, genit, teasing, nakal ringan. Jangan pornografi.
`;
  },

  buildRelationshipContext: (guildId, channelId, targets) => {
    if (targets.length < 2) return `\nDATA JODOH: Belum ada dua target yang jelas. Jangan mengarang pasangan.\n`;

    const [a, b] = targets;
    const factsA = getUserFacts(guildId, a.id);
    const factsB = getUserFacts(guildId, b.id);
    const log = memoryHelper.getRecentMessages(channelId, 50);
    const relevant = log.filter((item) => item.userId === a.id || item.userId === b.id);
    const interactionLines = relevant
      .slice(-35)
      .map((item) => `${item.username}: ${item.content}`)
      .join('\n');
    const aToB = factsA.topInteractions?.includes(b.id);
    const bToA = factsB.topInteractions?.includes(a.id);

    return `
============================================================
DATA JODOH
============================================================
TARGET A: ${a.name} (Pesan: ${factsA.messages}, Kata: ${factsA.topWords})
TARGET B: ${b.name} (Pesan: ${factsB.messages}, Kata: ${factsB.topWords})
A sering berinteraksi dengan B: ${aToB}
B sering berinteraksi dengan A: ${bToA}
CHAT RELEVAN: ${interactionLines || '(belum ada cukup data)'}

ATURAN:
- Jangan menyatakan mereka pacaran sebagai fakta.
- Gunakan data yang tersedia.
- Boleh membuat dugaan lucu dan memberi persentase sebagai hiburan.
`;
  },
};
