import { NextRequest, NextResponse } from "next/server";
import { getStorage, slugify } from "@/lib/storage";
import { compileLatex, CompileFailed } from "@/lib/compile";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST { clientName, texOverride? }
 * - Reads proposal.tex from storage (or takes an override).
 * - Pulls any uploaded logos from storage as compile assets.
 * - Compiles via the configured strategy (local pdflatex or COMPILE_SERVICE_URL).
 * - Writes proposal.pdf back to storage.
 */
export async function POST(req: NextRequest) {
  try {
    const { clientName, texOverride } = await req.json();
    if (!clientName) {
      return NextResponse.json({ error: "clientName required" }, { status: 400 });
    }
    const slug = slugify(clientName);
    const store = getStorage();

    let tex: string;
    if (texOverride) {
      tex = String(texOverride);
      await store.put(`${slug}/proposal.tex`, tex, "text/x-tex");
    } else if (await store.exists(`${slug}/proposal.tex`)) {
      tex = await store.getText(`${slug}/proposal.tex`);
    } else {
      return NextResponse.json(
        { error: `proposal.tex not found for ${slug} — generate first.` },
        { status: 400 }
      );
    }

    // Gather logo assets from storage
    const assets: Record<string, Buffer> = {};
    for (const name of ["vizuara_logo.png", "vizuara_logo.jpg", "client_logo.png", "client_logo.jpg"]) {
      if (await store.exists(`${slug}/${name}`)) {
        assets[name] = await store.get(`${slug}/${name}`);
      }
    }

    try {
      const { pdf } = await compileLatex(tex, assets);
      await store.put(`${slug}/proposal.pdf`, pdf, "application/pdf");
      return NextResponse.json({
        ok: true,
        clientSlug: slug,
        pdfKey: `${slug}/proposal.pdf`,
        sizeBytes: pdf.length,
      });
    } catch (e) {
      if (e instanceof CompileFailed) {
        return NextResponse.json(
          {
            error: e.details.message,
            logTail: e.details.logTail,
            stderr: e.details.stderr,
            stdout: e.details.stdout,
          },
          { status: 500 }
        );
      }
      throw e;
    }
  } catch (err: any) {
    console.error("compile-pdf error:", err);
    return NextResponse.json({ error: err?.message ?? "compile failed" }, { status: 500 });
  }
}
