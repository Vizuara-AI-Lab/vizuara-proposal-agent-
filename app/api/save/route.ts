import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { FIELDS, GROUP_ORDER, GROUP_LABELS } from "@/lib/fields";

export const runtime = "nodejs";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "unnamed-client";
}

function renderMarkdownBrief(
  values: Record<string, string>,
  transcript: string,
  sourceMode: string,
  notes: string[]
): string {
  const lines: string[] = [];
  lines.push(`# Proposal Brief: ${values.clientName || "(unnamed client)"}`);
  lines.push("");
  lines.push(`_Generated from intake UI on ${new Date().toISOString().slice(0, 10)}_`);
  lines.push("");

  for (const group of GROUP_ORDER) {
    const fieldsInGroup = FIELDS.filter((f) => f.group === group);
    const anyFilled = fieldsInGroup.some((f) => values[f.id]?.trim());
    if (!anyFilled) continue;
    lines.push(`## ${GROUP_LABELS[group]}`);
    lines.push("");
    for (const f of fieldsInGroup) {
      const v = values[f.id]?.trim();
      if (!v) continue;
      lines.push(`- **${f.label}:** ${v}`);
    }
    lines.push("");
  }

  if (notes && notes.length) {
    lines.push(`## Additional context from the meeting`);
    lines.push("");
    for (const n of notes) lines.push(`- ${n}`);
    lines.push("");
  }

  if (transcript?.trim()) {
    lines.push(`## Raw source (${sourceMode})`);
    lines.push("");
    lines.push("```");
    lines.push(transcript);
    lines.push("```");
  }

  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const { values, transcript, sourceMode, notes } = await req.json();
    const clientName = values?.clientName?.trim();
    if (!clientName) {
      return NextResponse.json({ error: "clientName is required" }, { status: 400 });
    }

    const slug = slugify(clientName);
    const outputDir =
      process.env.PROPOSAL_OUTPUT_DIR ||
      "/Users/raj/Desktop/Proposal Agent/output";
    const clientDir = path.join(outputDir, slug);
    await fs.mkdir(clientDir, { recursive: true });

    const briefJson = {
      clientSlug: slug,
      createdAt: new Date().toISOString(),
      sourceMode: sourceMode ?? "manual",
      values,
      notes: notes ?? [],
      transcript: transcript ?? "",
    };

    const jsonPath = path.join(clientDir, "brief.json");
    const mdPath = path.join(clientDir, "brief.md");
    await fs.writeFile(jsonPath, JSON.stringify(briefJson, null, 2), "utf-8");
    await fs.writeFile(
      mdPath,
      renderMarkdownBrief(values, transcript ?? "", sourceMode ?? "manual", notes ?? []),
      "utf-8"
    );

    return NextResponse.json({
      ok: true,
      clientSlug: slug,
      briefPath: jsonPath,
      markdownPath: mdPath,
      outputDir: clientDir,
    });
  } catch (err: any) {
    console.error("save error:", err);
    return NextResponse.json(
      { error: err?.message ?? "save failed" },
      { status: 500 }
    );
  }
}
