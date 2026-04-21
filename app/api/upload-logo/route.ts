import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const maxDuration = 30;

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "unnamed-client"
  );
}

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const clientName = form.get("clientName")?.toString();
    const kind = form.get("kind")?.toString(); // 'vizuara' | 'client'
    const file = form.get("file") as File | null;

    if (!clientName) return NextResponse.json({ error: "clientName required" }, { status: 400 });
    if (kind !== "vizuara" && kind !== "client") {
      return NextResponse.json({ error: "kind must be 'vizuara' or 'client'" }, { status: 400 });
    }
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

    const slug = slugify(clientName);
    const outputDir = process.env.PROPOSAL_OUTPUT_DIR || "/Users/raj/Desktop/Proposal Agent/output";
    const clientDir = path.join(outputDir, slug);
    await fs.mkdir(clientDir, { recursive: true });

    // Remove existing logos of that kind (any extension)
    try {
      const existing = await fs.readdir(clientDir);
      for (const f of existing) {
        const re =
          kind === "vizuara"
            ? /^vizuara_logo\.(png|jpg|jpeg|pdf)$/i
            : /^client_logo\.(png|jpg|jpeg|pdf)$/i;
        if (re.test(f)) {
          try { await fs.unlink(path.join(clientDir, f)); } catch {}
        }
      }
    } catch {}

    // Default to .png — pdflatex w/ graphicx accepts png/jpg without extension hint
    const ext = (file.name.match(/\.(png|jpg|jpeg|pdf)$/i)?.[0] ?? ".png").toLowerCase();
    const out =
      kind === "vizuara"
        ? `vizuara_logo${ext === ".jpeg" ? ".jpg" : ext}`
        : `client_logo${ext === ".jpeg" ? ".jpg" : ext}`;

    const bytes = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(clientDir, out), bytes);

    return NextResponse.json({ ok: true, saved: out, clientSlug: slug });
  } catch (err: any) {
    console.error("upload-logo error:", err);
    return NextResponse.json({ error: err?.message ?? "upload failed" }, { status: 500 });
  }
}

/**
 * GET /api/upload-logo?slug=<slug> — returns which logos are already present.
 * Auto-seeds the Vizuara logo from PROPOSAL_ASSETS_DIR if absent.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  const outputDir = process.env.PROPOSAL_OUTPUT_DIR || "/Users/raj/Desktop/Proposal Agent/output";
  const assetsDir = process.env.PROPOSAL_ASSETS_DIR || "/Users/raj/Desktop/Proposal Agent/assets";
  const clientDir = path.join(outputDir, slug);
  try {
    await fs.mkdir(clientDir, { recursive: true });
    const files = await fs.readdir(clientDir);
    let viz = files.find((f) => /^vizuara_logo\.(png|jpg|jpeg|pdf)$/i.test(f)) ?? null;
    const cl = files.find((f) => /^client_logo\.(png|jpg|jpeg|pdf)$/i.test(f)) ?? null;

    if (!viz) {
      try {
        const assetFiles = await fs.readdir(assetsDir);
        const src = assetFiles.find((f) => /vizuara.*\.(png|jpg|jpeg|pdf)$/i.test(f));
        if (src) {
          const ext = (src.match(/\.(png|jpg|jpeg|pdf)$/i)?.[0] ?? ".png").toLowerCase();
          const out = `vizuara_logo${ext === ".jpeg" ? ".jpg" : ext}`;
          await fs.copyFile(path.join(assetsDir, src), path.join(clientDir, out));
          viz = out;
        }
      } catch {}
    }

    return NextResponse.json({ vizuara: viz, client: cl });
  } catch {
    return NextResponse.json({ vizuara: null, client: null });
  }
}
