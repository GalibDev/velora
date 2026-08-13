# Velora

Velora হলো Next.js, TypeScript ও Tailwind CSS দিয়ে তৈরি একটি privacy-focused YouTube media saver। এটি নিজের, Creative Commons, public-domain অথবা download করার অনুমতি আছে—এমন ভিডিও local environment-এ সংরক্ষণের জন্য তৈরি।

![Next.js](https://img.shields.io/badge/Next.js-16-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4)
![Docker](https://img.shields.io/badge/Docker-required-2496ED)

## Features

- YouTube, Shorts ও `youtu.be` link সমর্থন
- Video quality নির্বাচন: 1080p, 720p, 480p ও 360p
- Audio download mode
- Local self-hosted Cobalt API
- YouTube PO-token session provider
- Cobalt 0-byte stream দিলে automatic `yt-dlp` fallback
- Expired Cobalt tunnel এড়াতে click-time fresh stream
- Same-origin download proxy
- বাংলা responsive user interface
- Windows-compatible npm scripts

## Download flow...

```text
Browser
   │
   ▼
Next.js /api/download
   │
   ▼
Local Cobalt API ─────► YouTube session token provider
   │
   ▼
Next.js /api/file
   │
   ├── Valid Cobalt stream ──► Browser download
   │
   └── Cobalt 0-byte ──► yt-dlp fallback ──► Browser download
```

## Tech stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- vinext / Vite
- Docker Compose
- Cobalt API
- `yt-dlp`

## প্রয়োজনীয় সফটওয়্যার

- Node.js `>=22.13.0`
- npm
- Docker Desktop
- Git

Windows ব্যবহার করলে Docker Desktop-এ WSL 2 backend চালু রাখুন।

## Local setup

### 1. Repository clone

```powershell
git clone https://github.com/GalibDev/velora.git
cd velora
```

### 2. Dependency install

```powershell
npm install
```

### 3. Environment file

Project root-এ `.env.local` তৈরি করে লিখুন:

```env
COBALT_API_URL=http://localhost:9000/
YTDLP_FALLBACK_URL=http://localhost:9100/
```

নিজস্ব protected Cobalt instance হলে optional API key:

```env
COBALT_API_TOKEN=your-api-key
```

### 4. Download services চালু করুন

Docker Desktop চালু করে:

```powershell
npm run cobalt:start
```

এতে তিনটি container চালু হবে:

- `velora-cobalt`
- `velora-yt-session`
- `velora-ytdlp`

প্রথমবার image download ও build হতে কিছু সময় লাগতে পারে।

### 5. Development server

নতুন VS Code terminal-এ:

```powershell
npm run dev
```

তারপর browser-এ খুলুন:

```text
http://localhost:3000
```

## Commands

| Command | কাজ |
|---|---|
| `npm run dev` | Development server চালু করে |
| `npm run build` | Production build যাচাই করে |
| `npm run start` | Built application চালু করে |
| `npm test` | Build ও automated test চালায় |
| `npm run lint` | ESLint চালায় |
| `npm run cobalt:start` | Cobalt, token provider ও fallback চালু করে |
| `npm run cobalt:stop` | Download services বন্ধ করে |
| `npm run cobalt:logs` | Cobalt live logs দেখায় |

## Service ports

| Service | Local address | Public হওয়া উচিত? |
|---|---|---|
| Velora | `http://localhost:3000` | Development-এ না |
| Cobalt | `http://localhost:9000` | না |
| yt-dlp fallback | `http://localhost:9100` | না |

Cobalt ও fallback service শুধু Velora backend-এর মাধ্যমে ব্যবহার করুন।

## Health check

Cobalt:

```powershell
curl.exe http://localhost:9000/
```

`yt-dlp` fallback:

```powershell
curl.exe http://localhost:9100/health
```

Expected fallback response:

```json
{"ok": true}
```

Running containers:

```powershell
docker ps
```

## API routes

### `POST /api/download`

Request:

```json
{
  "url": "https://youtu.be/example",
  "format": "video",
  "quality": "720"
}
```

Response:

```json
{
  "url": "/api/file?...",
  "filename": "video.mp4"
}
```

### `GET /api/file`

Save করার মুহূর্তে fresh Cobalt tunnel তৈরি করে। Cobalt HTTP 200-এর সঙ্গে `Content-Length: 0` দিলে local `yt-dlp` fallback ব্যবহার করে media stream করে।

## 0-byte download কেন হতো

দুটি প্রধান কারণ ছিল:

1. Cobalt tunnel অল্প সময় পর expire হয়ে যেত।
2. কিছু YouTube ভিডিওতে Cobalt HTTP 200 দিলেও `Content-Length: 0` এবং খালি body পাঠাত।

বর্তমান সমাধান:

- Browser-এ transient tunnel সংরক্ষণ করা হয় না।
- Save করার সময় fresh tunnel তৈরি হয়।
- Empty Cobalt response শনাক্ত হলে `yt-dlp` fallback media URL resolve করে।

বিস্তারিত বাংলা debugging নির্দেশিকা:

[Velora বাংলা Troubleshooting Guide](docs/TROUBLESHOOTING-BN.md)

## Common problems

### `WRANGLER_LOG_PATH is not recognized`

সর্বশেষ code pull করে dependency install করুন:

```powershell
git pull
npm install
```

Project scripts Windows-এর জন্য `cross-env` ব্যবহার করে।

### `ECONNREFUSED localhost:9000`

Cobalt চলছে না:

```powershell
npm run cobalt:start
```

### `ECONNREFUSED localhost:9100`

Fallback service build/run করুন:

```powershell
docker compose -f infra/cobalt/compose.yaml up -d --build
```

### `error.api.content.video.unavailable`

ভিডিওটি private, removed, region-restricted, login-restricted অথবা YouTube guest access থেকে blocked হতে পারে। এটি 0-byte proxy সমস্যার সমান নয়।

### পরিবর্তনের পরও পুরোনো result

Browser-এ hard refresh দিন:

```text
Ctrl + Shift + R
```

Chrome Downloads panel-এর পুরোনো failed item Resume না করে নতুন download শুরু করুন।

## Production deployment

শুধু frontend deploy করলে global download কাজ করবে না। Production-এ একই VPS বা private network-এ নিচের service চালাতে হবে:

- Velora web application
- Cobalt
- YouTube session provider
- `yt-dlp` fallback
- Caddy বা Nginx reverse proxy

প্রস্তাবিত minimum:

- 2 vCPU
- 4 GB RAM
- 40 GB SSD
- Ubuntu 24.04
- Docker ও Docker Compose

Public service-এর জন্য অবশ্যই যোগ করুন:

- HTTPS
- Rate limiting
- Cloudflare Turnstile বা bot protection
- Maximum video duration
- Concurrent download limit
- Monitoring ও bandwidth alert

`localhost` backend address কোনো আলাদা hosted frontend থেকে কাজ করবে না। Production Docker network-এর internal service name অথবা private backend URL ব্যবহার করতে হবে।

## Project structure

```text
app/
  api/
    download/route.ts   # Request validation ও Cobalt preparation
    file/route.ts       # Fresh stream ও yt-dlp fallback
  page.tsx              # বাংলা UI
infra/
  cobalt/
    compose.yaml        # Local download stack
  ytdlp/
    Dockerfile
    server.py           # Fallback resolver API
docs/
  TROUBLESHOOTING-BN.md
```

## Verification

Code পরিবর্তনের পরে:

```powershell
npm run build
git diff --check
```

তারপর একটি public ও download-authorized ভিডিও দিয়ে final byte test করুন।

## Responsible use

Velora কোনো piracy service নয়। শুধু নিজের বা download করার বৈধ অনুমতি আছে এমন content-এর জন্য এটি ব্যবহার করুন। YouTube-এর Terms of Service এবং স্থানীয় copyright আইন মেনে চলার দায়িত্ব ব্যবহারকারীর।

## License

এই repository-তে ব্যবহৃত third-party project ও Docker image নিজ নিজ license-এর অধীন। Cobalt-related code বা deployment প্রকাশ/পরিবর্তনের সময় Cobalt-এর AGPL license requirements যাচাই করুন।
