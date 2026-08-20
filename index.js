const nodemailer = require('nodemailer');
const cors = require('cors');
const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
require("dotenv").config();
const app = express();

app.use(cookieParser());
app.use(express.static(path.join(__dirname)));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cors());
const chatRoutes = require("./routes/chat.routes");
const sessionRoutes = require("./routes/session.routes");
const settingsRoutes = require("./routes/settings.routes");
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
app.get('/tools/base64', (req, res) => {
  res.sendFile(path.join(__dirname,"media", "base64.html"));
});
app.get('/tools', (req, res) => {
  res.sendFile(path.join(__dirname,"media", "tools.html"));
});
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname,"media", "index.html"));
});
// otp send tools
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
// WAJIB: Export app agar Vercel membaca Express sebagai Serverless
module.exports = app;

// Jalankan app.listen HANYA jika dijalankan secara lokal (bukan di Vercel)
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Terhubung Ke Server, port ${PORT}`);
  }).on('error', (err) => {
    console.log("gagal:", err.message);
  });
}