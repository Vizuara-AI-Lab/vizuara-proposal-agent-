/**
 * LaTeX compile abstraction.
 *
 * Three strategies, auto-selected:
 *   1. COMPILE_SERVICE_URL set → POST the tex + assets to an external HTTP compile service.
 *   2. LATEXONLINE_URL set → POST to a latex-online compatible service (text only, no assets).
 *   3. Local pdflatex (dev / container deployments): write tex to a temp dir + run pdflatex twice.
 *
 * The contract for an external compile service (COMPILE_SERVICE_URL):
 *   POST <url>
 *   Content-Type: application/json
 *   Authorization: Bearer <COMPILE_SERVICE_TOKEN>  (optional)
 *   Body: { "tex": "<string>", "assets": { "client_logo.png": "<base64>", ... } }
 *   Response 200: application/pdf bytes
 *   Response 4xx/5xx: { "error": "...", "logTail": "..." }
 *
 * The included Dockerfile builds an image that deploys this whole app with pdflatex
 * bundled so strategy (3) just works in production. See README § Deployment.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const execFileP = promisify(execFile);

export interface CompileResult {
  pdf: Buffer;
}

export interface CompileError {
  message: string;
  logTail?: string;
  stderr?: string;
  stdout?: string;
}

export class CompileFailed extends Error {
  details: CompileError;
  constructor(details: CompileError) {
    super(details.message);
    this.details = details;
  }
}

export async function compileLatex(
  tex: string,
  assets: Record<string, Buffer> = {}
): Promise<CompileResult> {
  if (process.env.COMPILE_SERVICE_URL) {
    return compileRemote(tex, assets);
  }
  return compileLocal(tex, assets);
}

// ---------- REMOTE STRATEGY ----------

async function compileRemote(
  tex: string,
  assets: Record<string, Buffer>
): Promise<CompileResult> {
  const url = process.env.COMPILE_SERVICE_URL!;
  const token = process.env.COMPILE_SERVICE_TOKEN;

  const body = {
    tex,
    assets: Object.fromEntries(
      Object.entries(assets).map(([name, buf]) => [name, buf.toString("base64")])
    ),
  };

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    let detail: CompileError;
    try {
      const j = await resp.json();
      detail = {
        message: j.error ?? `compile service returned ${resp.status}`,
        logTail: j.logTail,
        stderr: j.stderr,
      };
    } catch {
      detail = { message: `compile service returned ${resp.status}` };
    }
    throw new CompileFailed(detail);
  }

  const ab = await resp.arrayBuffer();
  return { pdf: Buffer.from(ab) };
}

// ---------- LOCAL STRATEGY ----------

async function compileLocal(
  tex: string,
  assets: Record<string, Buffer>
): Promise<CompileResult> {
  const pdflatex = process.env.PDFLATEX_BIN || "pdflatex";

  // Sanity check — pdflatex on PATH?
  try {
    await execFileP("which", [pdflatex.split(" ")[0]]);
  } catch {
    throw new CompileFailed({
      message:
        "pdflatex is not available on this server. Either install TeX Live, deploy via the bundled Dockerfile, or set COMPILE_SERVICE_URL to offload compilation to another service.",
    });
  }

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "viz-tex-"));
  try {
    await fs.writeFile(path.join(tmp, "proposal.tex"), tex, "utf-8");
    for (const [name, buf] of Object.entries(assets)) {
      await fs.writeFile(path.join(tmp, name), buf);
    }

    let lastStdout = "";
    for (let i = 0; i < 2; i++) {
      try {
        const { stdout } = await execFileP(
          pdflatex,
          ["-interaction=nonstopmode", "-halt-on-error", "proposal.tex"],
          { cwd: tmp, maxBuffer: 20 * 1024 * 1024 }
        );
        lastStdout = stdout;
      } catch (e: any) {
        let log = "";
        try {
          log = await fs.readFile(path.join(tmp, "proposal.log"), "utf-8");
        } catch {}
        throw new CompileFailed({
          message: "pdflatex failed",
          logTail: log.slice(-4000),
          stderr: e?.stderr?.slice(-2000),
          stdout: e?.stdout?.slice(-2000),
        });
      }
    }

    const pdfPath = path.join(tmp, "proposal.pdf");
    try {
      const pdf = await fs.readFile(pdfPath);
      return { pdf };
    } catch {
      throw new CompileFailed({
        message: "pdflatex ran but produced no PDF",
        stdout: lastStdout.slice(-2000),
      });
    }
  } finally {
    await fs.rm(tmp, { recursive: true, force: true });
  }
}
