const config = require("../config");
const textHelper = require("../utils/textHelper");
const memoryHelper = require("../utils/memoryHelper");
const aiHelper = require("../utils/aiHelper");

const roastSessions = new Map();
const lastBotReply = new Map();
const lastInteraction = new Map();
const recentReplies = new Map(); // Simpan balasan terakhir agar tidak diulang

const SMALL_TALK = {
  wo: ["wo 😭", "wo, kenapa?", "iya, ada apa?", "iya gue denger."],
  wok: ["wok, kenapa?", "iya wok 😭", "apaan wok?"],
  wowo: ["iya, kenapa?", "wowo hadir.", "apaan 😭"],
  woo: ["woo 😭", "iya?", "kenapa woo?"],
  woy: ["woy 😭", "apaan woy?", "iya iya, kedengeran."],
  oi: ["oi.", "iya?", "kenapa?"],
  bot: ["iya, kenapa?", "hadir.", "apa nih?"],
  bro: ["iya bro?", "apaan bro?"],
  bang: ["iya bang?", "kenapa bang?"],
  min: ["iya min hadir 😭", "apaan?"],
};

// Fungsi cek duplikat
function isDuplicate(channelId, text) {
  const list = recentReplies.get(channelId) || [];
  return list.some(old => textHelper.normalize(old) === textHelper.normalize(text));
}

function saveReply(channelId, text) {
  if (!recentReplies.has(channelId)) recentReplies.set(channelId, []);
  const list = recentReplies.get(channelId);
  list.push(text);
  while (list.length > 5) list.shift(); // Simpan 5 balasan terakhir
}

module.exports = async (message) => {
  if (message.author.bot || !message.content.trim()) return;

  const content = message.content.trim();
  const guildId = message.guild?.id || "DM";
  const channelId = message.channel.id;
  const userId = message.author.id;
  const stateKey = `${channelId}:${userId}`;

  // COMMAND PREFIX
  if (content.startsWith(config.prefix)) {
    const args = content.slice(config.prefix.length).trim().split(/\s+/);
    const cmd = args.shift()?.toLowerCase();
    if (cmd === "help") return message.reply("Command tersedia: !help, !vocab, !forget");
    if (cmd === "vocab") return message.reply(`Kosakata server: ${memoryHelper.getServerVocabulary(guildId) || "kosong"}`);
    if (cmd === "forget") {
      memoryHelper.deleteUserProfile(guildId, userId);
      return message.reply("Profil gaya chat lu sudah gue hapus.");
    }
    return;
  }

  // SIMPAN MEMORY
  memoryHelper.learnMessage(guildId, userId, content);
  memoryHelper.addChannelLog(channelId, userId, message.member?.displayName || message.author.username, content);

  // CATAT INTERAKSI (mention & reply ke user lain)
  if (guildId !== "DM") {
    for (const [id, user] of message.mentions.users) {
      if (!user.bot && id !== userId) memoryHelper.recordInteraction(guildId, userId, id);
    }
  }

  // CEK PANGGILAN BOT
  const isMentioned = message.mentions.has(message.client.user.id);
  const isCalling = config.CALL_WORD_REGEX.test(content);
  
  let repliedToBot = false;
  if (message.reference) {
    try {
      const reference = await message.fetchReference();
      repliedToBot = reference?.author?.id === message.client.user?.id;
      if (guildId !== "DM" && reference?.author && !reference.author.bot && reference.author.id !== userId) {
        memoryHelper.recordInteraction(guildId, userId, reference.author.id);
      }
    } catch { repliedToBot = false; }
  }

  const lastReply = lastBotReply.get(stateKey);
  const followUp = lastReply && Date.now() - lastReply < config.followupWindow;

  // CEK ROAST
  const directRoast = /roast|roasting|ledekin|ledek|ejek|gas roast/i.test(content);
  const escalation = /lagi|kurang pedes|lebih pedes|gas|hajar|habisin|brutal/i.test(content);
  const activeRoast = roastSessions.has(stateKey);
  const roast = directRoast || (escalation && activeRoast);
  if (roast) roastSessions.set(stateKey, Date.now());
  if (!roast && !escalation) roastSessions.delete(stateKey);

  const flirt = /godain|gombal|rayu|flirt/i.test(content);

  const shouldRespond = isMentioned || repliedToBot || isCalling || followUp || roast || flirt;
  if (!shouldRespond) return;

  // COOLDOWN
  const lastTime = lastInteraction.get(stateKey) || 0;
  if (Date.now() - lastTime < config.userCooldown && !roast) return;
  lastInteraction.set(stateKey, Date.now());

  // SIMPLE CALL (Wo, Woy, dll)
  if (!roast && !flirt) {
    const t = textHelper.normalize(content).replace(/~+/g, "");
    if (SMALL_TALK[t]) {
      let smallReply = textHelper.random(SMALL_TALK[t]);
      // Cek duplikat untuk small talk
      let attempts = 0;
      while (isDuplicate(channelId, smallReply) && attempts < 2) {
        smallReply = textHelper.random(SMALL_TALK[t]);
        attempts++;
      }
      saveReply(channelId, smallReply);
      await message.reply(smallReply);
      return;
    }
  }

  // TYPING INDICATOR
  await message.channel.sendTyping();
  await textHelper.sleep(textHelper.clamp(180 + content.length * 6, 180, 850));

  // REQUEST KE AI
  try {
    let result = await aiHelper.generateHumanReply(message, { roast });
    
    // PROTEKSI DUPLIKAT UNTUK AI
    let attempts = 0;
    while (isDuplicate(channelId, result.text) && attempts < 2) {
      result = await aiHelper.generateHumanReply(message, { roast });
      attempts++;
    }

    if (!result.text && !result.mediaUrl) result.text = "iya, kenapa?";

    saveReply(channelId, result.text);

    const replyOptions = {
      content: textHelper.truncate(result.text),
      allowedMentions: { parse: ["users"], repliedUser: true },
    };

    if (result.mediaUrl) {
      replyOptions.embeds = [{ image: { url: result.mediaUrl } }];
    }

    memoryHelper.addConversation(channelId, userId, "user", content);
    memoryHelper.addConversation(channelId, userId, "assistant", result.text);

    lastBotReply.set(stateKey, Date.now());
    await message.reply(replyOptions);
  } catch (error) {
    console.error("[AI ERROR]", error);
    await message.reply("otak gue lagi loading bentar 😭");
  }
};