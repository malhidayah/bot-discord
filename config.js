require("dotenv").config();

module.exports = {
  prefix: process.env.PREFIX || "!",
  maxHistory: Number(process.env.MAX_HISTORY || 20),
  maxChannelLog: Number(process.env.MAX_CHANNEL_LOG || 100),
  maxVocabulary: Number(process.env.MAX_VOCABULARY || 200),
  aiMaxTokens: Number(process.env.AI_MAX_TOKENS || 450),
  temperature: Number(process.env.AI_TEMPERATURE || 0.95),
  topP: Number(process.env.AI_TOP_P || 0.95),
  aiTimeout: Number(process.env.AI_TIMEOUT || 45000),
  userCooldown: Number(process.env.USER_COOLDOWN || 1200),
  followupWindow: Number(process.env.FOLLOWUP_WINDOW || 120000),
  pantunWindow: Number(process.env.PANTUN_WINDOW || 90000),
  CALL_WORD_REGEX: /(?:^|\s)(?:wo+|wok|wo~+|woy+|oi+|bot|wowo|wowo~|bro|bang|min)(?=\s|$|[!?.,~])/iu,
};
