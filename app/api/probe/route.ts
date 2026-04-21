import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { FIELDS, isEmpty, FieldDef } from "@/lib/fields";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-5-20250929";

function pickFieldsToProbe(values: Record<string, string>, confidence: Record<string, string>): FieldDef[] {
  const toProbe: FieldDef[] = [];
  for (const f of FIELDS) {
    const empty = isEmpty(values[f.id]);
    const lowConf = confidence[f.id] === "low";
    if (f.critical && (empty || lowConf)) toProbe.push(f);
    else if (f.required && empty) toProbe.push(f);
  }
  // Then add non-critical required/optional that are empty
  for (const f of FIELDS) {
    if (toProbe.includes(f)) continue;
    if (isEmpty(values[f.id])) toProbe.push(f);
  }
  return toProbe;
}

function buildProbePrompt(
  transcript: string,
  values: Record<string, string>,
  fieldsToProbe: FieldDef[]
) {
  const knownContext = Object.entries(values)
    .filter(([, v]) => !isEmpty(v))
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  const toAsk = fieldsToProbe
    .map(
      (f) =>
        `- fieldId: "${f.id}"\n  default question: "${f.question}"\n  rationale: ${f.rationale}`
    )
    .join("\n");

  return `You are a senior sales consultant helping a Vizuara team member recall missing details from a client meeting they just had.

The team member already shared this (either a transcript or their written notes):

<source>
${transcript || "(nothing provided — they skipped the initial capture step)"}
</source>

Here's what we already know about the deal:

${knownContext || "(nothing captured yet)"}

We still need these fields. For each, rewrite the default question so it's:
1. **Conversational** — like a smart colleague probing gently, not a form.
2. **Context-aware** — reference what they DID say to jog their memory. e.g. "You mentioned their data team is only 5 people — did they say which ones would actually attend?"
3. **Specific** — avoid vague questions. Give examples or prompts. e.g. "Any hints about budget? Even 'they said it can't exceed X' or 'they seemed price-sensitive' helps."
4. **Memory-jogging** — for the kind of thing people easily forget (timeline, decision maker, specific use cases mentioned in passing), ask in a way that nudges recall.
5. **Short** — one or two sentences max.

Fields to probe:

${toAsk}

Return ONLY valid JSON:

{
  "questions": [
    { "fieldId": "<id>", "question": "<rewritten conversational question>", "hint": "<optional one-line hint with an example answer>" },
    ...
  ]
}

Keep the order of fields as given. Do NOT invent fieldIds.`;
}

export async function POST(req: NextRequest) {
  try {
    const { transcript, values, confidence } = await req.json();
    const fieldsToProbe = pickFieldsToProbe(values ?? {}, confidence ?? {});

    if (fieldsToProbe.length === 0) {
      return NextResponse.json({ questions: [] });
    }

    const prompt = buildProbePrompt(transcript ?? "", values ?? {}, fieldsToProbe);

    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = resp.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No text response" }, { status: 500 });
    }

    const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Fallback: return default questions if LLM output was unparseable.
      return NextResponse.json({
        questions: fieldsToProbe.map((f) => ({
          fieldId: f.id,
          question: f.question,
        })),
      });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("probe error:", err);
    return NextResponse.json(
      { error: err?.message ?? "probe failed" },
      { status: 500 }
    );
  }
}
