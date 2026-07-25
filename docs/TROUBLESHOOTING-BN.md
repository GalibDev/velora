# Velora: বাংলা Troubleshooting Guide

এই নথিতে Velora-এর local YouTube download ব্যবস্থা, আগে পাওয়া সমস্যাগুলোর কারণ, প্রয়োগ করা সমাধান এবং ভবিষ্যতে debug করার নিয়ম লেখা আছে।

> শুধু নিজের, Creative Commons, public-domain অথবা যেসব ভিডিও download করার অনুমতি আছে—সেগুলোর জন্য Velora ব্যবহার করুন।

## সিস্টেমটি কীভাবে কাজ করে

Download request নিচের ধাপগুলো অনুসরণ করে:

1. Browser `/api/download` endpoint-এ YouTube link, format এবং quality পাঠায়।
2. Next.js API local Cobalt server (`http://localhost:9000`) দিয়ে ভিডিও প্রস্তুত করে।
3. Browser-এর জন্য একই origin-এর `/api/file` link তৈরি হয়।
4. ব্যবহারকারী Save করলে `/api/file` নতুন Cobalt tunnel তৈরি করে এবং video stream করে।
5. Cobalt যদি HTTP 200 দিয়েও `Content-Length: 0` পাঠায়, Velora local `yt-dlp` fallback (`http://localhost:9100`) ব্যবহার করে।
6. `yt-dlp` সরাসরি কার্যকর media URL বের করে এবং `/api/file` সেটি browser-এ stream করে।

## আগে কী কী সমস্যা ছিল

### ১. Windows-এ `npm run dev` চলছিল না

পুরোনো script-এ Unix-style environment variable ছিল:

```text
WRANGLER_LOG_PATH=.wrangler/wrangler.log vinext dev
```

PowerShell এটিকে command হিসেবে ধরায় `'WRANGLER_LOG_PATH' is not recognized` error দিচ্ছিল।

সমাধান: `cross-env` ব্যবহার করা হয়েছে, যাতে একই script Windows, Linux ও macOS-এ চলে।

### ২. Cobalt API configure করা ছিল না

Website download request পাঠানোর জন্য কোনো Cobalt API পাচ্ছিল না।

সমাধান:

- Docker-এ local Cobalt server যোগ করা হয়েছে।
- Local API address রাখা হয়েছে `http://localhost:9000/`।
- `.env.local`-এ `COBALT_API_URL` সেট করা হয়েছে।

### ৩. Chrome “Site wasn’t available” দেখাচ্ছিল

Cobalt-এর tunnel stream browser পর্যন্ত ঠিকভাবে পৌঁছাচ্ছিল না অথবা ভুল `Content-Length` ব্যবহারের কারণে Chrome download interrupted হিসেবে ধরছিল।

সমাধান:

- `/api/file` same-origin proxy যোগ করা হয়েছে।
- Cobalt-এর estimated file size-কে আসল `Content-Length` হিসেবে আর ব্যবহার করা হয় না।
- নিরাপদ filename এবং `Content-Disposition` header তৈরি করা হয়েছে।

### ৪. প্রস্তুত download link expire হয়ে যাচ্ছিল

Cobalt tunnel link সাধারণত অল্প সময়—প্রায় ৯০ সেকেন্ড—কার্যকর থাকে। পুরোনো link-এ ক্লিক করলে download ব্যর্থ বা 0-byte হতে পারত।

সমাধান:

- `/api/download` এখন transient Cobalt tunnel browser-এ সংরক্ষণ করে না।
- মূল YouTube link, format ও quality `/api/file`-এ পাঠানো হয়।
- Save করার মুহূর্তে `/api/file` নতুন Cobalt tunnel তৈরি করে।

### ৫. কিছু ভিডিওতে Cobalt HTTP 200 দিয়েও 0 byte পাঠাচ্ছিল

উদাহরণ:

```text
https://youtu.be/FUyrcAtgY7I
```

Cobalt response:

```text
HTTP/1.1 200 OK
Estimated-Content-Length: -1
Content-Length: 0
```

অর্থাৎ request সফল দেখালেও response body খালি ছিল। Quality পরিবর্তন করলেও একই সমস্যা হচ্ছিল।

সমাধান:

- `yt-session-generator` যোগ করা হয়েছে, যাতে Cobalt YouTube-এর প্রয়োজনীয় PO token ও visitor data পায়।
- তারপরও Cobalt 0-byte দিলে automatic `yt-dlp` fallback যোগ করা হয়েছে।
- Fallback service port: `9100`
- পরীক্ষিত ভিডিওটির final download size ছিল `8,048,877 bytes`।

## Project-এর গুরুত্বপূর্ণ অংশ

```text
app/api/download/route.ts
```

YouTube link validate করে, Cobalt দিয়ে প্রাথমিকভাবে ভিডিও পরীক্ষা করে এবং `/api/file` link তৈরি করে।

```text
app/api/file/route.ts
```

Download-এর সময় নতুন Cobalt tunnel তৈরি করে। Cobalt-এর `Content-Length: 0` হলে `yt-dlp` fallback ব্যবহার করে।

```text
infra/cobalt/compose.yaml
```

তিনটি Docker service চালায়:

- `velora-cobalt`
- `velora-yt-session`
- `velora-ytdlp`

```text
infra/ytdlp/server.py
```

Local fallback API। `yt-dlp` দিয়ে একটি progressive video URL resolve করে।

## স্বাভাবিকভাবে project চালানোর নিয়ম

Docker Desktop চালু করে VS Code terminal-এ:

```powershell
npm run cobalt:start
npm run dev
```

Browser-এ খুলুন:

```text
http://localhost:3000
```

পরিবর্তনের পর পুরোনো JavaScript বা download link ব্যবহার হলে:

```text
Ctrl + Shift + R
```

## Docker service চলছে কি না পরীক্ষা

```powershell
docker ps
```

এই container তিনটি running থাকা উচিত:

```text
velora-cobalt
velora-yt-session
velora-ytdlp
```

নির্দিষ্ট service-এর log:

```powershell
docker logs --tail 100 velora-cobalt
docker logs --tail 100 velora-yt-session
docker logs --tail 100 velora-ytdlp
```

সব service পুনরায় তৈরি ও চালু করতে:

```powershell
docker compose -f infra/cobalt/compose.yaml up -d --build --force-recreate
```

বন্ধ করতে:

```powershell
npm run cobalt:stop
```

## Health check

Cobalt:

```powershell
curl.exe http://localhost:9000/
```

`yt-dlp` fallback:

```powershell
curl.exe http://localhost:9100/health
```

Fallback response হওয়া উচিত:

```json
{"ok": true}
```

## কোনো ভিডিও 0-byte হলে ধাপে ধাপে debug

### ধাপ ১: Page refresh

প্রথমে `Ctrl + Shift + R` দিন। পুরোনো প্রস্তুত download link পুনরায় ব্যবহার করবেন না।

### ধাপ ২: Container পরীক্ষা

```powershell
docker ps
```

কোনো container বন্ধ থাকলে:

```powershell
npm run cobalt:start
```

### ধাপ ৩: Cobalt response পরীক্ষা

PowerShell:

```powershell
$videoUrl = "এখানে YouTube link দিন"
$body = @{
  url = $videoUrl
  downloadMode = "auto"
  videoQuality = "720"
  youtubeVideoContainer = "mp4"
  filenameStyle = "pretty"
  alwaysProxy = $true
} | ConvertTo-Json -Compress

$result = Invoke-RestMethod `
  -Uri "http://localhost:9000/" `
  -Method Post `
  -ContentType "application/json" `
  -Headers @{ Accept = "application/json" } `
  -Body $body

$result
```

যদি `status` হিসেবে `tunnel` আসে, stream size পরীক্ষা করুন:

```powershell
curl.exe `
  --max-time 120 `
  --output NUL `
  --write-out "HTTP=%{http_code} BYTES=%{size_download}`n" `
  $result.url
```

`BYTES=0` হলে Cobalt খালি stream দিচ্ছে। App-এর `yt-dlp` fallback তখন কাজ করার কথা।

### ধাপ ৪: Fallback সরাসরি পরীক্ষা

```powershell
$fallbackBody = @{
  url = "এখানে YouTube link দিন"
  quality = "720"
} | ConvertTo-Json -Compress

Invoke-RestMethod `
  -Uri "http://localhost:9100/resolve" `
  -Method Post `
  -ContentType "application/json" `
  -Body $fallbackBody
```

Response-এ `url` ও `filename` আসা উচিত।

### ধাপ ৫: সম্পূর্ণ Next.js route পরীক্ষা

```powershell
$requestBody = @{
  url = "এখানে YouTube link দিন"
  format = "video"
  quality = "720"
} | ConvertTo-Json -Compress

$download = Invoke-RestMethod `
  -Uri "http://localhost:3000/api/download" `
  -Method Post `
  -ContentType "application/json" `
  -Body $requestBody

$download

curl.exe `
  --max-time 120 `
  --output NUL `
  --write-out "HTTP=%{http_code} BYTES=%{size_download} TYPE=%{content_type}`n" `
  ("http://localhost:3000" + $download.url)
```

সফল হলে:

- `HTTP=200`
- `BYTES` শূন্যের চেয়ে বেশি
- সাধারণত `TYPE=video/mp4`

## পরিচিত error-এর অর্থ

### `error.api.content.video.unavailable`

ভিডিওটি Cobalt-এর guest access থেকে পাওয়া যাচ্ছে না। সম্ভাব্য কারণ:

- ভিডিও private বা removed
- region restriction
- age/login restriction
- YouTube guest request block করছে

এটি app-এর 0-byte streaming bug নয়। অন্য public ও guest-accessible ভিডিও দিয়ে পরীক্ষা করুন।

### `ECONNREFUSED localhost:9000`

Cobalt container চলছে না।

```powershell
npm run cobalt:start
```

### `ECONNREFUSED localhost:9100`

Fallback container চলছে না অথবা পুরোনো Docker configuration চলছে।

```powershell
docker compose -f infra/cobalt/compose.yaml up -d --build
```

### Chrome পুরোনো failed download দেখায়

Chrome-এর Downloads panel-এ আগের failed item থেকে Resume না করে page refresh করে নতুন download শুরু করুন।

## Code পরিবর্তনের পর verification

```powershell
npm run build
git diff --check
```

তারপর app ও Docker service restart করে বাস্তব ভিডিও দিয়ে byte test করুন।

## সংক্ষিপ্ত Debug Checklist

- Docker Desktop চালু আছে?
- `velora-cobalt`, `velora-yt-session`, `velora-ytdlp` running?
- `http://localhost:9000/` response দিচ্ছে?
- `http://localhost:9100/health` থেকে `{"ok": true}` আসছে?
- Page-এ hard refresh দেওয়া হয়েছে?
- নতুন download request করা হয়েছে?
- Cobalt tunnel-এর `Content-Length` কি `0`?
- Fallback `/resolve` কি valid URL দিচ্ছে?
- Full `/api/file` test-এ `BYTES > 0`?
- ভিডিওটি guest-accessible কি না?

