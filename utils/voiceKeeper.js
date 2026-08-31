const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");

// Menandai guild yang memang lagi di-leave SENGAJA (lewat command !leave),
// supaya listener di bawah tahu: ini bukan disconnect tak terduga yang
// perlu di-reconnect, tapi memang permintaan keluar.
const intentionalLeave = new Set();

/**
 * Join ke voice channel dan pasang auto-reconnect supaya TIDAK PERNAH
 * keluar sendiri. Satu-satunya cara bot keluar adalah lewat leave()
 * di bawah (dipanggil dari command !leave).
 */
function joinAndStay(voiceChannel) {
  const { id: channelId, guild } = voiceChannel;

  const connection = joinVoiceChannel({
    channelId,
    guildId: guild.id,
    adapterCreator: guild.voiceAdapterCreator,
    selfDeaf: false,
  });

  intentionalLeave.delete(guild.id);

  connection.on(VoiceConnectionStatus.Disconnected, async () => {
    if (intentionalLeave.has(guild.id)) return; // memang lagi diminta keluar, jangan reconnect

    try {
      // Disconnect jenis ini biasanya cuma sementara (resume koneksi,
      // pindah voice region, dsb). Tunggu sebentar, biasanya otomatis pulih.
      await Promise.race([
        entersState(connection, VoiceConnectionStatus.Signalling, 5000),
        entersState(connection, VoiceConnectionStatus.Connecting, 5000),
      ]);
    } catch {
      // Bukan reconnect otomatis (mis. bot di-disconnect paksa dari Discord
      // client oleh seseorang) -> coba join ulang dari nol ke channel yang sama.
      try {
        const freshChannel = await guild.channels.fetch(channelId).catch(() => null);
        if (freshChannel) {
          joinAndStay(freshChannel);
        } else {
          connection.destroy();
        }
      } catch {
        connection.destroy();
      }
    }
  });

  return connection;
}

/** Keluar dari voice channel di suatu guild. Return false kalau memang tidak sedang connect. */
function leave(guildId) {
  const connection = getVoiceConnection(guildId);
  if (!connection) return false;
  intentionalLeave.add(guildId);
  connection.destroy();
  return true;
}

module.exports = { joinAndStay, leave, getVoiceConnection };
