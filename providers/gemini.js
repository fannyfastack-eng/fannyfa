/* =========================================================
   providers/gemini.js
   Google Gemini pakai format request/response beda dari OpenAI,
   jadi dipisah sendiri.
========================================================= */

/**
 * @param {string} apiKey
 * @param {string} model - contoh: gemini-2.0-flash
 * @param {Array} messages - [{role:'user'|'assistant', content:string}]
 */
async function sendChat(apiKey, model, messages) {
  if (!apiKey) throw new Error("API key Gemini belum di-set. Buka Settings.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini error (${res.status}): ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const reply = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n");
  if (!reply) throw new Error("Gemini tidak mengembalikan jawaban.");
  return reply;
}

module.exports = { sendChat };
