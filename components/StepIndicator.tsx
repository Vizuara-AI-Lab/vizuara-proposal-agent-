"use client";

const STEPS = [
  { key: "capture", label: "Capture" },
  { key: "probe", label: "Probe" },
  { key: "review", label: "Review" },
  { key: "brief", label: "Brief" },
  { key: "generate", label: "Generate" },
];

export default function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-2 md:gap-3 mb-10 mt-2">
      {STEPS.map((s, i) => {
        const active = i === current;
        const done = i < current;
        return (
          <div key={s.key} className="flex items-center gap-2 md:gap-3">
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                active
                  ? "bg-viz-navy text-white shadow-sm"
                  : done
                  ? "bg-viz-navy/10 text-viz-navy"
                  : "bg-transparent text-gray-400"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold ${
                  active
                    ? "bg-white/20 text-white"
                    : done
                    ? "bg-viz-navy text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className="hidden sm:inline">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`w-4 md:w-8 h-px ${
                  done ? "bg-viz-navy/40" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
