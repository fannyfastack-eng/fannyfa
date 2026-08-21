# FannyFa Exploit

Website personal bertema terminal/hacker monokrom — kombinasi landing page,
AI chat multi-provider, dan koleksi tools kecil (OSINT Finder, dll).

![status](https://img.shields.io/badge/status-active-black)
![node](https://img.shields.io/badge/node-%3E%3D18-black)
![license](https://img.shields.io/badge/license-personal--project-black)

---

## Isi Project

- **Landing page** — tampilan utama bertema 404/terminal, monokrom, animasi glitch
- **AI Terminal** (`/ai`) — chat AI multi-provider (Gemini, Groq, ChatGPT, DeepSeek, Qwen)
  dengan riwayat sesi per device, upload gambar/file, system prompt custom, dan
  preview code langsung di chat
- **Tools** (`/tools`) — kumpulan tools kecil:
  - **OSINT Finder** — cari jejak username di berbagai platform sosial media
    sekaligus, dengan deteksi otomatis ada/nggaknya akun
  - (nambah seiring waktu)

---

## Tech Stack

| Bagian    | Teknologi                                   |
|-----------|----------------------------------------------|
| Frontend  | HTML, CSS murni, Vanilla JS (tanpa framework) |
| Font      | JetBrains Mono, Space Mono                    |
| Icon      | Bootstrap Icons                               |
| Backend   | Node.js, Express                              |
| Deploy    | Vercel (serverless)                           |

---

## Struktur Folder

```
.
├── index.js              # entry point backend (Express)
├── config/
│   └── settingai.js      # pengelolaan API key tiap provider AI
├── data/                 # auto-generated saat runtime, JANGAN di-commit
│   ├── keys.json
│   └── sessions/
├── media/
│   ├── index.html        # landing page
│   ├── tools.html        # daftar tools
│   ├── osint.html        # OSINT Finder
│   └── public/
│       ├── ai-chat.html
│       ├── css/
│       │   └── ai-chat.css
│       └── js/
│           ├── settingai.js  # frontend: state model & modal settings
│           └── chat.js       # frontend: logika utama chat
├── .env.example
├── .gitignore
└── package.json
```

---

## Setup Lokal

```bash
git clone https://github.com/username/repo-ini.git
cd repo-ini
npm install
cp .env.example .env
```

Isi `.env` (opsional, bisa juga diisi lewat halaman Settings di `/ai`):

```env
PORT=3001

GEMINI_API_KEY=
GROQ_API_KEY=
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
QWEN_API_KEY=
```

Jalankan:

```bash
node index.js
```

Buka `http://localhost:3001`

---

## Deploy ke Vercel

Project ini pakai satu `index.js` Express yang nangenin banyak route sekaligus
(bukan pola satu file per endpoint di folder `/api`). Pastikan ada `vercel.json`
di root supaya semua request kelempar ke `index.js`:

```json
{
  "version": 2,
  "builds": [{ "src": "index.js", "use": "@vercel/node" }],
  "routes": [{ "src": "/(.*)", "dest": "/index.js" }]
}
```

Set API key lewat **Environment Variables** di dashboard Vercel
(`GEMINI_API_KEY`, `GROQ_API_KEY`, dst) — ini cara paling stabil, karena
filesystem serverless Vercel bersifat *ephemeral* (isi `data/keys.json` dan
`data/sessions/*.json` bisa reset sewaktu-waktu).

---

## Catatan AI Terminal

- Model & provider aktif dipilih lewat dropdown di input bar chat
- API key diisi lewat modal **Settings** (icon gear di navbar)
- System prompt custom juga diatur di modal Settings yang sama
- Upload gambar dikirim sebagai base64 ke model yang support vision (Gemini,
  GPT-4o); file teks (`.txt/.js/.json/.html/.css/.md`) otomatis dibaca isinya
- Riwayat chat tersimpan per device (localStorage `deviceId`), bisa dihapus
  semua atau per pesan

---

## Catatan OSINT Finder

Tools ini **cuma menyusun link ke fitur pencarian publik** tiap platform
(Instagram, TikTok, GitHub, Telegram, dll) — bukan scraping, bukan bypass
login, bukan akses data privat. Deteksi otomatis (ada/nggaknya akun) hanya
tersedia untuk platform yang punya pola URL profil langsung, dan hasilnya bisa
berstatus "Ditemukan / Gak ada / Gak yakin" tergantung respons server platform
terkait.

Gunakan untuk riset yang sah dan hormati privasi orang lain serta ToS
masing-masing platform.

---

## Lisensi

Project personal — silakan pelajari/modifikasi buat belajar. Kalau mau pakai
ulang sebagian besar struktur/desainnya untuk project lain, kasih credit ya.
