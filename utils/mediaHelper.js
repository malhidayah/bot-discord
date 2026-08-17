const { cleanAIResponse } = require("./textHelper");

module.exports = {
  extractMedia: (text) => {
    const mediaRegex = /\[MEDIA:(https?:\/\/[^\s\]]+\.(?:png|jpg|jpeg|gif|webp))\]/i;
    const match = text.match(mediaRegex);

    if (match) {
      const url = match[1];
      const cleanText = text.replace(mediaRegex, "").trim();
      return {
        text: cleanAIResponse(cleanText),
        mediaUrl: url,
      };
    }
    return {
      text: cleanAIResponse(text),
      mediaUrl: null,
    };
  },
};
