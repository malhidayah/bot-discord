const { ActivityType } = require("discord.js");

const statuses = [
  "nguping tongkrongan",
  "mengamati warga server",
  "menilai chemistry",
  "menunggu bahan roast",
  "mencari jodoh orang",
  "diam-diam memperhatikan",
];

module.exports = (client) => {
  console.log("========================================");
  console.log(`BOT ONLINE: ${client.user.tag}`);
  console.log(`SERVER: ${client.guilds.cache.size}`);
  console.log("Flirty Personality: AKTIF");
  console.log("Media/GIF Engine: AKTIF");
  console.log("========================================");

  const updateStatus = () => {
    client.user.setActivity(statuses[Math.floor(Math.random() * statuses.length)], {
      type: ActivityType.Watching,
    });
  };

  updateStatus();
  setInterval(updateStatus, 45000);
};
