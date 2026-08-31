module.exports = {
  random: (array) => (array?.length ? array[Math.floor(Math.random() * array.length)] : ""),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  clamp: (num, min, max) => Math.max(min, Math.min(max, num)),
  normalize: (text) =>
    String(text || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s~]/gu, " ")
      .replace(/\s+/g, " ")
      .trim(),
  truncate: (text, max = 1900) => {
    text = String(text || "").trim();
    return text.length <= max ? text : text.slice(0, max - 3).trim() + "...";
  },
};
