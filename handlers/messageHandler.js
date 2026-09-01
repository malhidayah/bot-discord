const config = require("../config");
const prefixManager = require("../utils/prefix");
const textHelper = require("../utils/textHelper");
const { getGifForMessage } = require("../utils/gifKeyword");
const voiceKeeper = require("../utils/voiceKeeper");
const jodoh = require("../utils/jodoh");
const customCommands = require("../utils/customCommands");
const Joni = require("../utils/joni");
const chatContext = require("../utils/chatContext");
const aiChat = require("../utils/aiChat");

const lastInteraction = new Map(); // stateKey -> timestamp, buat cooldown sapaan

// Balasan sapaan singkat & ramah, tanpa basa-basi.
const SMALL_TALK = {
  wo: ["Iya, ada apa?", "Ya, gue di sini."],
  wok: ["Iya, kenapa?", "Ada apa?"],
  wowo: ["Iya, kenapa?", "Gue di sini."],
  woo: ["Iya?", "Ada apa?"],
  woy: ["Iya, kedengeran.", "Ada apa?"],
  oi: ["Iya?", "Ada apa?"],
  bot: ["Iya, kenapa?", "Ada yang bisa gue bantu?"],
  bro: ["Iya bro, ada apa?"],
  bang: ["Iya bang, kenapa?"],
  min: ["Iya, ada apa?"],
};

// Daftar command yang dikenal (termasuk alias Bahasa Indonesia).
// Dipakai supaya prefix pendek seperti "wo" TIDAK bentrok dengan kata sapaan
// yang juga diawali "wo" (wo, woy, wowo, dst). Kalau kata setelah prefix
// bukan salah satu di bawah, pesan dianggap chat biasa, bukan command.
const COMMAND_ALIASES = {
  help: "help",
  bantuan: "help",

  join: "join",
  masuk: "join",
  gabung: "join",
  sini: "join",

  leave: "leave",
  keluar: "leave",
  cabut: "leave",
  pergi: "leave",

  jodoh: "jodoh",
  cocok: "jodoh",
  match: "jodoh",

  kerang: "kerang",
  conch: "kerang",
  tanya: "kerang",
  joni: "joni",
  ujon: "joni",
  prefix: "prefix",
  custom: "custom",
  cc: "custom",
};

function isDirectedAtBot(message) {
  const isMentioned = message.mentions.has(message.client.user.id);
  const isCalling = config.CALL_WORD_REGEX.test(message.content);
  return isMentioned || isCalling;
}

async function JonileCommand(message, cmd, args) {
  const prefix = prefixManager.get(message.guild?.id);
  switch (cmd) {
    case "help": {
      return message.reply(
        [
          "**Command yang tersedia:**",
          `\`${prefix}join\` (alias: masuk, gabung) — bot join ke voice channel kamu & bakal stay terus`,
          `\`${prefix}leave\` (alias: keluar, cabut) — satu-satunya cara bikin bot keluar dari voice channel`,
          `\`${prefix}jodoh [@user]\` (alias: cocok, match) — tes jodoh random + foto profil. Mention/reply 1 user buat dipasangin sama orang random, mention 2 buat tes berdua, tanpa target buat random semua`,
          `\`${prefix}kerang <pertanyaan>\` (alias: conch, tanya) — tanya ke kerang ajaib`,
          `\`${prefix}joni [@user]\` (alias: ujon) — ukuran Joni random maksimal 40 cm. Mention/reply user lain buat target dia, kalau nggak ada ya diri sendiri`,
          `\`${prefix}prefix ?\` — ubah prefix server (Manage Server)`,
          "",
          "Selain command, ketik kata-kata tertentu (wkwk, sedih, rizz, delulu, dst) di chat manapun dan bot bakal otomatis kirim GIF yang cocok.",
        ].join("\n")
      );
    }

    case "join": {
      const voiceChannel = message.member?.voice?.channel;
      if (!voiceChannel) return message.reply("Masuk voice channel dulu, baru gue samperin.");

      const existing = voiceKeeper.getVoiceConnection(message.guild.id);
      if (existing) {
        if (existing.joinConfig.channelId === voiceChannel.id) {
          return message.reply("Gue udah di situ kok.");
        }
        existing.destroy();
      }

      voiceKeeper.joinAndStay(voiceChannel);
      return message.reply(
        `Oke, gue masuk ke **${voiceChannel.name}** dan bakal STAY terus di situ. Kalau mau gue keluar, pakai \`${prefix}leave\`.`
      );
    }

    case "leave": {
      const ok = voiceKeeper.leave(message.guild.id);
      return message.reply(ok ? "Oke, gue keluar dari voice channel." : "Lah, gue kan nggak lagi di voice channel manapun.");
    }

    case "jodoh": {
      const pair = await jodoh.pickPair(message);
      if (!pair) {
        return message.reply(
          `Nggak nemu pasangan buat dites. Mention 2 user sekalian, contoh: \`${prefix}jodoh @A @B\`, atau mention/reply 1 user buat dipasangin sama orang random.`
        );
      }
      const [userA, userB] = pair;
      return message.channel.send({ embeds: [jodoh.buildEmbed(userA, userB)] });
    }

    case "kerang": {
      const question = args.join(" ").trim();
      if (!question) return message.reply(`Tanya sesuatu dong. Contoh: \`${prefix}kerang apakah aku akan kaya?\``);
      const answer = textHelper.random(config.KERANG_ANSWERS);
      return message.reply(`🐚 **Kerang Ajaib berkata:** ${answer}`);
    }

    case "joni": {
      const target = Joni.pickTarget(message);
      return message.channel.send({ embeds: [Joni.buildEmbed(target)] });
    }

    case "prefix": {
      if (!message.guild) return message.reply("Prefix hanya bisa diubah di server.");
      const sub = (args.shift() || "").toLowerCase();

      if (!sub || sub === "help") {
        return message.reply([
          `**Pengaturan Prefix**`,
          `\`${prefix}prefix <prefix-baru>\` — ubah prefix server`,
          `\`${prefix}prefix reset\` — kembalikan ke prefix default \`${prefixManager.DEFAULT_PREFIX}\``,
          `Contoh: \`${prefix}prefix ?\``,
          `Setelah diubah, gunakan \`?help\`, \`?Joni\`, dst.`
        ].join("\n"));
      }

      if (!message.member.permissions.has("ManageGuild")) {
        return message.reply("Kamu perlu permission **Manage Server** untuk mengubah prefix.");
      }

      if (sub === "reset") {
        const newPrefix = prefixManager.reset(message.guild.id);
        return message.reply(`✅ Prefix server dikembalikan ke \`${newPrefix}\`.`);
      }

      const result = prefixManager.set(message.guild.id, args.join(" "));
      if (!result.ok) return message.reply(`❌ ${result.error}`);
      return message.reply(`✅ Prefix server diubah menjadi \`${result.prefix}\`.`);
    }

    case "custom": {
      if (!message.guild) return message.reply("Custom command hanya bisa dibuat di server.");
      const sub = (args.shift() || "").toLowerCase();

      if (sub === "help" || !sub) {
        return message.reply([
          `**Custom Command**`,
          `\`${prefix}custom add nama | balasan\` — buat/update command`,
          `\`${prefix}custom del nama\` — hapus command`,
          `\`${prefix}custom list\` — lihat command custom`,
          `Contoh: \`${prefix}custom add halo | Halo juga, {user}! 👋\``,
          "",
          "Custom command bisa dipanggil dengan prefix seperti command biasa.",
          "Placeholder yang tersedia: `{user}`, `{mention}`."
        ].join("\n"));
      }

      if (!message.member.permissions.has("ManageGuild")) {
        return message.reply("Kamu perlu permission **Manage Server** untuk mengatur custom command.");
      }

      if (sub === "add" || sub === "set") {
        const raw = args.join(" ");
        const separator = raw.indexOf("|");
        if (separator === -1) {
          return message.reply(`Format: \`${prefix}custom add nama | balasan\``);
        }

        const name = raw.slice(0, separator).trim();
        const response = raw.slice(separator + 1).trim();
        const result = customCommands.add(message.guild.id, name, response);
        if (!result.ok) return message.reply(`❌ ${result.error}`);

        return message.reply(
          `${result.updated ? "♻️ Custom command diupdate" : "✅ Custom command dibuat"}: ` +
          `\`${prefix}${name.toLowerCase()}\``
        );
      }

      if (sub === "del" || sub === "delete" || sub === "hapus") {
        const name = args[0];
        if (!name) return message.reply(`Format: \`${prefix}custom del nama\``);
        const ok = customCommands.remove(message.guild.id, name);
        return message.reply(ok ? `🗑️ Custom command \`${name.toLowerCase()}\` dihapus.` : "❌ Command itu tidak ditemukan.");
      }

      if (sub === "list" || sub === "daftar") {
        const names = customCommands.list(message.guild.id);
        if (!names.length) return message.reply("Belum ada custom command di server ini.");
        return message.reply(
          `**Custom command (${names.length}/${customCommands.MAX_COMMANDS_PER_GUILD}):**\n` +
          names.map((name) => `• \`${prefix}${name}\``).join("\n")
        );
      }

      return message.reply(`Subcommand tidak dikenal. Pakai \`${prefix}custom help\`.`);
    }

    default:
      return; // command tidak dikenal, diamkan saja
  }
}

module.exports = async (message) => {
  if (message.author.bot || !message.content.trim()) return;

  const content = message.content.trim();
  const prefix = prefixManager.get(message.guild?.id);
  const channelId = message.channel.id;
  const userId = message.author.id;
  const stateKey = `${channelId}:${userId}`;
  const displayName = message.member?.displayName || message.author.username;

  // Rekam SEMUA pesan (bukan cuma yang manggil bot) ke context per-channel,
  // supaya AI "tau" lagi rame ngobrolin apa di channel ini kalau nanti dipanggil.
  chatContext.record(channelId, displayName, content);

  // COMMAND PREFIX
  // Command HANYA dianggap valid kalau kata sesudah prefix memang nama
  // command yang dikenal (lihat COMMAND_ALIASES). Kalau tidak cocok,
  // lanjut diproses sebagai chat biasa (GIF keyword & sapaan) di bawah.
  if (content.toLowerCase().startsWith(prefix.toLowerCase())) {
    const rest = content.slice(prefix.length).trim();
    const args = rest.split(/\s+/).filter(Boolean);
    const rawCmd = args.shift()?.toLowerCase();
    const cmd = rawCmd ? COMMAND_ALIASES[rawCmd] : null;

    if (cmd) {
      try {
        return await JonileCommand(message, cmd, args);
      } catch (err) {
        console.error("[COMMAND ERROR]", err);
        return message.reply("Ada error pas menjalankan command itu.");
      }
    }
    // rawCmd tidak dikenal sebagai command -> cek custom command.
    if (rawCmd && message.guild) {
      const custom = customCommands.get(message.guild.id, rawCmd);
      if (custom) {
        const response = custom
          .replace(/\{user\}/gi, message.author.username)
          .replace(/\{mention\}/gi, `<@${message.author.id}>`);
        return message.reply({
          content: textHelper.truncate(response, customCommands.MAX_RESPONSE_LENGTH),
          allowedMentions: { parse: [] },
        });
      }
    }
  }

  // GIF OTOMATIS BERDASARKAN KATA KUNCI (berlaku untuk semua pesan, bukan cuma yang manggil bot)
  try {
    const gifUrl = await getGifForMessage(channelId, content);
    if (gifUrl) {
      await message.reply({ embeds: [{ image: { url: gifUrl } }] });
    }
  } catch (err) {
    console.error("[GIF KEYWORD ERROR]", err);
  }

  // SAPAAN SINGKAT KETIKA BOT DIPANGGIL
  if (!isDirectedAtBot(message)) return;

  const lastTime = lastInteraction.get(stateKey) || 0;
  if (Date.now() - lastTime < config.userCooldown) return;
  lastInteraction.set(stateKey, Date.now());

  const normalized = textHelper.normalize(content).replace(/~+/g, "");

  // Sapaan pendek doang (wo, bro, dst) -> balasan kilat, TANPA manggil AI (hemat token).
  if (SMALL_TALK[normalized]) {
    return message.reply(textHelper.random(SMALL_TALK[normalized]));
  }

  // Dipanggil dengan isi pesan beneran -> baru lempar ke AI, pakai konteks chat terakhir.
  try {
    const aiReply = await aiChat.reply({
      channelId,
      username: displayName,
      message: content,
    });
    if (aiReply) {
      return message.reply(textHelper.truncate(aiReply, 1900));
    }
  } catch (err) {
    console.error("[AI CHAT ERROR]", err);
  }

  return message.reply(textHelper.random(["Hmm, gue lagi bingung nih.", "Coba tanya lagi deh, tadi gak nangkep."]));
};
