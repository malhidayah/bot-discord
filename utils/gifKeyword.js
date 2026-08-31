const config = require("../config");
const { searchGif } = require("./giphySearch");
const { random } = require("./textHelper");

// Cache regex biar tidak dibuild ulang setiap pesan masuk.
const compiled = Object.entries(config.GIF_KEYWORDS || {}).map(([pattern, value]) => ({
  regex: new RegExp(`\\b(?:${pattern})\\b`, "iu"),
  value,
}));

const lastSent = new Map(); // channelId -> timestamp, buat cooldown anti-spam

/**
 * Cek apakah teks mengandung salah satu kata kunci yang dikonfigurasi.
 * Kalau cocok, kembalikan URL GIF yang siap dikirim (atau null kalau tidak
 * ada GIF yang bisa didapat).
 */
async function getGifForMessage(channelId, text) {
  const match = compiled.find((entry) => entry.regex.test(text));
  if (!match) return null;

  const last = lastSent.get(channelId) || 0;
  if (Date.now() - last < config.gifCooldown) return null;

  let url = null;
  if (Array.isArray(match.value)) {
    url = random(match.value);
  } else if (typeof match.value === "string") {
    url = await searchGif(match.value);
  }

  if (url) lastSent.set(channelId, Date.now());
  return url;
}

module.exports = { getGifForMessage };
