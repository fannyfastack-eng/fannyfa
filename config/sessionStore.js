/* =========================================================
   config/sessionStore.js
   Nyimpen tiap sesi percakapan sebagai file JSON terpisah di
   data/sessions/<sessionId>.json — supaya per-device/sesi kepisah.
========================================================= */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const SESSIONS_DIR = path.join(__dirname, "..", "data", "sessions");

function ensureDir() {
  if (!fs.existsSync(SESSIONS_DIR)) fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

function newSessionId() {
  return "sess_" + crypto.randomBytes(8).toString("hex");
}

function newMessageId() {
  return "msg_" + crypto.randomBytes(6).toString("hex");
}

function sessionPath(sessionId) {
  return path.join(SESSIONS_DIR, `${sessionId}.json`);
}

function createSession(deviceId, firstUserText) {
  ensureDir();
  const id = newSessionId();
  const session = {
    id,
    deviceId,
    title: (firstUserText || "Percakapan baru").slice(0, 40),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: []
  };
  fs.writeFileSync(sessionPath(id), JSON.stringify(session, null, 2));
  return session;
}

function getSession(sessionId) {
  ensureDir();
  const p = sessionPath(sessionId);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch (e) {
    return null;
  }
}

function saveSession(session) {
  ensureDir();
  session.updatedAt = new Date().toISOString();
  fs.writeFileSync(sessionPath(session.id), JSON.stringify(session, null, 2));
}

function appendMessage(sessionId, message) {
  const session = getSession(sessionId);
  if (!session) return null;
  const withId = { id: message.id || newMessageId(), ...message };
  session.messages.push(withId);
  saveSession(session);
  return withId;
}

function deleteMessage(sessionId, messageId) {
  const session = getSession(sessionId);
  if (!session) return false;
  session.messages = session.messages.filter((m) => m.id !== messageId);
  saveSession(session);
  return true;
}

function clearSession(sessionId) {
  const session = getSession(sessionId);
  if (!session) return false;
  session.messages = [];
  saveSession(session);
  return true;
}

function deleteSessionFile(sessionId) {
  ensureDir();
  const p = sessionPath(sessionId);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  return true;
}

function listSessionsByDevice(deviceId) {
  ensureDir();
  const files = fs.readdirSync(SESSIONS_DIR).filter((f) => f.endsWith(".json"));
  const sessions = [];
  files.forEach((f) => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(SESSIONS_DIR, f), "utf-8"));
      if (data.deviceId === deviceId) {
        sessions.push({ id: data.id, title: data.title, updatedAt: data.updatedAt });
      }
    } catch (e) {}
  });
  return sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

module.exports = {
  createSession,
  getSession,
  saveSession,
  appendMessage,
  deleteMessage,
  clearSession,
  deleteSessionFile,
  listSessionsByDevice,
  newMessageId
};
