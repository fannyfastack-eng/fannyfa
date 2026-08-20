const settingai = require("../config/settingai");
const gemini = require("./gemini");
const openaiCompatible = require("./openaiCompatible");

/**
 * @param {string} provider
 * @param {string} model
 * @param {Array} messages
 */
async function callProvider(provider, model, messages) {
  const apiKey = settingai.getApiKey(provider);

  if (provider === "gemini") {
    return gemini.sendChat(apiKey, model, messages);
  }

  if (["groq", "openai", "deepseek", "qwen"].includes(provider)) {
    return openaiCompatible.sendChat(provider, apiKey, model, messages);
  }

  throw new Error(`Provider "${provider}" tidak didukung.`);
}

module.exports = { callProvider };
