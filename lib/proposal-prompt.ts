import fs from "node:fs/promises";
import { FIELDS, GROUP_LABELS, GROUP_ORDER } from "./fields";

export async function loadStyleGuide(): Promise<string> {
  const p = process.env.PROPOSAL_STYLE_GUIDE || "/Users/raj/Desktop/Proposal Agent/style.md";
  try {
    return await fs.readFile(p, "utf-8");
  } catch {
    return "";
  }
}

function renderBriefForPrompt(values: Record<string, string>, notes: string[]) {
  const lines: string[] = [];
  for (const g of GROUP_ORDER) {
    const fs = FIELDS.filter((f) => f.group === g && values[f.id]?.trim());
    if (!fs.length) continue;
    lines.push(`### ${GROUP_LABELS[g]}`);
    for (const f of fs) lines.push(`- ${f.label}: ${values[f.id]}`);
    lines.push("");
  }
  if (notes?.length) {
    lines.push(`### Additional meeting context`);
    for (const n of notes) lines.push(`- ${n}`);
  }
  return lines.join("\n");
}

export function buildProposalPrompt(params: {
  styleGuide: string;
  values: Record<string, string>;
  notes: string[];
  transcriptExcerpts?: { name: string; text: string }[];
  useLogos: { vizuara: boolean; client: boolean };
}) {
  const { styleGuide, values, notes, transcriptExcerpts, useLogos } = params;
  const brief = renderBriefForPrompt(values, notes);
  const clientName = values.clientName || "CLIENT";
  const country = values.clientCountry || "India";
  const indianClient = country.toLowerCase().includes("india");

  // Always use \IfFileExists so a missing logo at compile time falls back to text.
  // This is robust even if the user uploads/removes logos between generation and compile.
  const vizImage = `\\IfFileExists{vizuara_logo.png}{\\includegraphics[height=1.5cm]{vizuara_logo.png}}{\\IfFileExists{vizuara_logo.jpg}{\\includegraphics[height=1.5cm]{vizuara_logo.jpg}}{\\textbf{\\large Vizuara Technologies}}}`;
  const clientImage = `\\IfFileExists{client_logo.png}{\\includegraphics[height=1.5cm]{client_logo.png}}{\\IfFileExists{client_logo.jpg}{\\includegraphics[height=1.5cm]{client_logo.jpg}}{\\textbf{\\large ${clientName}}}}`;

  const transcriptBlock = transcriptExcerpts?.length
    ? `\n## Verified meeting transcript(s)\n\nThe following came from the Google Meet recording of this meeting. Prefer these over the team's summary when there is a conflict. Use them to pick up specific numbers, names, and use cases the team member may have missed.\n\n${transcriptExcerpts
        .map((t) => `### Source: ${t.name}\n\n${t.text.slice(0, 12000)}`)
        .join("\n\n")}\n`
    : "";

  return `You are drafting a corporate AI training proposal for Vizuara Technologies. Output ONLY valid LaTeX source, ready to compile with pdflatex — no commentary, no markdown, no fences.

## Style guide (must follow exactly)

${styleGuide}

## The brief

Client name: ${clientName}
Currency rule: ${indianClient ? "Indian client — quote INR with '+ GST' suffix." : "International client — no GST note."}

${brief}
${transcriptBlock}

## Requirements

1. Choose archetype — Type A (Short-Form) for 1–12 day workshops/bootcamps; Type B (Long-Form) for multi-week / semester programs.
2. Title page MUST include these image/logo placements at the top:
   - Top-left: ${vizImage}
   - Top-right: ${clientImage}
3. Use \`${clientName}\` explicitly at least 4 times outside the title page — in curriculum customization, pricing, "Why choose Vizuara", and the footer.
4. Include at least 1–2 client-specific use cases in the curriculum, drawn from the brief's business problems.
5. Every session must include a hands-on component.
6. Pricing MUST be a \`booktabs\` table. Include tiered options by participant count when relevant. If the brief has no budget signal, propose three reasonable tiers.
7. Include a Contact Us block at the end with: Email: rajatdandekar@vizuara.com — Website: www.vizuara.ai — "Prepared for: ${clientName}" — and today's date.
8. NO emojis. NO markdown. NO prose outside the LaTeX source.
9. Use these packages: geometry, enumitem, booktabs, colortbl, xcolor, graphicx, hyperref, fancyhdr, titlesec, tcolorbox, longtable.
10. Define colors: \`vizblue = HTML 1B3A5C\`, \`vizlight = HTML E8EDF2\`.
11. Escape special LaTeX characters in any user-supplied string (% & $ # _ { }).
12. Start with \\documentclass and end with \\end{document}. Nothing before or after.

Write the full LaTeX document now.`;
}
