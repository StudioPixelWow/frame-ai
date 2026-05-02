import { NextResponse } from "next/server";

export async function POST() {
  try {
    const payload = {
      videoUrl: "",
      segments: [
        { id: "s1", startMs: 0, endMs: 4000, text: "טקסט ראשון", role: "hook", speaker: "Host", totalScore: 0.9 },
        { id: "s2", startMs: 4000, endMs: 8000, text: "טקסט שני", role: "benefit", speaker: "Host", totalScore: 0.8 },
      ],
      subtitleData: [
        { segId: "s1", startMs: 0, endMs: 4000, text: "טקסט ראשון" },
        { segId: "s2", startMs: 4000, endMs: 8000, text: "טקסט שני" },
      ],
      preset: "Pixel Premium",
      format: "9:16",
    };

    const response = await fetch("http://localhost:3002/preview-data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    return NextResponse.json({
      ok: true,
      rendererStatus: response.status,
      rendererResponse: data,
    });
  } catch (error) {
    console.error("render-test route error:", error);
    return NextResponse.json(
      { ok: false, error: String(error) },
      { status: 500 },
    );
  }
}
