"use client";

import type { FieldDef } from "@/lib/fields";

interface Props {
  field: FieldDef;
  value: string;
  confidence?: "high" | "medium" | "low";
  onChange: (v: string) => void;
  compact?: boolean;
}

export default function FieldInput({ field, value, confidence, onChange, compact }: Props) {
  const isFilled = value.trim().length > 0;

  return (
    <div className={compact ? "" : "space-y-1.5"}>
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-medium text-viz-ink">
          {field.label}
          {field.critical && !isFilled && (
            <span className="ml-1.5 text-[11px] text-amber-700 font-normal">· required</span>
          )}
        </label>
        {confidence && isFilled && (
          <ConfidencePill level={confidence} />
        )}
      </div>
      {!compact && field.rationale && (
        <p className="text-[12px] text-gray-500 leading-snug">{field.rationale}</p>
      )}
      {field.type === "select" ? (
        <select
          value={value}
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={compact ? 2 : 3}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm resize-y focus:border-viz-navy"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:border-viz-navy"
        />
      )}
    </div>
  );
}

function ConfidencePill({ level }: { level: "high" | "medium" | "low" }) {
  const map = {
    high: { bg: "bg-emerald-50", fg: "text-emerald-700", label: "from meeting" },
    medium: { bg: "bg-amber-50", fg: "text-amber-700", label: "inferred" },
    low: { bg: "bg-rose-50", fg: "text-rose-700", label: "uncertain" },
  }[level];
  return (
    <span className={`pill ${map.bg} ${map.fg}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {map.label}
    </span>
  );
}
