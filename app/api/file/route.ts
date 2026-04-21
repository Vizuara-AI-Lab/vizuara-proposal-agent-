import { NextRequest } from "next/server";
import path from "node:path";
import { getStorage } from "@/lib/storage";

export const runtime = "nodejs";

const ALLOW = new Set([
  "proposal.pdf",
  "proposal.tex",
  "brief.json",
  "brief.md",
  "vizuara_logo.png",
  "vizuara_logo.jpg",
  "client_logo.png",
  "client_logo.jpg",
  "client_logo.jpeg",
]);

const MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".tex": "text/x-tex",
  ".json": "application/json",
  ".md": "text/markdown",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("slug");
  const name = req.nextUrl.searchParams.get("name");
  if (!slug || !name) return new Response("missing slug/name", { status: 400 });
  if (!ALLOW.has(name)) return new Response("not allowed", { status: 403 });
  if (slug.includes("/") || slug.includes("..")) {
    return new Response("bad slug", { status: 400 });
  }

  try {
    const store = getStorage();
    const data = await store.get(`${slug}/${name}`);
    const mime = MIME[path.extname(name).toLowerCase()] || "application/octet-stream";
    return new Response(new Uint8Array(data), {
      headers: {
        "content-type": mime,
        "content-disposition": `inline; filename="${name}"`,
        "cache-control": "no-store",
      },
    });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
