const fs = require("fs");
const path = require("path");
const { normalize } = require("./textHelper");

const DATA_DIR = path.join(__dirname, "..", "data");
const MEMORY_FILE = path.join(DATA_DIR, "memory.json");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

let database = { servers: {}, users: {} };
const conversations = new Map();
const channelLogs = new Map();

function loadDatabase() {
  try {
    if (fs.existsSync(MEMORY_FILE)) {
      database = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
    }
  } catch (e) {
    console.error("[DB LOAD ERROR]", e);
  }
}

function saveDatabase() {
  try {
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(database, null, 2), "utf8");
  } catch (e) {
    console.error("[DB SAVE ERROR]", e);
  }
}

loadDatabase();

function getProfileAnalysis(message) {
  const member = message.member;
  const user = message.author;
  const activities = member?.presence?.activities || [];
  const status = member?.presence?.status || "offline";

  let activityString =
    activities
      .map((a) => {
        if (a.type === "PLAYING") return `Main ${a.name}`;
        if (a.type === "LISTENING") return `Dengerin ${a.details || a.name}`;
        if (a.type === "STREAMING") return `Streaming ${a.name}`;
        if (a.type === "CUSTOM") return `Custom Status: ${a.state || a.name}`;
        return a.name;
      })
      .join(", ") || "Tidak ada aktivitas";

  return `
ANALISA PROFIL USER SAAT INI:
- Avatar URL: ${user.displayAvatarURL({ extension: "png", size: 512 })}
- Status Discord: ${status}
- Aktivitas: ${activityString}
- Warna Role Utama: ${member?.displayHexColor || "Tidak ada"}
- Bergabung Server: ${member?.joinedAt.toDateString()}
- Akun Dibuat: ${user.createdAt.toDateString()}
`;
}

const STOP_WORDS = new Set(["yang", "dan", "atau", "dari", "untuk", "dengan", "kalau", "kalo", "ini", "itu", "aku", "saya", "kamu", "dia", "mereka", "kita", "lu", "lo", "gue", "gw", "nya", "aja", "juga", "sih", "lah", "kan", "apa", "ada", "tidak", "nggak", "ngga", "gak", "ga", "udah", "sudah", "lagi", "bisa", "mau", "jadi", "buat", "sama", "seperti", "kayak", "karena", "terus", "banget", "cuma", "dong", "deh", "nih", "tuh", "pada", "dalam", "ke", "di"]);

const STYLE_PATTERNS = {
  rough: /anjing|anjir|goblok|tolol|bego|bangsat|jancok|asu|kampret|sialan|kntl|kontol|tai|bacot|njir|astaga|gila lu|geblek/i,
  playful: /wkwk|wkwkwk|xixi|haha|hehe|awokwok|ngakak|lol|becanda|just kidding|receh|gokil/i,
  affectionate: /sayang|kangen|rindu|peluk|makasih|thank you|thanks|baik banget|perhatian|care sama/i,
  flirty: /godain|gombal|rayu|cakep|ganteng|cantik|manis banget|baper|deg.?degan|jatuh cinta|suka sama (lo|lu|kamu)|crush/i,
};

function learnMessage(guildId, userId, text) {
  const key = `${guildId}:${userId}`;
  if (!database.users[key]) {
    database.users[key] = { messages: 0, words: {}, style: { rough: 0, playful: 0, affectionate: 0, flirty: 0 }, interactions: {}, lastSeen: 0 };
  }
  const profile = database.users[key];
  profile.messages++;
  profile.lastSeen = Date.now();

  if (!profile.style) profile.style = { rough: 0, playful: 0, affectionate: 0, flirty: 0 };
  for (const [trait, pattern] of Object.entries(STYLE_PATTERNS)) {
    if (pattern.test(text)) profile.style[trait] = (profile.style[trait] || 0) + 1;
  }

  if (!database.servers[guildId]) database.servers[guildId] = { vocabulary: {} };
  const server = database.servers[guildId];

  const words = normalize(text).split(" ").filter((w) => w.length >= 3 && w.length <= 20 && !STOP_WORDS.has(w));
  for (const word of words) {
    profile.words[word] = (profile.words[word] || 0) + 1;
    server.vocabulary[word] = (server.vocabulary[word] || 0) + 1;
  }
  saveDatabase();
}

function recordInteraction(guildId, userId, targetId) {
  if (!targetId || targetId === userId) return;
  const key = `${guildId}:${userId}`;
  if (!database.users[key]) {
    database.users[key] = { messages: 0, words: {}, style: { rough: 0, playful: 0, affectionate: 0, flirty: 0 }, interactions: {}, lastSeen: 0 };
  }
  const profile = database.users[key];
  if (!profile.interactions) profile.interactions = {};
  profile.interactions[targetId] = (profile.interactions[targetId] || 0) + 1;
  saveDatabase();
}

function deleteUserProfile(guildId, userId) {
  const key = `${guildId}:${userId}`;
  delete database.users[key];
  saveDatabase();
}

module.exports = {
  getProfileAnalysis,
  learnMessage,
  deleteUserProfile,
  recordInteraction,
  getUserProfile: (guildId, userId) => {
    const key = `${guildId}:${userId}`;
    return database.users[key] || { messages: 0, words: {}, style: { rough: 0, playful: 0, affectionate: 0, flirty: 0 }, interactions: {}, lastSeen: 0 };
  },
  getServerVocabulary: (guildId) => Object.entries(database.servers[guildId]?.vocabulary || {}).sort((a, b) => b[1] - a[1]).slice(0, 40).map(([w, c]) => `${w} (${c}x)`).join(", "),
  addChannelLog: (channelId, userId, username, content) => {
    if (!channelLogs.has(channelId)) channelLogs.set(channelId, []);
    const log = channelLogs.get(channelId);
    log.push({ userId, username, content: content.slice(0, 1000), timestamp: Date.now() });
    while (log.length > 100) log.shift();
  },
  getRecentMessages: (channelId, limit = 30) => {
    const log = channelLogs.get(channelId) || [];
    return log.slice(-limit);
  },
  getConversation: (channelId, userId) => {
    const key = `${channelId}:${userId}`;
    if (!conversations.has(key)) conversations.set(key, []);
    return conversations.get(key);
  },
  addConversation: (channelId, userId, role, content) => {
    const history = module.exports.getConversation(channelId, userId);
    history.push({ role, content: content.slice(0, 1200) });
    while (history.length > 20) history.shift();
  },
};
