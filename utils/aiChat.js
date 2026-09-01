const { GoogleGenAI } = require("@google/genai");
const chatContext = require("./chatContext");

// Otomatis baca API key dari environment variable GEMINI_API_KEY.
// JANGAN pernah taruh key-nya langsung di sini.
const ai = new GoogleGenAI({});

const MODEL = "gemini-3.5-flash-lite";

const PERSONA = `
Kamu adalah bot Discord yang nongkrong bareng anak-anak di server ini, BUKAN asisten AI formal.

ATURAN GAYA BICARA:
- Bahasa gaul Indonesia casual (gue-lo / aku-kamu, santai kayak temen chat), bukan bahasa baku kaku.
- LANGSUNG ke inti jawaban. Jangan muter-muter, jangan intro panjang, jangan nge-list kecuali user eksplisit minta.
- Maksimal 2-3 kalimat pendek. Kalau bisa dijawab 1 kalimat, jawab 1 kalimat aja.
- JANGAN PERNAH bilang "sebagai AI", "sebagai asisten", "saya adalah model bahasa", atau kalimat pembuka generic ala chatbot customer service. Jangan minta maaf berlebihan.
- Boleh nyeletuk/receh dikit sesuai vibe chat, tapi jangan jahat/nyakitin beneran.

KONTEKS:
Kamu dikasih cuplikan chat terbaru dari beberapa user di channel ini (format "username: pesan").
Pakai itu buat ngerti siapa lagi ngomong apa dan lagi bahas apa — TAPI fokus jawab cuma pesan yang ditandai [PESAN BARU] di paling bawah, dari user yang manggil kamu barusan. Jangan ikut nimbrung ke obrolan user lain yang gak manggil kamu.
`.trim();

/**
 * @param {{ channelId: string, username: string, message: string }} params
 * @returns {Promise<string|null>}
 */
async function reply({ channelId, username, message }) {
  const transcript = chatContext.getTranscript(channelId);

  const prompt = [
    transcript ? `--- Cuplikan chat terakhir di channel ini ---\n${transcript}` : "",
    `--- [PESAN BARU] ---`,
    `${username}: ${message}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const response = await ai.models.generateContent({
    model: MODEL,
    contents: prompt,
    config: {
      systemInstruction: PERSONA,
      maxOutputTokens: 150, // batasin panjang balasan biar hemat token & gak yapping
      temperature: 0.9,
    },
  });

  return response.text?.trim() || null;
}

module.exports = { reply };
