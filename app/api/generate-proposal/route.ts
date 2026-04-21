import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs/promises";
import path from "node:path";
import { buildProposalPrompt, loadStyleGuide } from "@/lib/proposal-prompt";

export const runtime = "nodejs";
export const maxDuration = 300;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-5-20250929";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "unnamed-client"
  );
}

function extractLatex(text: string): string {
  const fenced = text.match(/```(?:latex)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const idx = text.indexOf("\\documentclass");
  if (idx >= 0) return text.slice(idx).trim();
  return text.trim();
}

/**
 * Replace any raw \includegraphics{...vizuara_logo...} or {...client_logo...}
 * with an \IfFileExists-guarded version. Keeps the rest of the optional
 * arguments intact.
 */
function guardLogoIncludes(latex: string, clientName: string): string {
  const re = /\\includegraphics(\[[^\]]*\])?\{([^}]*?(vizuara_logo|client_logo)[^}]*)\}/g;
  return latex.replace(re, (_match, opts = "", filename: string) => {
    const fallback = filename.includes("vizuara_logo")
      ? `\\textbf{\\large Vizuara Technologies}`
      : `\\textbf{\\large ${clientName}}`;
    const altExt = filename.endsWith(".png")
      ? filename.replace(/\.png$/, ".jpg")
      : filename.replace(/\.jpe?g$/, ".png");
    return `\\IfFileExists{${filename}}{\\includegraphics${opts}{${filename}}}{\\IfFileExists{${altExt}}{\\includegraphics${opts}{${altExt}}}{${fallback}}}`;
  });
}

export async function POST(req: NextRequest) {
  try {
    const { values, notes, transcriptExcerpts } = await req.json();
    const clientName = values?.clientName?.trim();
    if (!clientName) {
      return NextResponse.json({ error: "clientName required" }, { status: 400 });
    }

    const slug = slugify(clientName);
    const outputDir = process.env.PROPOSAL_OUTPUT_DIR || "/Users/raj/Desktop/Proposal Agent/output";
    const clientDir = path.join(outputDir, slug);
    await fs.mkdir(clientDir, { recursive: true });

    // Detect logos present on disk (uploaded earlier)
    let hasVizLogo = false;
    let hasClientLogo = false;
    try {
      const files = await fs.readdir(clientDir);
      hasVizLogo = files.some((f) => /^vizuara_logo\.(png|jpg|jpeg|pdf)$/i.test(f));
      hasClientLogo = files.some((f) => /^client_logo\.(png|jpg|jpeg|pdf)$/i.test(f));
    } catch {}

    const styleGuide = await loadStyleGuide();
    const prompt = buildProposalPrompt({
      styleGuide,
      values,
      notes: notes ?? [],
      transcriptExcerpts: transcriptExcerpts ?? [],
      useLogos: { vizuara: hasVizLogo, client: hasClientLogo },
    });

    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = resp.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No text response" }, { status: 500 });
    }

    const rawLatex = extractLatex(textBlock.text);
    if (!rawLatex.includes("\\documentclass")) {
      return NextResponse.json(
        { error: "Claude did not return valid LaTeX", raw: textBlock.text.slice(0, 500) },
        { status: 500 }
      );
    }

    const latex = guardLogoIncludes(rawLatex, clientName);

    const texPath = path.join(clientDir, "proposal.tex");
    await fs.writeFile(texPath, latex, "utf-8");

    return NextResponse.json({
      ok: true,
      clientSlug: slug,
      texPath,
      outputDir: clientDir,
      hasLogos: { vizuara: hasVizLogo, client: hasClientLogo },
    });
  } catch (err: any) {
    console.error("generate-proposal error:", err);
    return NextResponse.json(
      { error: err?.message ?? "generation failed" },
      { status: 500 }
    );
  }
}
