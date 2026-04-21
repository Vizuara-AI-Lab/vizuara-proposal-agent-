"use client";

import { useState } from "react";
import StepIndicator from "@/components/StepIndicator";
import Capture from "@/components/Capture";
import Probe from "@/components/Probe";
import Review from "@/components/Review";
import Brief from "@/components/Brief";
import Generate from "@/components/Generate";
import { emptyValues } from "@/lib/fields";

type Step = 0 | 1 | 2 | 3 | 4;

export default function Page() {
  const [step, setStep] = useState<Step>(0);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);

  const [transcript, setTranscript] = useState("");
  const [sourceMode, setSourceMode] = useState<"transcript" | "notes">("notes");
  const [values, setValues] = useState<Record<string, string>>(emptyValues());
  const [confidence, setConfidence] = useState<Record<string, "high" | "medium" | "low">>({});
  const [notes, setNotes] = useState<string[]>([]);
  const [savedInfo, setSavedInfo] = useState<{
    clientSlug: string;
    outputDir: string;
    briefPath: string;
    markdownPath: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleExtract = async (text: string, mode: "transcript" | "notes") => {
    setError(null);
    setTranscript(text);
    setSourceMode(mode);
    setExtracting(true);
    try {
      const r = await fetch("/api/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript: text, mode }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "extraction failed");
      setValues(data.values);
      setConfidence(data.confidence ?? {});
      setNotes(data.notes ?? []);
      setStep(1);
    } catch (e: any) {
      setError(e?.message ?? "Something went wrong");
    } finally {
      setExtracting(false);
    }
  };

  const updateField = (id: string, v: string) => {
    setValues((prev) => ({ ...prev, [id]: v }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/save", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values, transcript, sourceMode, notes }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "save failed");
      setSavedInfo(data);
      setStep(3);
    } catch (e: any) {
      setError(e?.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  };

  const restart = () => {
    setStep(0);
    setTranscript("");
    setValues(emptyValues());
    setConfidence({});
    setNotes([]);
    setSavedInfo(null);
    setError(null);
  };

  return (
    <main className="min-h-screen">
      <header className="border-b border-gray-200/70 bg-white/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-md bg-viz-navy flex items-center justify-center text-white font-serif text-[15px]">
              V
            </div>
            <div className="leading-tight">
              <div className="text-[14px] font-semibold text-viz-ink">Vizuara</div>
              <div className="text-[11px] text-gray-500 -mt-0.5">Proposal intake</div>
            </div>
          </div>
          <div className="text-[12px] text-gray-500 hidden md:block">
            Meeting → brief → PDF, end-to-end
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 md:px-6 py-10 md:py-14">
        <StepIndicator current={step} />

        {error && (
          <div className="mb-6 px-4 py-3 rounded-lg bg-rose-50 text-rose-700 text-sm border border-rose-100">
            {error}
          </div>
        )}

        {step === 0 && <Capture onSubmit={handleExtract} loading={extracting} />}
        {step === 1 && (
          <Probe
            values={values}
            confidence={confidence}
            notes={notes}
            transcript={transcript}
            onUpdate={updateField}
            onContinue={() => setStep(2)}
            onBack={() => setStep(0)}
          />
        )}
        {step === 2 && (
          <Review
            values={values}
            confidence={confidence}
            onUpdate={updateField}
            onSave={handleSave}
            onBack={() => setStep(1)}
            saving={saving}
          />
        )}
        {step === 3 && savedInfo && (
          <Brief
            values={values}
            notes={notes}
            savedInfo={savedInfo}
            onContinue={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}
        {step === 4 && savedInfo && (
          <Generate
            values={values}
            notes={notes}
            clientSlug={savedInfo.clientSlug}
            onBack={() => setStep(3)}
            onRestart={restart}
          />
        )}
      </div>

      <footer className="max-w-4xl mx-auto px-6 py-8 text-center text-[11px] text-gray-400">
        Vizuara Technologies · proposal intake
      </footer>
    </main>
  );
}
