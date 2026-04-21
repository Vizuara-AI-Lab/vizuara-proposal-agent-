import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { FIELDS, emptyValues } from "@/lib/fields";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL = "claude-sonnet-4-5-20250929";

function buildExtractionPrompt(transcript: string, mode: "transcript" | "notes") {
  const fieldDocs = FIELDS.map((f) => {
    const opts = f.options ? ` Valid options: ${f.options.join(" | ")}.` : "";
    return `- **${f.id}** (${f.label}): ${f.rationale}${opts}`;
  }).join("\n");

  const sourceLabel =
    mode === "transcript"
      ? "a raw meeting transcript (possibly long, unstructured, with filler)"
      : "brief meeting notes written in a hurry (may be terse, fragmented, or in shorthand)";

  return `You are an intake analyst for Vizuara Technologies, a corporate AI training company. You are reading ${sourceLabel} from a sales/discovery meeting with a prospective B2B client.

Your job: extract every field below that is explicitly stated OR can be confidently inferred. Do NOT guess wildly — if something is vague, leave it empty and we'll ask the user a follow-up question.

## Fields to extract

${fieldDocs}

## Source text

<source>
${transcript}
</source>

## Output

Return ONLY valid JSON, no prose, matching this schema exactly:

{
  "values": { "<fieldId>": "<extracted string, or empty string if not mentioned>", ... },
  "confidence": { "<fieldId>": "high" | "medium" | "low" },
  "notes": ["<any important context that didn't fit a field, e.g. sentiment, concerns raised, competitors mentioned>"]
}

Rules:
- Include every fieldId from the list above in "values" (use "" if not mentioned).
- "high" confidence = explicitly stated. "medium" = strongly implied. "low" = weak inference.
- For select-type fields, match one of the valid options exactly, or leave empty.
- For "businessProblems" and "customProjects", quote specific examples the client mentioned, even in passing.
- For "clientCountry", default to "India" if any Indian city, INR price, or Indian name is mentioned — unless clearly international.
- For "currency", infer INR (+ GST) for Indian clients, USD otherwise.
- For "meetingDate" and "meetingTime", extract the date/time of the meeting itself (when the call happened), not the timeline for the training. Normalize dates to YYYY-MM-DD when possible. If only a relative reference is given ("Tuesday", "last week"), keep it verbatim so the user can confirm.
- "notes" should capture things like: the client's biggest concern, competitors they mentioned, internal politics, or the mood of the meeting.
- Do not invent details. Empty string is always better than a made-up answer.`;
}

export async function POST(req: NextRequest) {
  try {
    const { transcript, mode } = await req.json();
    if (!transcript || typeof transcript !== "string") {
      return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
    }

    const prompt = buildExtractionPrompt(transcript, mode ?? "transcript");

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
      return NextResponse.json(
        { error: "No JSON in response", raw: textBlock.text },
        { status: 500 }
      );
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Ensure every field exists in the response (defensive)
    const values = { ...emptyValues(), ...parsed.values };
    return NextResponse.json({
      values,
      confidence: parsed.confidence ?? {},
      notes: parsed.notes ?? [],
    });
  } catch (err: any) {
    console.error("extract error:", err);
    return NextResponse.json(
      { error: err?.message ?? "extraction failed" },
      { status: 500 }
    );
  }
}
