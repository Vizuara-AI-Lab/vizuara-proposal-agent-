import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import fs from "node:fs/promises";

const execFileP = promisify(execFile);

export const runtime = "nodejs";
export const maxDuration = 300;

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
    const { clientName, texOverride } = await req.json();
    if (!clientName) {
      return NextResponse.json({ error: "clientName required" }, { status: 400 });
    }
    const slug = slugify(clientName);
    const outputDir = process.env.PROPOSAL_OUTPUT_DIR || "/Users/raj/Desktop/Proposal Agent/output";
    const clientDir = path.join(outputDir, slug);
    const texPath = path.join(clientDir, "proposal.tex");

    if (texOverride) {
      await fs.writeFile(texPath, texOverride, "utf-8");
    }

    // Verify tex exists
    try {
      await fs.access(texPath);
    } catch {
      return NextResponse.json(
        { error: `proposal.tex not found at ${texPath} — generate first.` },
        { status: 400 }
      );
    }

    const pdflatex = process.env.PDFLATEX_BIN || "pdflatex";
    const args = ["-interaction=nonstopmode", "-halt-on-error", "proposal.tex"];

    let lastStdout = "";
    let lastStderr = "";
    for (let i = 0; i < 2; i++) {
      try {
        const { stdout, stderr } = await execFileP(pdflatex, args, {
          cwd: clientDir,
          maxBuffer: 20 * 1024 * 1024,
        });
        lastStdout = stdout;
        lastStderr = stderr;
      } catch (e: any) {
        // Collect log for error reporting
        let log = "";
        try {
          log = await fs.readFile(path.join(clientDir, "proposal.log"), "utf-8");
        } catch {}
        return NextResponse.json(
          {
            error: "pdflatex failed",
            stderr: e?.stderr?.slice(-4000) ?? String(e).slice(0, 4000),
            stdout: e?.stdout?.slice(-4000),
            logTail: log.slice(-4000),
          },
          { status: 500 }
        );
      }
    }

    // Verify PDF exists
    const pdfPath = path.join(clientDir, "proposal.pdf");
    try {
      await fs.access(pdfPath);
    } catch {
      return NextResponse.json(
        { error: "pdflatex ran but no PDF produced", stdoutTail: lastStdout.slice(-2000) },
        { status: 500 }
      );
    }

    // Clean auxiliary files
    for (const ext of [".aux", ".log", ".out", ".fls", ".fdb_latexmk", ".toc"]) {
      try {
        await fs.unlink(path.join(clientDir, `proposal${ext}`));
      } catch {}
    }

    const stat = await fs.stat(pdfPath);
    return NextResponse.json({
      ok: true,
      pdfPath,
      sizeBytes: stat.size,
      clientSlug: slug,
    });
  } catch (err: any) {
    console.error("compile-pdf error:", err);
    return NextResponse.json({ error: err?.message ?? "compile failed" }, { status: 500 });
  }
}
