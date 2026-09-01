const { EmbedBuilder } = require("discord.js");
const { random } = require("./textHelper");

const TIERS = [
  { min: 95, color: 0xff1493, text: "💍 Ini udah bukan jodoh lagi, ini takdir. Nikah aja sekalian!" },
  { min: 85, color: 0xff69b4, text: "💘 Cocok parah, kayak dibuat khusus buat satu sama lain." },
  { min: 70, color: 0xff8fab, text: "❤️ Chemistry-nya kerasa banget nih, coba deket-deketin lagi." },
  { min: 55, color: 0xffb6c1, text: "🌸 Lumayan cocok, tinggal usaha dikit lagi." },
  { min: 40, color: 0xffd1dc, text: "🙂 Standar aja sih, temenan dulu juga gapapa." },
  { min: 25, color: 0xd3d3d3, text: "😅 Agak maksa, tapi masih ada harapan tipis." },
  { min: 10, color: 0xa9a9a9, text: "💀 Jauh banget bro, mending temenan aja selamanya." },
  { min: 0, color: 0x696969, text: "🪦 Nol besar, ini udah beda semesta kayaknya." },
];

/**
 * Tentukan 2 user yang mau diuji jodohnya:
 * - 2+ mention        -> pakai 2 user pertama yang di-mention
 * - 1 mention / reply -> user itu dipasangkan dengan 1 user random lain
 *                        dari histori chat channel ini
 * - selain itu        -> 2 user random dari histori chat channel ini
 */
async function pickPair(message) {
  const mentioned = [...message.mentions.users.values()].filter((u) => !u.bot);
  if (mentioned.length >= 2) return [mentioned[0], mentioned[1]];

  let target = null;
  if (mentioned.length === 1) {
    target = mentioned[0];
  } else if (message.mentions.repliedUser && !message.mentions.repliedUser.bot) {
    target = message.mentions.repliedUser;
  }

  const recent = await message.channel.messages.fetch({ limit: 50 }).catch(() => null);
  const pool = new Map();
  if (recent) {
    for (const msg of recent.values()) {
      if (!msg.author.bot) pool.set(msg.author.id, msg.author);
    }
  }
  pool.set(message.author.id, message.author);

  if (target) {
    pool.delete(target.id);
    const candidates = [...pool.values()];
    if (!candidates.length) return null;
    return [target, random(candidates)];
  }

  const users = [...pool.values()];
  if (users.length < 2) return null;

  const a = random(users);
  const remaining = users.filter((u) => u.id !== a.id);
  if (!remaining.length) return null;
  const b = random(remaining);

  return [a, b];
}

function buildEmbed(userA, userB) {
  const percent = Math.floor(Math.random() * 101);
  const tier = TIERS.find((t) => percent >= t.min) || TIERS[TIERS.length - 1];
  const filled = Math.round(percent / 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);

  return new EmbedBuilder()
    .setTitle("💘 Tes Jodoh")
    .setDescription(
      `**${userA.username}** ❤️ **${userB.username}**\n\n\`${bar}\` **${percent}%**\n\n${tier.text}`
    )
    .setColor(tier.color)
    .setThumbnail(userA.displayAvatarURL({ size: 256 }))
    .setImage(userB.displayAvatarURL({ size: 256 }));
}

module.exports = { pickPair, buildEmbed };
