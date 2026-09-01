const { InferenceClient } = require("@huggingface/inference");

const hf = new InferenceClient(process.env.HF_TOKEN);
const FALLBACK_MODEL = "zai-org/GLM-5.3-Flash:novita";

/**
 * @param {string} systemInstruction
 * @param {string} prompt
 * @param {string[]} imageUrls
 * @returns {Promise<string|null>}
 */
async function replyFallback(systemInstruction, prompt, imageUrls = []) {
  const content = [{ type: "text", text: prompt }];
  for (const url of imageUrls) {
    content.push({ type: "image_url", image_url: { url } });
  }

  const chatCompletion = await hf.chatCompletion({
    model: FALLBACK_MODEL,
    messages: [
      { role: "system", content: systemInstruction },
      { role: "user", content },
    ],
    max_tokens: 150,
    temperature: 0.9,
  });

  return chatCompletion.choices[0]?.message?.content?.trim() || null;
}

module.exports = { replyFallback };
