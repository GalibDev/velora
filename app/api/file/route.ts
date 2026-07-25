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
  const targetValue = request.nextUrl.searchParams.get("url");
  if (!endpoint || !targetValue) {
    return NextResponse.json({ error: "Download URL পাওয়া যায়নি।" }, { status: 400 });
  }

  let target: URL;
  let cobaltOrigin: string;
  try {
    target = new URL(targetValue);
    cobaltOrigin = new URL(endpoint).origin;
  } catch {
    return NextResponse.json({ error: "Download URL সঠিক নয়।" }, { status: 400 });
  }

  if (target.origin !== cobaltOrigin || target.pathname !== "/tunnel") {
    return NextResponse.json({ error: "অনিরাপদ download URL বাতিল করা হয়েছে।" }, { status: 403 });
  }

  try {
    const upstream = await fetch(target, { redirect: "follow" });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json(
        { error: `ভিডিও stream পাওয়া যায়নি (${upstream.status})।` },
        { status: 502 },
      );
    }

    const filename = safeFilename(
      request.nextUrl.searchParams.get("filename")
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
