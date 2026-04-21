export interface Brief {
  values: Record<string, string>;
  transcript: string;
  sourceMode: "transcript" | "notes" | "manual";
  createdAt: string;
  clientSlug: string;
}

export interface ExtractResponse {
  values: Record<string, string>;
  confidence: Record<string, "high" | "medium" | "low">;
  notes: string[];
}

export interface ProbeQuestion {
  fieldId: string;
  question: string;
  hint?: string;
}

export interface ProbeResponse {
  questions: ProbeQuestion[];
}
