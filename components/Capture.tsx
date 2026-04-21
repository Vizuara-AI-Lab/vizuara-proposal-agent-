"use client";

import { useRef, useState } from "react";

interface Props {
  onSubmit: (text: string, mode: "transcript" | "notes") => void;
  loading: boolean;
}

const SAMPLE_TRANSCRIPT = `Call with Acme Manufacturing, Tuesday 2pm.

Present: Priya Menon (Head of Digital), Raj (us), Anand Verma (their CTO).

Anand kicked off — said their engineering team of around 40 people has been experimenting with ChatGPT for about 6 months but they don't really know what they're doing. Priya added that they've been burning cycles re-writing the same prompts, and a few engineers built "random chatbot things" that aren't in production. She said they want to get serious about this.

Key stuff:
- They want their engineering team to understand the full stack — prompting, RAG, some idea of fine-tuning.
- Specifically: they want to build an internal assistant that their field service engineers can use to look up equipment manuals. Right now the engineers call the back office and ask them to search PDFs. Takes hours. Priya said this is their "flagship" use case.
- Also interested in agents — Anand mentioned they have a ticketing system that could be automated.
- Team: mix of ML engineers (maybe 5), rest are backend/full-stack devs. No one has done any serious LLM work.
- Timeline: they want to start end of next month. Priya was firm on this.
- Duration: they're thinking 5 days, in-person in Pune. Anand pushed for maybe a 6th day for a capstone.
- Participants: around 35-40.
- Budget didn't come up directly. Priya hinted "we've done similar trainings for around 8 lakhs" — so that's probably their anchor.

Priya is the decision maker. Anand is technically the champion. We should send the proposal by Friday because they want to loop in finance next week.

Action: send proposal. They asked for it tailored to their field service use case specifically.`;

  export default function Capture({ onSubmit, loading }: Props) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"transcript" | "notes">("notes");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (f: File) => {
    const content = await f.text();
    setText(content);
    setMode("transcript");
  };

  return (
    <div className="animate-in">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-serif text-viz-ink mb-2">
          What came out of the meeting?
        </h1>
        <p className="text-gray-600 leading-relaxed max-w-2xl">
          Paste a transcript, drop your notes, or just type what you remember. Don&apos;t worry
          about structure — we&apos;ll extract what&apos;s there, then ask you about what&apos;s missing.
        </p>
      </div>

      <div className="card p-5 md:p-6 mb-5">
        <div className="flex items-center gap-1 mb-4 p-1 bg-viz-light/50 rounded-lg w-fit">
          <ModeButton active={mode === "notes"} onClick={() => setMode("notes")}>
            My notes
          </ModeButton>
          <ModeButton active={mode === "transcript"} onClick={() => setMode("transcript")}>
            Full transcript
          </ModeButton>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            mode === "notes"
              ? "Just type what you remember. Names, the kind of training they want, team size, timeline, budget hints, anything they emphasized. Bullet points are fine. Half-finished sentences are fine."
              : "Paste the full meeting transcript here. We'll read through it and extract what matters."
          }
          rows={mode === "notes" ? 10 : 16}
          className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-[15px] leading-relaxed resize-y focus:border-viz-navy"
        />

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => onSubmit(text, mode)}
            disabled={loading || text.trim().length < 20}
            className="px-5 py-2.5 rounded-lg bg-viz-navy text-white text-sm font-medium hover:bg-viz-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <ThinkingDots />
                Reading through this…
              </span>
            ) : (
              "Extract what's there →"
            )}
          </button>

          <input
            ref={fileRef}
            type="file"
            accept=".txt,.md,.vtt,.srt"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="text-sm text-viz-navy/80 hover:text-viz-navy underline underline-offset-4"
          >
            or upload a file
          </button>

          <button
            onClick={() => {
              setText(SAMPLE_TRANSCRIPT);
              setMode("notes");
            }}
            className="text-sm text-gray-500 hover:text-viz-navy underline underline-offset-4 ml-auto"
          >
            use sample notes
          </button>
        </div>
      </div>

      <div className="text-[13px] text-gray-500 max-w-2xl">
        <span className="font-medium text-viz-ink">Tip.</span>{" "}
        The more specifics you remember — even half-sentences like &ldquo;Priya said their team is 40 people&rdquo;
        — the better the proposal. We&apos;ll probe you for the rest.
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors ${
        active ? "bg-white text-viz-navy shadow-sm" : "text-gray-600 hover:text-viz-ink"
      }`}
    >
      {children}
    </button>
  );
}

function ThinkingDots() {
  return (
    <span className="flex gap-1">
      <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-white/90" />
      <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-white/90" />
      <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-white/90" />
    </span>
  );
}
