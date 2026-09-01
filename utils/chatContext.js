// Nyimpen cuplikan chat terakhir per channel (in-memory, reset kalau bot restart).
// Dipakai supaya AI tau apa yang lagi dibahas banyak user di channel itu,
// bukan cuma pesan yang manggil bot doang.

const HISTORY_LIMIT = 20;       // jumlah pesan terakhir yang disimpan per channel
const MAX_MESSAGE_LENGTH = 300; // potong pesan kepanjangan biar hemat token

const history = new Map(); // channelId -> [{ username, content }]

function record(channelId, username, content) {
  if (!content) return;
  if (!history.has(channelId)) history.set(channelId, []);
  const arr = history.get(channelId);

  arr.push({
    username,
    content:
      content.length > MAX_MESSAGE_LENGTH
        ? content.slice(0, MAX_MESSAGE_LENGTH) + "..."
        : content,
  });

  if (arr.length > HISTORY_LIMIT) arr.shift();
}

function getTranscript(channelId) {
  const arr = history.get(channelId) || [];
  return arr.map((m) => `${m.username}: ${m.content}`).join("\n");
}

module.exports = { record, getTranscript };
