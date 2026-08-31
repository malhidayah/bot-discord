const { EmbedBuilder } = require("discord.js");
const config = require("../config");
const { random } = require("./textHelper");

/**
 * Tentukan 2 user yang mau diuji jodohnya:
 * - 2+ mention        -> pakai 2 user pertama yang di-mention
 * - 1 mention / reply -> user itu dipasangkan dengan 1 user random lain
 *                        dari histori chat channel ini (BUKAN otomatis
 *                        sama pengirim command)
 * - selain itu        -> 2 user random dari histori chat channel ini
 *                        (tidak butuh Server Members Intent yang privileged)
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
    pool.delete(target.id); // jangan sampai dipasangin sama dirinya sendiri
    const candidates = [...pool.values()];
    if (!candidates.length) return null;
    return [target, random(candidates)];
  }

  const users = [...pool.values()];
  if (users.length < 2) return null;

  const a = random(users);
  let b = random(users);
  let guard = 0;
  while (b.id === a.id && guard++ < 10) b = random(users);
  if (b.id === a.id) return null;
  return [a, b];
}

function buildEmbed(userA, userB) {
  const percent = Math.floor(Math.random() * 101);
  const tier = config.MATCH_TIERS.find((t) => percent >= t.min) || config.MATCH_TIERS[config.MATCH_TIERS.length - 1];
  const filled = Math.round(percent / 10);
  const bar = "█".repeat(filled) + "░".repeat(10 - filled);

  return new EmbedBuilder()
    .setTitle("💘 Tes Jodoh")
    .setDescription(`**${userA.username}** ❤️ **${userB.username}**\n\n\`${bar}\` **${percent}%**\n\n${tier.text}`)
    .setColor(tier.color)
    .setThumbnail(userA.displayAvatarURL({ size: 256 }))
    .setImage(userB.displayAvatarURL({ size: 256 }));
}

module.exports = { pickPair, buildEmbed };
