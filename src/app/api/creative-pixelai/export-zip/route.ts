/**
 * POST /api/creative-pixelai/export-zip
 * Body: { files: [{ name: string, url: string }], zipName?: string }
 * Fetches the rendered assets and streams back a ZIP (jszip — already a dependency).
 */

import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const { files, zipName } = (await req.json()) as { files?: { name: string; url: string }[]; zipName?: string };
    if (!Array.isArray(files) || files.length === 0) {
      return NextResponse.json({ error: "files required" }, { status: 400 });
    }

    const zip = new JSZip();
    for (const f of files.slice(0, 20)) {
      if (!f?.url || !f?.name) continue;
      const res = await fetch(f.url, { signal: AbortSignal.timeout(20000) });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      zip.file(f.name.replace(/[^\w.\-֐-׿ ]/g, "_"), buf);
    }

    const out = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    return new NextResponse(new Uint8Array(out), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${(zipName || "creative-formats").replace(/[^\w.-]/g, "_")}.zip"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
