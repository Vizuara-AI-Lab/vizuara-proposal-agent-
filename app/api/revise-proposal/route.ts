import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getStorage, slugify } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-5-20250929";

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

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

function buildRevisionPrompt(currentLatex: string, history: ChatTurn[], instruction: string) {
  const convo = history.length
    ? history.map((t) => `${t.role === "user" ? "User" : "Assistant"}: ${t.content}`).join("\n")
    : "(no prior turns)";
  return `You are editing a corporate training proposal for Vizuara Technologies. The document is a LaTeX file. The user is iterating on it and just gave you a new instruction.

## Current LaTeX source

<latex>
${currentLatex}
</latex>

## Conversation so far

${convo}

## New instruction from the user

${instruction}

## Your task

Apply the user's instruction to the LaTeX source. Keep everything else exactly the same unless the instruction implies otherwise. Preserve the overall structure, style (vizblue/vizlight colors, fonts, section layout), Contact Us block, and all \\IfFileExists logo guards.

If the instruction is unclear or would produce an inconsistent document, make the most sensible interpretation and note it in the summary.

Return EXACTLY this format and nothing else:

<summary>ONE short sentence (max 20 words) describing what you changed, in past tense.</summary>
<latex>
\\documentclass...
...full updated LaTeX document...
\\end{document}
</latex>

Rules:
- The LaTeX must compile with pdflatex.
- Do not drop required packages or redefine colors.
- Escape % & $ # _ { } in any user-supplied strings.
- No emojis. No markdown fences. No commentary outside the two tags.`;
}

export async function POST(req: NextRequest) {
  try {
    const { clientName, instruction, history } = await req.json();
    if (!clientName) return NextResponse.json({ error: "clientName required" }, { status: 400 });
    if (!instruction?.toString().trim())
      return NextResponse.json({ error: "instruction required" }, { status: 400 });

    const slug = slugify(clientName);
    const store = getStorage();
    if (!(await store.exists(`${slug}/proposal.tex`))) {
      return NextResponse.json(
        { error: `proposal.tex not found — generate the first draft before revising.` },
        { status: 400 }
      );
    }
    const currentLatex = await store.getText(`${slug}/proposal.tex`);

    const prompt = buildRevisionPrompt(currentLatex, history ?? [], String(instruction));
    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = resp.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No text response" }, { status: 500 });
    }
    const raw = textBlock.text;
    const summaryMatch = raw.match(/<summary>([\s\S]*?)<\/summary>/);
    const latexMatch = raw.match(/<latex>([\s\S]*?)<\/latex>/);
    const fallbackLatex = latexMatch ? latexMatch[1] : raw.slice(raw.indexOf("\\documentclass"));
    if (!fallbackLatex || !fallbackLatex.includes("\\documentclass")) {
      return NextResponse.json(
        { error: "Claude did not return valid LaTeX", raw: raw.slice(0, 500) },
        { status: 500 }
      );
    }

    const newLatex = guardLogoIncludes(fallbackLatex.trim(), clientName);
    const summary = summaryMatch?.[1]?.trim() || "Updated the proposal.";

    // Back up the previous tex for one-step undo
    try {
      await store.copy(`${slug}/proposal.tex`, `${slug}/proposal.prev.tex`);
    } catch {}
    await store.put(`${slug}/proposal.tex`, newLatex, "text/x-tex");

    return NextResponse.json({
      ok: true,
      summary,
      clientSlug: slug,
      texKey: `${slug}/proposal.tex`,
    });
  } catch (err: any) {
    console.error("revise-proposal error:", err);
    return NextResponse.json({ error: err?.message ?? "revision failed" }, { status: 500 });
  }
}
