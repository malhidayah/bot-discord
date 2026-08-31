const { EmbedBuilder } = require("discord.js");

function randomHandLength() {
  // Fitur fun/random: panjang tangan acak 1.00 - 40.00 cm.
  return (Math.random() * 39 + 1).toFixed(2);
}

/**
 * Tentukan target user:
 * - ada mention (bukan bot)      -> mention pertama
 * - reply ke pesan user (bukan bot) -> user yang di-reply
 * - selain itu                   -> pengirim command sendiri
 */
function pickTarget(message) {
  const mentioned = [...message.mentions.users.values()].filter((u) => !u.bot);
  if (mentioned.length >= 1) return mentioned[0];

  const repliedUser = message.mentions.repliedUser;
  if (repliedUser && !repliedUser.bot) return repliedUser;

  return message.author;
}

const TIERS = [
  { min: 30, label: "Melanggar Hukum Fisika 🚨", color: 0xe74c3c },
  { min: 20, label: "Pentungan Satpam 🚨", color: 0xe67e22 },
  { min: 10, label: "Standar ( SNI ) 👍", color: 0x2ecc71 },
  { min: 8, label: "Ucul 🤏", color: 0x3498db },
  { min: 0, label: "Masih Butuh Zoom 100x 🔍", color: 0x95a5a6 },
];

function buildEmbed(user) {
  const cm = randomHandLength();
  const value = Number(cm);
  const tier = TIERS.find((t) => value >= t.min);

  const filled = Math.min(10, Math.round((value / 40) * 10));
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);

  return new EmbedBuilder()
    .setTitle("🍆 Ukuran Joni")
    .setDescription(`Joni **${user.username}** berukuran **${cm} cm**.\n\`${bar}\``)
    .addFields(
      { name: "📏 Panjang", value: `${cm} cm`, inline: true },
      { name: "📐 Kategori", value: tier.label, inline: true }
    )
    .setColor(tier.color)
    .setThumbnail(user.displayAvatarURL({ size: 256 }))
    .setFooter({ text: "Hmmmmmmmmmm" });
}
module.exports = { randomHandLength, pickTarget, buildEmbed };
