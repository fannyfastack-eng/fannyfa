/* =========================================================
   config/settingai.js
   Tempat naruh & baca API key semua provider AI.
   Disimpan di data/keys.json (auto dibuat, JANGAN di-commit).

   Bisa juga diisi lewat file .env sebagai fallback awal:
   GEMINI_API_KEY=...
   GROQ_API_KEY=...
   OPENAI_API_KEY=...
   DEEPSEEK_API_KEY=...
   QWEN_API_KEY=...
========================================================= */

const fs = require("fs");
const path = require("path");

const KEYS_FILE = path.join(__dirname, "..", "data", "keys.json");

const PROVIDERS = ["gemini", "groq", "openai", "deepseek", "qwen"];

function ensureFile() {
  const dir = path.dirname(KEYS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(KEYS_FILE)) {
    fs.writeFileSync(KEYS_FILE, JSON.stringify({}, null, 2));
  }
}

function readKeysFile() {
  ensureFile();
  try {
    return JSON.parse(fs.readFileSync(KEYS_FILE, "utf-8"));
  } catch (e) {
    return {};
  }
}

function writeKeysFile(obj) {
  ensureFile();
  fs.writeFileSync(KEYS_FILE, JSON.stringify(obj, null, 2));
}

/** Ambil API key provider tertentu. Prioritas: keys.json lalu .env */
function getApiKey(provider) {
  const stored = readKeysFile();
  if (stored[provider]) return stored[provider];

  const envMap = {
    gemini: process.env.GEMINI_API_KEY,
    groq: process.env.GROQ_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    deepseek: process.env.DEEPSEEK_API_KEY,
    qwen: process.env.QWEN_API_KEY
  };

  return envMap[provider] || null;
}

/** Simpan / update banyak key sekaligus. keysObj: { provider: "key" } */
function setApiKeys(keysObj) {
  const current = readKeysFile();
  const merged = { ...current, ...keysObj };
  writeKeysFile(merged);
  return merged;
}

/** Status ringkas (true/false) tiap provider punya key atau nggak — TIDAK expose key aslinya */
function getKeyStatus() {
  const status = {};
  PROVIDERS.forEach((p) => {
    status[p] = Boolean(getApiKey(p));
  });
  return status;
}

module.exports = {
  PROVIDERS,
  getApiKey,
  setApiKeys,
  getKeyStatus
};
