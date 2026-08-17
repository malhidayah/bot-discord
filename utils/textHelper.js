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
  cleanAIResponse: (text) =>
    module.exports.truncate(
      String(text || "")
        .replace(/^```[\w-]*\s*/i, "")
        .replace(/```$/i, "")
        .trim()
    ),
  replaceMentionsWithTokens: (text, targets = []) => {
    let result = String(text || "");
    for (const target of targets) {
      result = result.replace(new RegExp(`<@!?${target.id}>`, "g"), `@${target.name}`);
    }
    return result;
  },
  resolveMentionTokens: (text, targets = []) => {
    let result = String(text || "");
    for (const target of targets) {
      const escaped = target.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      result = result.replace(new RegExp(`@${escaped}`, "g"), `<@${target.id}>`);
    }
    return result;
  },
};
