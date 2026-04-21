"use client";

import { useEffect, useRef, useState } from "react";
import { FIELDS, FieldDef, isEmpty, completionStats } from "@/lib/fields";
import type { ProbeQuestion } from "@/lib/types";
import FieldInput from "./FieldInput";

interface Props {
  values: Record<string, string>;
  confidence: Record<string, "high" | "medium" | "low">;
  notes: string[];
  transcript: string;
  onUpdate: (id: string, v: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

export default function Probe({
  values,
  confidence,
  notes,
  transcript,
  onUpdate,
  onContinue,
  onBack,
}: Props) {
  const [questions, setQuestions] = useState<ProbeQuestion[]>([]);
  const [loadingProbe, setLoadingProbe] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    (async () => {
      try {
        const r = await fetch("/api/probe", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ values, confidence, transcript }),
        });
        const data = await r.json();
        setQuestions(data.questions ?? []);
      } catch (e) {
        // Fallback to default field questions
        setQuestions(
          FIELDS.filter((f) => f.critical && isEmpty(values[f.id])).map((f) => ({
            fieldId: f.id,
            question: f.question,
          }))
        );
      } finally {
        setLoadingProbe(false);
      }
    })();
  }, []); // run once

  const extracted = FIELDS.filter((f) => !isEmpty(values[f.id]));
  const stats = completionStats(values);
  const criticalMissing = FIELDS.filter((f) => f.critical && isEmpty(values[f.id])).length;

  return (
    <div className="animate-in">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-serif text-viz-ink mb-2">
          Here&apos;s what I caught.
        </h1>
        <p className="text-gray-600 leading-relaxed max-w-2xl">
          I pulled out {extracted.length} field{extracted.length === 1 ? "" : "s"} from what you gave me.
          {criticalMissing > 0 ? (
            <>
              {" "}Below are {criticalMissing} thing{criticalMissing === 1 ? "" : "s"} I still need —
              take a minute and think back to the meeting.
            </>
          ) : (
            <> Everything critical is captured. A couple of optional probes follow.</>
          )}
        </p>
      </div>

      {/* Notes pulled from the meeting */}
      {notes && notes.length > 0 && (
        <div className="card p-5 mb-5 bg-viz-light/40">
          <div className="text-[12px] uppercase tracking-wider text-viz-navy font-semibold mb-2">
            Context I noticed
          </div>
          <ul className="space-y-1.5 text-[14px] text-viz-ink">
            {notes.map((n, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-viz-navy/60 mt-1">•</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* What I extracted — compact scannable list */}
      {extracted.length > 0 && (
        <div className="card p-5 mb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-[12px] uppercase tracking-wider text-viz-navy font-semibold">
              Captured from the meeting
            </div>
            <div className="text-[12px] text-gray-500">
              {stats.requiredFilled}/{stats.required} required · {stats.filled}/{stats.total} total
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
            {extracted.map((f) => (
              <FieldInput
                key={f.id}
                field={f}
                value={values[f.id]}
                confidence={confidence[f.id]}
                onChange={(v) => onUpdate(f.id, v)}
                compact
              />
            ))}
          </div>
        </div>
      )}

      {/* The probe questions */}
      <div className="card p-5 md:p-6 mb-5 border-viz-warm/40">
        <div className="flex items-center gap-2 mb-1">
          <div className="text-[12px] uppercase tracking-wider text-viz-warm font-semibold">
            Things I&apos;d like you to remember
          </div>
        </div>
        <p className="text-[13px] text-gray-500 mb-5">
          Answer what you can. Skip what genuinely didn&apos;t come up — we&apos;ll flag it as an open
          question in the proposal.
        </p>

        {loadingProbe ? (
          <div className="py-8 flex items-center justify-center text-gray-400 text-sm">
            <span className="flex gap-1 mr-3">
              <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-viz-navy/50" />
              <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-viz-navy/50" />
              <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-viz-navy/50" />
            </span>
            Thinking of the right questions to ask you…
          </div>
        ) : (
          <div className="space-y-6">
            {questions.map((q, idx) => {
              const field = FIELDS.find((f) => f.id === q.fieldId);
              if (!field) return null;
              return (
                <ProbeQuestionBlock
                  key={q.fieldId}
                  index={idx}
                  question={q}
                  field={field}
                  value={values[field.id]}
                  onChange={(v) => onUpdate(field.id, v)}
                />
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-between items-center mt-8">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-viz-ink underline underline-offset-4"
        >
          ← back to capture
        </button>
        <button
          onClick={onContinue}
          className="px-5 py-2.5 rounded-lg bg-viz-navy text-white text-sm font-medium hover:bg-viz-ink transition-colors"
        >
          Review everything →
        </button>
      </div>
    </div>
  );
}

function ProbeQuestionBlock({
  index,
  question,
  field,
  value,
  onChange,
}: {
  index: number;
  question: ProbeQuestion;
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="border-l-2 border-viz-warm/60 pl-4 py-1">
      <div className="flex gap-3 mb-2">
        <div className="w-5 h-5 shrink-0 rounded-full bg-viz-warm/20 flex items-center justify-center text-[11px] text-viz-warm font-semibold mt-0.5">
          {index + 1}
        </div>
        <div>
          <p className="text-[15px] text-viz-ink leading-snug">{question.question}</p>
          {question.hint && (
            <p className="text-[12px] text-gray-500 italic mt-1">{question.hint}</p>
          )}
        </div>
      </div>
      <div className="ml-8">
        {field.type === "select" ? (
          <select
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:border-viz-navy"
          >
            <option value="">— choose —</option>
            {field.options?.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        ) : field.type === "longtext" ? (
          <textarea
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm resize-y focus:border-viz-navy"
          />
        ) : (
          <input
            type="text"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:border-viz-navy"
          />
        )}
      </div>
    </div>
  );
}
