import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const maxDuration = 60;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-5-20250929";

function buildEmailPrompt(params: {
  values: Record<string, string>;
  notes: string[];
  priorBody?: string;
  instruction?: string;
}) {
  const { values, notes, priorBody, instruction } = params;
  const facts: string[] = [];
  const v = values;
  if (v.clientName) facts.push(`Client: ${v.clientName}`);
  if (v.clientContacts) facts.push(`People in the meeting: ${v.clientContacts}`);
  if (v.trainingTopic) facts.push(`Topic: ${v.trainingTopic}`);
  if (v.duration) facts.push(`Duration: ${v.duration}`);
  if (v.format) facts.push(`Format: ${v.format}`);
  if (v.participantCount) facts.push(`Participants: ${v.participantCount}`);
  if (v.timeline) facts.push(`Training start: ${v.timeline}`);
  if (v.meetingDate) facts.push(`We met on: ${v.meetingDate}${v.meetingTime ? ` at ${v.meetingTime}` : ""}`);
  if (v.proposalDeadline) facts.push(`They want the proposal by: ${v.proposalDeadline}`);
  if (v.relationshipStatus) facts.push(`Relationship: ${v.relationshipStatus}`);

  const noteBlock = notes?.length ? `\nMeeting context:\n- ${notes.join("\n- ")}` : "";

  const refinementBlock = priorBody
    ? `\n\n## Current draft to revise\n\n<body>\n${priorBody}\n</body>\n\n## Instruction\n\n${instruction || "Improve the email."}`
    : "";

  return `You are drafting a cover email from Vizuara Technologies to a B2B client, to accompany a training proposal (attached as a PDF).

## Raj's email style rules (STRICT)

- **60–100 words maximum** in the body (excluding signature). Scannable in under 20 seconds.
- **Not salesy.** No marketing bullets, no selling the program, no adjectives like "exciting", "cutting-edge", "revolutionary". State what's attached. That's it.
- **Not desperate.** Do NOT write "happy to schedule a call", "looking forward to hearing from you", "please don't hesitate", or any eager follow-up language. Use a plain "Do let us know if you have any questions." at most.
- **Direct.** One short opening line → one short paragraph on what's attached and the core ask → brief close.
- **Reference the meeting** naturally if a date was shared.
- **No emojis. No markdown.** Plain text only.
- The PDF is attached separately, do NOT invent a link to it. Just say something like "Attached is the proposal…".

## Context

${facts.join("\n")}${noteBlock}${refinementBlock}

## Output

Return ONLY valid JSON, no prose, no markdown fences:

{
  "subject": "<short subject line, 5-10 words, no 'Re:' prefix>",
  "body": "<email body, plain text, no signature — paragraphs separated by blank lines>",
  "signature": "<sign-off block — name, role, email hello@vizuara.com, website www.vizuara.ai. NO phone number.>",
  "recipient_guess": "<if a likely recipient name is in the context, put it here; otherwise empty string>"
}`;
}

export async function POST(req: NextRequest) {
  try {
    const { values, notes, priorBody, instruction } = await req.json();
    if (!values?.clientName) {
      return NextResponse.json({ error: "clientName required" }, { status: 400 });
    }

    const prompt = buildEmailPrompt({ values, notes: notes ?? [], priorBody, instruction });

    const resp = await client.messages.create({
      model: MODEL,
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = resp.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No text response" }, { status: 500 });
    }
    const m = textBlock.text.match(/\{[\s\S]*\}/);
    if (!m) {
      return NextResponse.json(
        { error: "No JSON in response", raw: textBlock.text.slice(0, 500) },
        { status: 500 }
      );
    }
    const parsed = JSON.parse(m[0]);
    return NextResponse.json({
      ok: true,
      subject: parsed.subject ?? "",
      body: parsed.body ?? "",
      signature: parsed.signature ?? "",
      recipient_guess: parsed.recipient_guess ?? "",
    });
  } catch (err: any) {
    console.error("draft-email error:", err);
    return NextResponse.json({ error: err?.message ?? "draft failed" }, { status: 500 });
  }
}
