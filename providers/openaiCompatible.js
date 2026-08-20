/* =========================================================
   providers/openaiCompatible.js
   Dipakai buat semua provider yang API-nya mengikuti format
   OpenAI chat/completions: Groq, OpenAI (ChatGPT), DeepSeek, Qwen(DashScope compatible-mode)
========================================================= */

const ENDPOINTS = {
  openai: "https://api.openai.com/v1/chat/completions",
  groq: "https://api.groq.com/openai/v1/chat/completions",
  deepseek: "https://api.deepseek.com/chat/completions",
  qwen: "https://openrouter.ai/api/v1/chat/completions"
};

/**
 * @param {string} provider - openai | groq | deepseek | qwen
 * @param {string} apiKey
 * @param {string} model
 * @param {Array} messages - [{role:'user'|'assistant'|'system', content:string}]
 */
async function sendChat(provider, apiKey, model, messages) {
  const endpoint = ENDPOINTS[provider];
  if (!endpoint) throw new Error(`Provider tidak dikenal: ${provider}`);
  if (!apiKey) throw new Error(`API key untuk ${provider} belum di-set. Buka Settings.`);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`${provider} error (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) throw new Error(`${provider} tidak mengembalikan jawaban.`);
  return reply;
}

module.exports = { sendChat };
