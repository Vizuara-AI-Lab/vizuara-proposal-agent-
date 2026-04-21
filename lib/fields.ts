/**
 * Complete field schema for a Vizuara corporate training proposal.
 *
 * Each field is what we ultimately need to hand off to the draft-proposal skill.
 * "required" = must have before a proposal can be drafted.
 * "critical" = propose-blocker (we probe aggressively if missing).
 * Questions are the prompts we show the user if the field is empty or vague.
 */

export type FieldType =
  | "text"
  | "longtext"
  | "number"
  | "select"
  | "multiselect";

export type FieldGroup =
  | "client"
  | "scope"
  | "logistics"
  | "commercials"
  | "customization"
  | "meta";

export interface FieldDef {
  id: string;
  label: string;
  group: FieldGroup;
  type: FieldType;
  required: boolean;
  critical: boolean;
  placeholder?: string;
  options?: string[];
  /** The question we use when probing the user for this field. Phrased conversationally. */
  question: string;
  /** Why we need this — shown as helper text. */
  rationale: string;
  /** Shown only when the field is partially captured but needs refinement. */
  refineQuestion?: string;
}

export const FIELDS: FieldDef[] = [
  // ---------- CLIENT ----------
  {
    id: "clientName",
    label: "Client company",
    group: "client",
    type: "text",
    required: true,
    critical: true,
    placeholder: "e.g. PACCAR India, Dell Technologies",
    question: "Which company is this proposal for?",
    rationale: "Used on the title page, in pricing, and throughout the proposal.",
  },
  {
    id: "clientIndustry",
    label: "Industry / sector",
    group: "client",
    type: "text",
    required: false,
    critical: false,
    placeholder: "e.g. Automotive, Semiconductors, Retail, Banking",
    question: "What industry are they in?",
    rationale: "Helps us tailor case studies and use cases in the curriculum.",
  },
  {
    id: "clientCountry",
    label: "Country / location",
    group: "client",
    type: "text",
    required: true,
    critical: false,
    placeholder: "e.g. India, USA, Japan",
    question: "Where are they based?",
    rationale: "Determines currency (INR vs USD) and whether GST applies.",
  },
  {
    id: "clientContacts",
    label: "Who was in the meeting (their side)",
    group: "client",
    type: "longtext",
    required: false,
    critical: false,
    placeholder: "Names, roles, and who's the decision maker",
    question:
      "Who did you meet with? Note their names, roles, and who the decision maker is.",
    rationale:
      "The cover email is addressed to the decision maker; their role shapes the tone.",
  },

  // ---------- SCOPE ----------
  {
    id: "trainingTopic",
    label: "Training topic / focus",
    group: "scope",
    type: "longtext",
    required: true,
    critical: true,
    placeholder:
      "e.g. Generative AI for business teams, LLMs from scratch, AI Agents, RAG systems",
    question: "What AI topics do they want covered?",
    rationale:
      "This is the backbone of the curriculum. Be specific — 'Generative AI' is different from 'LLMs from scratch' or 'AI Agents for automation'.",
    refineQuestion:
      "You mentioned the topic broadly. Can you get more specific — which sub-topics are in scope (e.g. RAG, fine-tuning, agents, prompt engineering, ML fundamentals)?",
  },
  {
    id: "audienceType",
    label: "Audience type",
    group: "scope",
    type: "select",
    required: true,
    critical: true,
    options: [
      "Business / non-technical teams",
      "Engineers with some AI background",
      "Data scientists / ML practitioners",
      "AI/ML research team",
      "Mixed audience",
      "Senior leadership",
    ],
    question: "Who are the participants?",
    rationale:
      "Determines the depth — business folks get intuition-first, AI teams get architectures and papers.",
  },
  {
    id: "audienceSkill",
    label: "Audience AI skill level",
    group: "scope",
    type: "select",
    required: true,
    critical: true,
    options: ["Beginner", "Intermediate", "Advanced", "Mixed"],
    question: "What's their current AI skill level?",
    rationale: "Shapes prerequisites and pace.",
  },
  {
    id: "businessProblems",
    label: "Business problems they want to solve",
    group: "scope",
    type: "longtext",
    required: true,
    critical: true,
    placeholder:
      "e.g. Automate PO processing, build internal FAQ chatbot, accelerate code reviews",
    question:
      "What specific business problems or use cases do they want their team to be able to tackle after the training?",
    rationale:
      "This is the single most important question — it drives curriculum customization. Probe for concrete examples they mentioned, even in passing.",
    refineQuestion:
      "Are there concrete problems they mentioned — even briefly? e.g. 'we waste 3 hours/day on X', 'our customer support team is overloaded'. Any hint helps.",
  },
  {
    id: "existingStack",
    label: "Their existing AI / tech stack",
    group: "scope",
    type: "longtext",
    required: false,
    critical: false,
    placeholder: "e.g. Already using OpenAI API, some exposure to LangChain",
    question: "What AI tools or stack do they already use, if any?",
    rationale:
      "Lets us build on what they have instead of starting from zero — and avoid re-teaching basics.",
  },

  // ---------- LOGISTICS ----------
  {
    id: "duration",
    label: "Duration",
    group: "logistics",
    type: "text",
    required: true,
    critical: true,
    placeholder: "e.g. 2 days, 5-day bootcamp, 3-month semester program",
    question: "How long is the training?",
    rationale:
      "Decides proposal archetype (short-form workshop vs. long-form semester program).",
  },
  {
    id: "format",
    label: "Format",
    group: "logistics",
    type: "select",
    required: true,
    critical: true,
    options: ["In-person", "Online (Zoom)", "Hybrid", "Self-paced + live"],
    question: "In-person, online, or hybrid?",
    rationale: "Changes the Mode field in the Training Overview box.",
  },
  {
    id: "location",
    label: "Location (if in-person)",
    group: "logistics",
    type: "text",
    required: false,
    critical: false,
    placeholder: "e.g. Pune office, Bangalore campus",
    question: "Where will it happen if in-person?",
    rationale: "For travel / logistics planning.",
  },
  {
    id: "participantCount",
    label: "Number of participants",
    group: "logistics",
    type: "text",
    required: true,
    critical: true,
    placeholder: "e.g. 25, 50-60, ~100",
    question: "How many people will attend?",
    rationale: "Drives pricing tiers and batch planning.",
  },
  {
    id: "batches",
    label: "Multiple batches?",
    group: "logistics",
    type: "text",
    required: false,
    critical: false,
    placeholder: "e.g. One batch, 3 batches of 20, staggered over 2 months",
    question: "Is it one batch or multiple?",
    rationale: "Affects scheduling and per-batch pricing.",
  },
  {
    id: "timeline",
    label: "When do they want to start?",
    group: "logistics",
    type: "text",
    required: true,
    critical: false,
    placeholder: "e.g. Mid-May 2026, end of Q2, 'as soon as possible'",
    question: "When do they want the training to start?",
    rationale:
      "Urgency affects prep time and whether we can accommodate their instructor preference.",
  },

  // ---------- COMMERCIALS ----------
  {
    id: "budget",
    label: "Budget indication",
    group: "commercials",
    type: "text",
    required: false,
    critical: true,
    placeholder: "e.g. Rs 5L range, $30k-50k, not discussed",
    question:
      "Did budget come up? Even a vague range or signal ('tight budget', 'not a concern') is valuable.",
    rationale:
      "We anchor pricing to what they can absorb. If it didn't come up, note that — we'll propose tiered options.",
  },
  {
    id: "currency",
    label: "Currency",
    group: "commercials",
    type: "select",
    required: true,
    critical: false,
    options: ["INR (+ GST)", "USD", "EUR", "GBP"],
    question: "Currency for pricing?",
    rationale: "INR for Indian clients (with GST), USD/EUR/GBP for international.",
  },
  {
    id: "pricingModel",
    label: "Pricing structure preference",
    group: "commercials",
    type: "select",
    required: false,
    critical: false,
    options: [
      "Flat program fee",
      "Per-participant pricing",
      "Tiered by participant count",
      "License-based (for self-paced)",
      "Not sure / leave it to us",
    ],
    question: "Any preferred pricing model?",
    rationale: "Most short-form workshops use flat fees; semester programs use tiered licenses.",
  },

  // ---------- CUSTOMIZATION ----------
  {
    id: "customProjects",
    label: "Client-specific projects / capstones",
    group: "customization",
    type: "longtext",
    required: false,
    critical: true,
    placeholder:
      "e.g. Build a FAQ chatbot on their internal docs, classify support tickets from their CRM",
    question:
      "Are there specific projects they want the team to build during the training — using their own data or systems?",
    rationale:
      "This is what separates a generic training from a 'tailored-for-you' training. At least one client-specific capstone dramatically raises proposal win rate.",
  },
  {
    id: "specialDeliverables",
    label: "Special deliverables beyond the standard set",
    group: "customization",
    type: "longtext",
    required: false,
    critical: false,
    placeholder:
      "e.g. Dedicated dashboard, progress reports, post-training mentoring hours",
    question:
      "Did they ask for anything beyond the standard deliverables (slides, code, certificates)?",
    rationale:
      "Long-form programs often include dashboards and progress reports. Short-form usually doesn't.",
  },
  {
    id: "instructorPreference",
    label: "Instructor preference",
    group: "customization",
    type: "select",
    required: false,
    critical: false,
    options: [
      "Dr. Raj Dandekar",
      "Dr. Sreedath Panat",
      "Pritam Kudale",
      "Rishal C.",
      "No preference — we pick",
    ],
    question: "Did they ask for a specific instructor?",
    rationale: "Some clients specifically ask for co-founders to lead.",
  },

  // ---------- META ----------
  {
    id: "meetingDate",
    label: "Meeting date",
    group: "meta",
    type: "text",
    required: true,
    critical: true,
    placeholder: "e.g. 2026-04-18, Tue last week",
    question: "What date was the meeting?",
    rationale:
      "Used to cross-check the Google Drive transcript archive before drafting the proposal.",
  },
  {
    id: "meetingTime",
    label: "Meeting time",
    group: "meta",
    type: "text",
    required: false,
    critical: false,
    placeholder: "e.g. 2 PM IST, morning, 10:30",
    question: "Roughly what time?",
    rationale: "Narrows down the right Meet transcript if multiple happened that day.",
  },
  {
    id: "relationshipStatus",
    label: "Relationship with client",
    group: "meta",
    type: "select",
    required: false,
    critical: false,
    options: [
      "Cold (first meeting)",
      "Warm intro",
      "Existing client, new engagement",
      "Existing client, renewal",
    ],
    question: "What's our relationship with this client?",
    rationale: "Cold meetings need more 'About Vizuara' context; existing clients don't.",
  },
  {
    id: "proposalDeadline",
    label: "When do they want the proposal by?",
    group: "meta",
    type: "text",
    required: false,
    critical: false,
    placeholder: "e.g. By Friday, end of week, no rush",
    question: "Any deadline for sending the proposal?",
    rationale: "Tells us how aggressively to push this through.",
  },
  {
    id: "openQuestions",
    label: "Open questions / things to follow up on",
    group: "meta",
    type: "longtext",
    required: false,
    critical: false,
    placeholder: "Things you're still unsure about and need to ask the client",
    question:
      "Anything you're still uncertain about and need to confirm with them later?",
    rationale:
      "We'll flag these in the proposal so you know what to verify before sending.",
  },
];

export const GROUP_LABELS: Record<FieldGroup, string> = {
  client: "The client",
  scope: "Training scope",
  logistics: "Logistics",
  commercials: "Commercials",
  customization: "Customization",
  meta: "Context",
};

export const GROUP_ORDER: FieldGroup[] = [
  "client",
  "scope",
  "logistics",
  "commercials",
  "customization",
  "meta",
];

export type FieldValues = Record<string, string>;

export function emptyValues(): FieldValues {
  const v: FieldValues = {};
  for (const f of FIELDS) v[f.id] = "";
  return v;
}

export function isEmpty(v: string | undefined): boolean {
  if (!v) return true;
  const s = v.trim().toLowerCase();
  if (!s) return true;
  if (["unknown", "n/a", "na", "not discussed", "tbd", "?"].includes(s)) return true;
  return false;
}

export function missingCriticalFields(values: FieldValues): FieldDef[] {
  return FIELDS.filter((f) => f.critical && isEmpty(values[f.id]));
}

export function missingRequiredFields(values: FieldValues): FieldDef[] {
  return FIELDS.filter((f) => f.required && isEmpty(values[f.id]));
}

export function completionStats(values: FieldValues) {
  const required = FIELDS.filter((f) => f.required);
  const requiredFilled = required.filter((f) => !isEmpty(values[f.id])).length;
  const total = FIELDS.length;
  const filled = FIELDS.filter((f) => !isEmpty(values[f.id])).length;
  return {
    required: required.length,
    requiredFilled,
    total,
    filled,
    requiredPct: Math.round((requiredFilled / required.length) * 100),
  };
}
