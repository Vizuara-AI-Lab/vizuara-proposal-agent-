import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildProposalPrompt, loadStyleGuide } from "@/lib/proposal-prompt";
import { getStorage, slugify } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-5-20250929";

function extractLatex(text: string): string {
  const fenced = text.match(/```(?:latex)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const idx = text.indexOf("\\documentclass");
  if (idx >= 0) return text.slice(idx).trim();
  return text.trim();
}

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

async function logoPresence(slug: string) {
  const store = getStorage();
  const names = ["vizuara_logo.png", "vizuara_logo.jpg", "client_logo.png", "client_logo.jpg"];
  const checks = await Promise.all(names.map((n) => store.exists(`${slug}/${n}`)));
  return {
    vizuara: checks[0] || checks[1],
    client: checks[2] || checks[3],
  };
}

export async function POST(req: NextRequest) {
  try {
    const { values, notes, transcriptExcerpts } = await req.json();
    const clientName = values?.clientName?.trim();
    if (!clientName) {
      return NextResponse.json({ error: "clientName required" }, { status: 400 });
    }
    const slug = slugify(clientName);
    const store = getStorage();

    const hasLogos = await logoPresence(slug);
    const styleGuide = await loadStyleGuide();
    const prompt = buildProposalPrompt({
      styleGuide,
      values,
      notes: notes ?? [],
      transcriptExcerpts: transcriptExcerpts ?? [],
      useLogos: hasLogos,
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

    await store.put(`${slug}/proposal.tex`, latex, "text/x-tex");

    return NextResponse.json({
      ok: true,
      clientSlug: slug,
      texKey: `${slug}/proposal.tex`,
      hasLogos,
    });
  } catch (err: any) {
    console.error("generate-proposal error:", err);
    return NextResponse.json(
      { error: err?.message ?? "generation failed" },
      { status: 500 }
    );
  }
}
