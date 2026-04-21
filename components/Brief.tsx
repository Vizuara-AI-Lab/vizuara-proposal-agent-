"use client";

import { FIELDS, GROUP_ORDER, GROUP_LABELS } from "@/lib/fields";

interface Props {
  values: Record<string, string>;
  notes: string[];
  savedInfo: { clientSlug: string; briefKey: string; markdownKey: string };
  onContinue: () => void;
  onBack: () => void;
}

export default function Brief({ values, notes, savedInfo, onContinue, onBack }: Props) {
  return (
    <div className="animate-in">
      <div className="mb-6">
        <div className="pill bg-emerald-50 text-emerald-700 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Brief saved
        </div>
        <h1 className="text-3xl md:text-4xl font-serif text-viz-ink mb-2">
          Brief looks solid.
        </h1>
        <p className="text-gray-600 leading-relaxed max-w-2xl">
          Quick look at what we have. When it&apos;s right, move on to drafting — the proposal is
          generated and compiled right here, no tools needed.
        </p>
      </div>

      {/* Drive cross-check reminder */}
      <div className="card p-5 mb-5 border-viz-warm/40 bg-viz-warm/5">
        <div className="flex items-start gap-3">
          <div className="w-5 h-5 shrink-0 rounded-full bg-viz-warm/20 flex items-center justify-center text-viz-warm text-[11px] font-semibold mt-0.5">
            !
          </div>
          <div className="flex-1">
            <div className="text-[13px] font-semibold text-viz-ink mb-1">
              Meet transcript cross-check
            </div>
            <p className="text-[13px] text-gray-600 leading-relaxed">
              {values.meetingDate ? (
                <>
                  On the next step we&apos;ll scan the Drive archive for transcripts matching{" "}
                  <strong className="text-viz-ink">{values.clientName}</strong> on{" "}
                  <strong className="text-viz-ink">{values.meetingDate}</strong>
                  {values.meetingTime ? <> at <strong className="text-viz-ink">{values.meetingTime}</strong></> : null}
                  {" "}and pull in anything you forgot.
                </>
              ) : (
                <>
                  No meeting date captured — we&apos;ll skip the transcript cross-check. Go back to
                  Review if you want to add one.
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Readable brief summary */}
      <div className="card p-5 md:p-6 mb-5">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm uppercase tracking-wider text-viz-navy font-semibold">
            Brief summary
          </h2>
          <div className="text-[11px] text-gray-400 font-mono">
            {savedInfo.clientSlug}
          </div>
        </div>
        <div className="space-y-5">
          {GROUP_ORDER.map((g) => {
            const fields = FIELDS.filter((f) => f.group === g && values[f.id]?.trim());
            if (!fields.length) return null;
            return (
              <div key={g}>
                <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-2">
                  {GROUP_LABELS[g]}
                </h3>
                <dl className="space-y-1.5">
                  {fields.map((f) => (
                    <div key={f.id} className="flex gap-3 text-[14px]">
                      <dt className="text-gray-500 w-44 shrink-0">{f.label}</dt>
                      <dd className="text-viz-ink flex-1 leading-snug">{values[f.id]}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}

          {notes && notes.length > 0 && (
            <div>
              <h3 className="text-[11px] uppercase tracking-wider text-gray-400 font-semibold mb-2">
                Meeting context
              </h3>
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
        </div>
      </div>

      <div className="flex justify-between items-center mt-8">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-viz-ink underline underline-offset-4"
        >
          ← back to review
        </button>
        <button
          onClick={onContinue}
          className="px-5 py-2.5 rounded-lg bg-viz-navy text-white text-sm font-medium hover:bg-viz-ink transition-colors"
        >
          Draft the proposal →
        </button>
      </div>
    </div>
  );
}
