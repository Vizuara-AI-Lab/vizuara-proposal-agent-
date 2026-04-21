import { NextRequest, NextResponse } from "next/server";
import { getStorage, slugify } from "@/lib/storage";
import { loadBundledVizuaraLogo, bundledVizuaraLogoName } from "@/lib/bundled-assets";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const clientName = form.get("clientName")?.toString();
    const kind = form.get("kind")?.toString();
    const file = form.get("file") as File | null;

    if (!clientName) return NextResponse.json({ error: "clientName required" }, { status: 400 });
    if (kind !== "vizuara" && kind !== "client") {
      return NextResponse.json({ error: "kind must be 'vizuara' or 'client'" }, { status: 400 });
    }
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

    const slug = slugify(clientName);
    const store = getStorage();

    // Remove old variants of this kind
    for (const ext of ["png", "jpg", "jpeg"]) {
      const k = `${slug}/${kind === "vizuara" ? "vizuara_logo" : "client_logo"}.${ext}`;
      await store.delete(k);
    }

    const extRaw = (file.name.match(/\.(png|jpg|jpeg|pdf)$/i)?.[0] ?? ".png").toLowerCase();
    const ext = extRaw === ".jpeg" ? ".jpg" : extRaw;
    const out = `${slug}/${kind === "vizuara" ? "vizuara_logo" : "client_logo"}${ext}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    await store.put(out, bytes);

    return NextResponse.json({ ok: true, saved: out, clientSlug: slug });
  } catch (err: any) {
    console.error("upload-logo error:", err);
    return NextResponse.json({ error: err?.message ?? "upload failed" }, { status: 500 });
  }
}

/**
 * GET /api/upload-logo?slug=<slug>
 * Reports which logos are present in storage for this client.
 * Auto-seeds the bundled Vizuara logo if none has been uploaded yet.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
  const store = getStorage();

  const find = async (prefix: "vizuara_logo" | "client_logo") => {
    for (const ext of ["png", "jpg"]) {
      if (await store.exists(`${slug}/${prefix}.${ext}`)) return `${prefix}.${ext}`;
    }
    return null;
  };

  let viz = await find("vizuara_logo");
  const cl = await find("client_logo");

  if (!viz) {
    const bundled = await loadBundledVizuaraLogo();
    if (bundled) {
      const name = bundledVizuaraLogoName();
      await store.put(`${slug}/${name}`, bundled, "image/png");
      viz = name;
    }
  }

  return NextResponse.json({ vizuara: viz, client: cl });
}
