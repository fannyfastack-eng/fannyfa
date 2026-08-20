const express = require("express");
const multer = require("multer");
const { callProvider } = require("../providers");
const store = require("../config/sessionStore");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

/**
 * POST /api/chat
 * multipart/form-data: deviceId, sessionId, provider, model, message, attachments[]
 */
router.post("/chat", upload.array("attachments"), async (req, res) => {
  try {
    const { deviceId, provider, model, message } = req.body;
    let { sessionId } = req.body;

    if (!deviceId || !provider || !model) {
      return res.status(400).json({ error: "deviceId, provider, dan model wajib diisi." });
    }

    const attachments = (req.files || []).map((f) => ({
      name: f.originalname,
      type: f.mimetype,
      size: f.size
    }));

    let session = sessionId ? store.getSession(sessionId) : null;
    if (!session) {
      session = store.createSession(deviceId, message);
      sessionId = session.id;
    }

    const userMessage = store.appendMessage(sessionId, {
      role: "user",
      content: message || "",
      attachments,
      model
    });

    const historyForModel = session.messages
      .concat([userMessage])
      .slice(-20)
      .map((m) => ({ role: m.role === "ai" ? "assistant" : m.role, content: m.content }));

    let replyText;
    try {
      replyText = await callProvider(provider, model, historyForModel);
    } catch (providerErr) {
      return res.status(502).json({ error: providerErr.message });
    }

    const aiMessage = store.appendMessage(sessionId, {
      role: "ai",
      content: replyText,
      model
    });

    return res.json({
      sessionId,
      messageId: aiMessage.id,
      reply: replyText
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Terjadi kesalahan internal server." });
  }
});

module.exports = router;
