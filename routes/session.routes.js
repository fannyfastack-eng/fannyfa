const express = require("express");
const store = require("../config/sessionStore");

const router = express.Router();

/** GET /api/sessions/:deviceId — daftar sesi milik satu device */
router.get("/sessions/:deviceId", (req, res) => {
  const sessions = store.listSessionsByDevice(req.params.deviceId);
  res.json({ sessions });
});

/** GET /api/session/:sessionId — ambil semua pesan dalam satu sesi */
router.get("/session/:sessionId", (req, res) => {
  const session = store.getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: "Sesi tidak ditemukan." });
  res.json({ messages: session.messages, title: session.title });
});

/** DELETE /api/session/:sessionId — hapus semua pesan dalam sesi (atau hapus filenya) */
router.delete("/session/:sessionId", (req, res) => {
  const ok = store.clearSession(req.params.sessionId);
  store.deleteSessionFile(req.params.sessionId);
  if (!ok) return res.status(404).json({ error: "Sesi tidak ditemukan." });
  res.json({ success: true });
});

/** DELETE /api/session/:sessionId/message/:messageId — hapus satu pesan spesifik */
router.delete("/session/:sessionId/message/:messageId", (req, res) => {
  const ok = store.deleteMessage(req.params.sessionId, req.params.messageId);
  if (!ok) return res.status(404).json({ error: "Sesi tidak ditemukan." });
  res.json({ success: true });
});

module.exports = router;
