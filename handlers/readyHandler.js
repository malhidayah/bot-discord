const { ActivityType } = require("discord.js");
const config = require("../config");

module.exports = (client) => {
  console.log("========================================");
  console.log(`BOT ONLINE: ${client.user.tag}`);
  console.log(`SERVER: ${client.guilds.cache.size}`);
  console.log("GIF Keyword Engine: AKTIF");
  console.log("Fitur Jodoh: AKTIF");
  console.log("Fitur Kerang Ajaib: AKTIF");
  console.log("Custom Command: AKTIF");
  console.log("Fitur Ukuran Joni Random: AKTIF");
  console.log("Fitur Custom Prefix per Server: AKTIF");
  console.log("Voice Join & Stay: AKTIF");
  console.log("========================================");

  client.user.setActivity(`${config.prefix}help`, { type: ActivityType.Listening });
};
