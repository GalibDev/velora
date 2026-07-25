"use client";

import { FormEvent, useMemo, useState } from "react";

type Format = "video" | "audio";
type Result = { url: string; filename?: string };

const qualities = ["1080", "720", "480", "360"];

function isYouTubeUrl(value: string) {
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    return ["youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"].includes(host);
  } catch {
    return false;
  }
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [format, setFormat] = useState<Format>("video");
  const [quality, setQuality] = useState("1080");
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  const valid = useMemo(() => isYouTubeUrl(url.trim()), [url]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setResult(null);
    if (!valid) {
      setStatus("error");
      setMessage("একটি সঠিক YouTube ভিডিও লিংক দিন।");
      return;
    }
    if (!confirmed) {
      setStatus("error");
      setMessage("ভিডিওটি ডাউনলোড করার অনুমতি আছে—এটি নিশ্চিত করুন।");
      return;
    }

    setStatus("loading");
    setMessage("ভিডিও প্রস্তুত করা হচ্ছে…");
    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), format, quality }),
      });
      const data = await response.json() as Result & { error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "ভিডিও প্রস্তুত করা যায়নি।");
      setResult(data);
      setStatus("ready");
      setMessage("আপনার ফাইল প্রস্তুত।");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "কিছু একটা সমস্যা হয়েছে।");
    }
  }

  return (
    <main>
      <nav className="nav">
        <a className="brand" href="#" aria-label="Velora home">
          <span className="brand-mark">V</span>
          <span>velora</span>
        </a>
        <div className="nav-links">
          <a href="#how">কীভাবে কাজ করে</a>
          <a href="#faq">সাহায্য</a>
        </div>
        <span className="privacy-pill">● Privacy first</span>
      </nav>

      <section className="hero">
        <div className="eyebrow"><span>✦</span> সহজ · দ্রুত · ব্যক্তিগত</div>
        <h1>Save what you love.<br /><em>Keep it close.</em></h1>
        <p className="lede">আপনার নিজের বা অনুমতিপ্রাপ্ত YouTube ভিডিও—পছন্দের ফরম্যাটে, কয়েকটি ক্লিকেই সেভ করুন।</p>

        <form className="download-card" onSubmit={submit}>
          <label className="url-label" htmlFor="video-url">ভিডিও লিংক</label>
          <div className={`url-row ${url && !valid ? "invalid" : ""}`}>
            <span className="link-icon">↗</span>
            <input
              id="video-url"
              type="url"
              value={url}
              onChange={(event) => { setUrl(event.target.value); setStatus("idle"); }}
              placeholder="https://youtube.com/watch?v=..."
              autoComplete="off"
              aria-describedby="url-help"
            />
            {url && <button className="clear" type="button" onClick={() => setUrl("")} aria-label="লিংক মুছুন">×</button>}
          </div>
          <p id="url-help" className="hint">YouTube, Shorts ও youtu.be লিংক সমর্থিত</p>

          <div className="options">
            <fieldset>
              <legend>ফরম্যাট</legend>
              <div className="segmented">
                <button type="button" className={format === "video" ? "active" : ""} onClick={() => setFormat("video")}>▣ Video</button>
                <button type="button" className={format === "audio" ? "active" : ""} onClick={() => setFormat("audio")}>♫ Audio</button>
              </div>
            </fieldset>
            <label className="quality">
              <span>{format === "video" ? "কোয়ালিটি" : "বিটরেট"}</span>
              <select value={quality} onChange={(event) => setQuality(event.target.value)}>
                {format === "video"
                  ? qualities.map((item) => <option key={item} value={item}>{item}p</option>)
                  : <><option value="320">320 kbps</option><option value="256">256 kbps</option><option value="128">128 kbps</option></>}
              </select>
            </label>
          </div>

          <label className="consent">
            <input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />
            <span>এই ভিডিওটি ডাউনলোড ও ব্যবহার করার অধিকার আমার আছে।</span>
          </label>

          <button className="primary" type="submit" disabled={status === "loading"}>
            {status === "loading" ? <><span className="spinner" /> প্রস্তুত হচ্ছে</> : <>Download now <span>↓</span></>}
          </button>

          {status !== "idle" && (
            <div className={`notice ${status}`} role="status">
              <span>{status === "ready" ? "✓" : status === "error" ? "!" : "…"}</span>
              <p>{message}</p>
              {result && <a href={result.url} download={result.filename}>ফাইল সেভ করুন ↓</a>}
            </div>
          )}
        </form>

        <div className="trust-row">
          <span>✓ কোনো সাইন-আপ নেই</span>
          <span>✓ লিংক সংরক্ষণ করি না</span>
          <span>✓ মোবাইলেও সহজ</span>
        </div>
      </section>

      <section className="steps" id="how">
        <div>
          <p className="section-kicker">তিনটি ছোট ধাপ</p>
          <h2>লিংক থেকে ফাইল—<br />একদম ঝামেলাহীন।</h2>
        </div>
        <ol>
          <li><b>01</b><span><strong>লিংক পেস্ট করুন</strong><small>YouTube থেকে ভিডিও লিংক কপি করে উপরে দিন।</small></span></li>
          <li><b>02</b><span><strong>পছন্দ করুন</strong><small>ভিডিও বা অডিও এবং প্রয়োজনীয় কোয়ালিটি বেছে নিন।</small></span></li>
          <li><b>03</b><span><strong>সেভ করুন</strong><small>প্রস্তুত হলে ফাইলটি আপনার ডিভাইসে সেভ করুন।</small></span></li>
        </ol>
      </section>

      <section className="legal" id="faq">
        <span>ভালো কনটেন্টকে সম্মান করি</span>
        <p>শুধু আপনার নিজের, Creative Commons, public-domain বা যেসব ভিডিও ডাউনলোডের অনুমতি আপনার আছে—সেগুলোর জন্য Velora ব্যবহার করুন। YouTube-এর শর্তাবলী ও স্থানীয় কপিরাইট আইন মেনে চলুন।</p>
      </section>

      <footer>
        <a className="brand" href="#"><span className="brand-mark">V</span><span>velora</span></a>
        <p>Made for the videos that matter.</p>
        <span>© 2026 Velora</span>
      </footer>
    </main>
  );
}
