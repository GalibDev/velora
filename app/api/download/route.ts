import { NextRequest, NextResponse } from "next/server";

const youtubeHosts = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "music.youtube.com"]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as { url?: string; format?: "video" | "audio"; quality?: string };
    if (!body.url) return NextResponse.json({ error: "ভিডিও লিংক পাওয়া যায়নি।" }, { status: 400 });

    const parsed = new URL(body.url);
    if (!youtubeHosts.has(parsed.hostname)) {
      return NextResponse.json({ error: "শুধু YouTube লিংক সমর্থিত।" }, { status: 400 });
    }

    const endpoint = process.env.COBALT_API_URL;
    if (!endpoint) {
      return NextResponse.json(
        { error: "Download service এখনো যুক্ত করা হয়নি। নিজের Cobalt API URL সেট করে আবার চেষ্টা করুন।" },
        { status: 503 },
      );
    }

    const headers: Record<string, string> = {
      "Accept": "application/json",
      "Content-Type": "application/json",
    };
    if (process.env.COBALT_API_TOKEN) {
      headers.Authorization = `Api-Key ${process.env.COBALT_API_TOKEN}`;
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        url: body.url,
        downloadMode: body.format === "audio" ? "audio" : "auto",
        videoQuality: body.format === "video" ? body.quality || "1080" : undefined,
        audioBitrate: body.format === "audio" ? body.quality || "320" : undefined,
        audioFormat: "mp3",
        youtubeVideoContainer: "mp4",
        filenameStyle: "pretty",
        alwaysProxy: true,
      }),
    });

    const data = await response.json() as { status?: string; url?: string; filename?: string; error?: { code?: string } };
    if (!response.ok || !data.url) {
      return NextResponse.json(
        { error: data.error?.code ? `ভিডিও প্রস্তুত করা যায়নি (${data.error.code})` : "ভিডিও প্রস্তুত করা যায়নি।" },
        { status: response.status || 502 },
      );
    }

    const downloadUrl = new URL(data.url);
    if (!["http:", "https:"].includes(downloadUrl.protocol)) {
      return NextResponse.json({ error: "অনিরাপদ download URL বাতিল করা হয়েছে।" }, { status: 502 });
    }
    const localDownload = new URL("/api/file", request.nextUrl.origin);
    localDownload.searchParams.set("url", downloadUrl.toString());
    if (data.filename) localDownload.searchParams.set("filename", data.filename);

    return NextResponse.json({
      url: localDownload.toString(),
      filename: data.filename,
    });
  } catch {
    return NextResponse.json({ error: "অনুরোধটি ঠিকভাবে পড়া যায়নি।" }, { status: 400 });
  }
}
