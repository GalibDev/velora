import { NextRequest, NextResponse } from "next/server";

function safeFilename(value: string | null) {
  let decoded = value || "velora-video.mp4";
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    // Keep the original value when it is not URI encoded.
  }

  const cleaned = decoded
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

  return cleaned || "velora-video.mp4";
}

function contentDisposition(filename: string) {
  const ascii = filename
    .normalize("NFKD")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/["\\]/g, "")
    .trim() || "velora-video.mp4";
  const encoded = encodeURIComponent(filename)
    .replace(/['()]/g, escape)
    .replace(/\*/g, "%2A");

  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

export async function GET(request: NextRequest) {
  const endpoint = process.env.COBALT_API_URL;
  const fallbackUrl = process.env.YTDLP_FALLBACK_URL
    || (endpoint?.startsWith("http://localhost:") ? "http://localhost:9100/" : undefined);
  const targetValue = request.nextUrl.searchParams.get("url");
  const sourceValue = request.nextUrl.searchParams.get("source");
  if (!endpoint || (!targetValue && !sourceValue)) {
    return NextResponse.json({ error: "Download URL পাওয়া যায়নি।" }, { status: 400 });
  }

  let target: URL;
  let cobaltOrigin: string;
  try {
    cobaltOrigin = new URL(endpoint).origin;
    if (sourceValue) {
      const source = new URL(sourceValue);
      const youtubeHosts = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"]);
      if (!youtubeHosts.has(source.hostname)) {
        return NextResponse.json({ error: "শুধু YouTube লিংক সমর্থিত।" }, { status: 400 });
      }

      const format = request.nextUrl.searchParams.get("format") === "audio" ? "audio" : "video";
      const quality = request.nextUrl.searchParams.get("quality") || (format === "audio" ? "320" : "1080");
      const headers: Record<string, string> = {
        "Accept": "application/json",
        "Content-Type": "application/json",
      };
      if (process.env.COBALT_API_TOKEN) {
        headers.Authorization = `Api-Key ${process.env.COBALT_API_TOKEN}`;
      }

      const prepare = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          url: source.toString(),
          downloadMode: format === "audio" ? "audio" : "auto",
          videoQuality: format === "video" ? quality : undefined,
          audioBitrate: format === "audio" ? quality : undefined,
          audioFormat: "mp3",
          youtubeVideoContainer: "mp4",
          filenameStyle: "pretty",
          alwaysProxy: true,
        }),
      });
      const prepared = await prepare.json() as {
        url?: string;
        error?: { code?: string };
      };
      if (!prepare.ok || !prepared.url) {
        return NextResponse.json(
          { error: prepared.error?.code || "Video stream could not be prepared." },
          { status: 502 },
        );
      }
      target = new URL(prepared.url);
    } else {
      target = new URL(targetValue!);
    }
  } catch {
    return NextResponse.json({ error: "Download URL সঠিক নয়।" }, { status: 400 });
  }

  if (target.origin !== cobaltOrigin || target.pathname !== "/tunnel") {
    return NextResponse.json({ error: "অনিরাপদ download URL বাতিল করা হয়েছে।" }, { status: 403 });
  }

  try {
    let upstream = await fetch(target, { redirect: "follow" });
    let fallbackFilename: string | undefined;

    // Some YouTube videos produce a successful Cobalt tunnel with an empty
    // body. Resolve a fresh progressive media URL locally instead of sending
    // Chrome a misleading 0-byte download.
    if (
      sourceValue
      && request.nextUrl.searchParams.get("format") !== "audio"
      && upstream.headers.get("content-length") === "0"
      && fallbackUrl
    ) {
      const fallbackEndpoint = new URL("/resolve", fallbackUrl);
      const fallbackResponse = await fetch(fallbackEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: sourceValue,
          quality: request.nextUrl.searchParams.get("quality") || "720",
        }),
      });
      const fallback = await fallbackResponse.json() as {
        url?: string;
        filename?: string;
      };
      if (fallbackResponse.ok && fallback.url) {
        upstream = await fetch(fallback.url, { redirect: "follow" });
        fallbackFilename = fallback.filename;
      }
    }

    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `ভিডিও stream পাওয়া যায়নি (${upstream.status})।` },
        { status: 502 },
      );
    }

    const filename = safeFilename(
      request.nextUrl.searchParams.get("filename")
      || fallbackFilename
      || upstream.headers.get("content-disposition")?.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i)?.[1]
      || null,
    );
    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("content-type") || "application/octet-stream");
    headers.set("Content-Disposition", contentDisposition(filename));
    headers.set("Cache-Control", "private, no-store");
    // Never promote Cobalt's estimated length to Content-Length. Chrome treats
    // even a tiny mismatch as an interrupted download ("Site wasn't available").
    const length = upstream.headers.get("content-length");
    if (length && Number(length) > 0) headers.set("Content-Length", length);

    return new Response(upstream.body, { status: 200, headers });
  } catch {
    return NextResponse.json(
      { error: "Cobalt থেকে ভিডিও stream আনা যায়নি। আবার চেষ্টা করুন।" },
      { status: 502 },
    );
  }
}
