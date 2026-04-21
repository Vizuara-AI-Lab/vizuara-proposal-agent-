"use client";

import { FIELDS, GROUP_ORDER, GROUP_LABELS, completionStats, isEmpty, missingCriticalFields } from "@/lib/fields";
import FieldInput from "./FieldInput";

interface Props {
  values: Record<string, string>;
  confidence: Record<string, "high" | "medium" | "low">;
  onUpdate: (id: string, v: string) => void;
  onSave: () => void;
  onBack: () => void;
  saving: boolean;
}

export default function Review({ values, confidence, onUpdate, onSave, onBack, saving }: Props) {
  const stats = completionStats(values);
  const missing = missingCriticalFields(values);

  return (
    <div className="animate-in">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-serif text-viz-ink mb-2">
          Full brief — review &amp; refine.
        </h1>
        <p className="text-gray-600 leading-relaxed max-w-2xl">
          Everything we have so far, in one view. Edit anything that&apos;s off. When it looks right, save it —
          then you can run <code className="px-1.5 py-0.5 bg-viz-light rounded text-[12px]">/draft-proposal</code>{" "}
          to generate the LaTeX.
        </p>
      </div>

      {/* Completion bar */}
      <div className="card p-4 mb-5 flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[13px] font-medium text-viz-ink">
              {stats.requiredFilled} of {stats.required} required fields captured
            </span>
            <span className="text-[12px] text-gray-500">
              {stats.filled}/{stats.total} total
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-viz-navy transition-all"
              style={{ width: `${stats.requiredPct}%` }}
            />
          </div>
        </div>
        {missing.length > 0 && (
          <div className="pill bg-amber-50 text-amber-700">
            {missing.length} critical missing
          </div>
        )}
      </div>

      {GROUP_ORDER.map((group) => {
        const fields = FIELDS.filter((f) => f.group === group);
        return (
          <div key={group} className="card p-5 md:p-6 mb-5">
            <h2 className="text-sm uppercase tracking-wider text-viz-navy font-semibold mb-5">
              {GROUP_LABELS[group]}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
              {fields.map((f) => {
                const empty = isEmpty(values[f.id]);
                const flagged = f.critical && empty;
                return (
                  <div
                    key={f.id}
                    className={flagged ? "p-3 -m-3 rounded-lg bg-amber-50/40" : ""}
                  >
                    <FieldInput
                      field={f}
                      value={values[f.id] ?? ""}
                      confidence={confidence[f.id]}
                      onChange={(v) => onUpdate(f.id, v)}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      <div className="flex justify-between items-center mt-8">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-viz-ink underline underline-offset-4"
        >
          ← back to probe
        </button>
        <button
          onClick={onSave}
          disabled={saving || !values.clientName?.trim()}
          className="px-5 py-2.5 rounded-lg bg-viz-navy text-white text-sm font-medium hover:bg-viz-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? "Saving…" : "Save brief →"}
        </button>
      </div>
    </div>
  );
}
