const express = require("express");
const settingai = require("../config/settingai");

const router = express.Router();

/** GET /api/settings/keys — status tiap provider (true/false), TIDAK expose key asli */
router.get("/settings/keys", (req, res) => {
  res.json(settingai.getKeyStatus());
});

/** POST /api/settings/keys — body: { keys: { gemini: "...", groq: "...", ... } } */
router.post("/settings/keys", (req, res) => {
  const { keys } = req.body;
  if (!keys || typeof keys !== "object") {
    return res.status(400).json({ error: "Body 'keys' wajib berupa object." });
  }
  const allowed = {};
  settingai.PROVIDERS.forEach((p) => {
    if (keys[p]) allowed[p] = String(keys[p]).trim();
  });
  settingai.setApiKeys(allowed);
  res.json({ success: true, status: settingai.getKeyStatus() });
});

module.exports = router;
