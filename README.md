# Vizuara Proposal Agent — Intake & Draft UI

> Meeting → brief → branded LaTeX proposal → cover email. End-to-end, in-browser.

This service turns a messy meeting (transcript, voice notes, or half-remembered
context) into a fully-compiled client proposal PDF and a ready-to-send cover
email with the PDF attached. Every step is accessible as both a UI wizard and
an HTTP endpoint.

---

## 1. Machine-readable capability manifest

This block is intended to be parsed by an orchestrator (e.g. the Vizuara
Master Brain). Everything below (§2 onwards) is human-readable
elaboration of the same contract.

```yaml
service: vizuara-proposal-agent
version: 1.0
purpose: >
  Convert a client meeting into a compiled corporate AI training proposal
  (PDF, LaTeX source) and a cover email with the proposal attached.
default_port: 3210
base_url: http://localhost:3210

capabilities:
  - id: extract_brief
    summary: Extract structured brief fields from a raw meeting transcript or rough notes.
    endpoint: POST /api/extract
    inputs: { transcript: string, mode: "transcript"|"notes" }
    outputs: { values: map<field_id,string>, confidence: map<field_id,"high"|"medium"|"low">, notes: string[] }

  - id: probe_missing
    summary: Generate context-aware follow-up questions for missing/low-confidence fields.
    endpoint: POST /api/probe
    inputs: { transcript: string, values: map<field_id,string>, confidence: map<field_id,string> }
    outputs: { questions: [{ fieldId: string, question: string, hint?: string }] }

  - id: save_brief
    summary: Persist the brief to disk (brief.json + brief.md) under output/{client-slug}/.
    endpoint: POST /api/save
    inputs: { values: map<field_id,string>, transcript: string, sourceMode: string, notes: string[] }
    outputs: { ok: bool, clientSlug: string, briefPath: string, markdownPath: string, outputDir: string }

  - id: search_meet_transcripts
    summary: Find Google Meet transcripts in the shared Drive folder matching (clientName, meetingDate).
    endpoint: POST /api/drive-search
    inputs: { clientName?: string, meetingDate?: string, fetchTextFor?: string }
    outputs: { configured: bool, matches: [{ file: DriveFile, score: number }], text?: string, hint?: string }
    notes: Requires GOOGLE_SERVICE_ACCOUNT_KEY and the folder to be shared with the service-account email.

  - id: upload_logo
    summary: Attach the Vizuara or client logo to a client's output folder (used on the title page).
    endpoint_post: POST /api/upload-logo (multipart/form-data; fields: clientName, kind, file)
    endpoint_get: GET /api/upload-logo?slug=<slug>  # reports which logos are present; auto-seeds Vizuara logo
    outputs: { ok: bool, saved: string, clientSlug: string }  # for POST
              | { vizuara: string|null, client: string|null }  # for GET

  - id: generate_proposal
    summary: >
      Draft the full LaTeX proposal using the brief + style guide + (optional) matched
      transcript excerpts. Writes proposal.tex to output/{slug}/.
    endpoint: POST /api/generate-proposal
    inputs: { values: map, notes: string[], transcriptExcerpts?: [{ name: string, text: string }] }
    outputs: { ok: bool, clientSlug: string, texPath: string, outputDir: string, hasLogos: { vizuara: bool, client: bool } }

  - id: compile_pdf
    summary: Compile output/{slug}/proposal.tex with pdflatex twice. Returns the PDF path.
    endpoint: POST /api/compile-pdf
    inputs: { clientName: string, texOverride?: string }
    outputs: { ok: bool, pdfPath: string, sizeBytes: number, clientSlug: string }
    failure_shape: { error: string, stdout?: string, stderr?: string, logTail?: string }
    requires: pdflatex binary available at PDFLATEX_BIN

  - id: revise_proposal
    summary: >
      Apply a natural-language instruction to the current proposal.tex (chat-style).
      Writes the new LaTeX, backs up the previous one to proposal.prev.tex.
    endpoint: POST /api/revise-proposal
    inputs: { clientName: string, instruction: string, history: [{ role: "user"|"assistant", content: string }] }
    outputs: { ok: bool, summary: string, clientSlug: string, texPath: string }

  - id: draft_email
    summary: >
      Draft a cover email per Raj's style (60-100 words, not salesy, not desperate).
      Can be refined iteratively via (priorBody, instruction).
    endpoint: POST /api/draft-email
    inputs: { values: map, notes: string[], priorBody?: string, instruction?: string }
    outputs: { ok: bool, subject: string, body: string, signature: string, recipient_guess: string }

  - id: compose_eml
    summary: >
      Build an RFC-822 .eml file with the proposal PDF base64-attached. Double-clicks open
      natively in Apple Mail / Outlook / Thunderbird with everything pre-filled.
    endpoint: GET /api/compose-eml
    inputs (querystring): { slug, to?, from?, subject?, body?, clientName?, filename? }
    outputs: application/octet-stream .eml file

  - id: serve_file
    summary: Serve PDF / LaTeX / brief / logo files back to the browser under an allow-list.
    endpoint: GET /api/file?slug=<slug>&name=<filename>
    allowed_names: [proposal.pdf, proposal.tex, brief.json, brief.md, vizuara_logo.png, client_logo.png, client_logo.jpg, client_logo.jpeg]

field_schema:
  # Fields the intake collects and fills before a proposal is drafted.
  # See lib/fields.ts for full definitions, labels, and options.
  groups:
    client: [clientName*, clientIndustry, clientCountry*, clientContacts]
    scope: [trainingTopic*, audienceType*, audienceSkill*, businessProblems*, existingStack]
    logistics: [duration*, format*, location, participantCount*, batches, timeline*]
    commercials: [budget, currency*, pricingModel]
    customization: [customProjects, specialDeliverables, instructorPreference]
    meta: [meetingDate*, meetingTime, relationshipStatus, proposalDeadline, openQuestions]
  # `*` = required / critical. `critical` fields will be aggressively probed if empty.

state_machine:
  # The recommended order for an orchestrator to call capabilities.
  steps:
    - extract_brief              # 1. transcript / notes → structured values
    - probe_missing              # 2. surface memory-jogging questions for gaps
    - (merge human answers)
    - save_brief                 # 3. persist to output/{slug}/
    - search_meet_transcripts    # 4. cross-check Drive (optional)
    - upload_logo (optional)     # 5. title page branding
    - generate_proposal          # 6. write LaTeX
    - compile_pdf                # 7. compile to PDF
    - revise_proposal (loop)     # 8. iterate via chat instructions
    - draft_email                # 9. cover email
    - compose_eml                # 10. download .eml with PDF attached

output_contract:
  # For every client processed, the following files are written to output/{slug}/
  path_template: "{PROPOSAL_OUTPUT_DIR}/{slug}/"
  files:
    brief.json:     Canonical structured brief (machine-readable).
    brief.md:       Human-readable markdown rendering.
    proposal.tex:   Compilable LaTeX source.
    proposal.pdf:   Final PDF.
    proposal.prev.tex: Backup of the prior revision (undo).
    vizuara_logo.{png,jpg}: Title-page logo (auto-seeded from PROPOSAL_ASSETS_DIR if present).
    client_logo.{png,jpg}: Uploaded via /api/upload-logo.
```

---

## 2. What this does, in plain English

1. A team member who just finished a client call opens the app.
2. They paste the Meet transcript, drop notes, or type what they remember.
3. Claude extracts every field we need for a proposal and asks
   context-aware follow-ups for anything missing — referencing what was
   already said ("you mentioned Priya said 40 engineers — did she say
   which 40?").
4. The team member reviews + edits.
5. The app scans the shared Drive archive of Meet transcripts by meeting
   date + client, and pulls matching files in as additional source-of-truth.
6. Logos are uploaded.
7. Claude writes a complete LaTeX proposal using the bundled Vizuara
   `style.md` (short-form vs long-form archetypes, client-specific
   curriculum hooks, pricing tiers, brand colours).
8. pdflatex compiles it twice. The PDF renders in-browser.
9. A chat panel below the preview lets the user iterate: "make the
   pricing more compact", "add a Day 6 capstone", "use more formal
   language". Each turn rewrites the LaTeX and recompiles.
10. A cover email is drafted in Raj's no-fluff style; the team member
    downloads a `.eml` file with the PDF already attached and sends from
    their own mail client.

No Claude Code skills. No local CLI. Browser only. All AI calls happen
server-side via the Anthropic API.

---

## 3. Run it

```bash
cp .env.example .env.local   # fill in ANTHROPIC_API_KEY + Drive creds
npm install
npm run dev                  # http://localhost:3210
```

Requires:
- Node 20+
- `pdflatex` (macOS: `brew install --cask mactex` / `brew install --cask basictex`)
- An Anthropic API key
- (Optional) Google service-account JSON with read access to the Meet
  transcripts folder. The folder must be shared with the service
  account's `client_email` as a Viewer.

---

## 4. Deployment notes for production

Vercel serverless functions do **not** ship with `pdflatex`. For
production you need one of:

1. **VM / container** (DigitalOcean droplet, AWS Lightsail, Railway,
   Fly.io, a docker-compose on your own server): install
   `texlive-latex-recommended` + `texlive-fonts-recommended`, then deploy
   as a plain Node.js app.
2. **Vercel + external compile service**: deploy the Next.js app to
   Vercel, and move `/api/compile-pdf` to a Vercel Sandbox /
   separate container that exposes a PDF endpoint. Proxy to it.
3. **Vercel + client-side .tex download only**: let users download the
   `.tex` and compile it themselves on Overleaf. (Lowest-effort, worst
   UX.)

All other routes (extract, probe, generate, revise, draft-email,
compose-eml, drive-search) are pure Node code and work on Vercel
serverless unchanged.

---

## 5. Repo layout

```
intake-ui/
├── app/
│   ├── page.tsx                    # 5-step wizard orchestrator
│   ├── layout.tsx · globals.css
│   └── api/
│       ├── extract/route.ts        # capability: extract_brief
│       ├── probe/route.ts          # capability: probe_missing
│       ├── save/route.ts           # capability: save_brief
│       ├── drive-search/route.ts   # capability: search_meet_transcripts
│       ├── upload-logo/route.ts    # capability: upload_logo
│       ├── generate-proposal/route.ts  # capability: generate_proposal
│       ├── compile-pdf/route.ts    # capability: compile_pdf
│       ├── revise-proposal/route.ts    # capability: revise_proposal
│       ├── draft-email/route.ts    # capability: draft_email
│       ├── compose-eml/route.ts    # capability: compose_eml
│       └── file/route.ts           # capability: serve_file
├── components/
│   ├── StepIndicator.tsx
│   ├── Capture.tsx   · Probe.tsx   · Review.tsx   · Brief.tsx   · Generate.tsx
│   └── FieldInput.tsx
├── lib/
│   ├── fields.ts                   # full field schema
│   ├── drive.ts                    # Google Drive helpers
│   ├── proposal-prompt.ts          # LaTeX-gen prompt builder
│   └── types.ts
├── style.md                        # Vizuara proposal style guide (bundled)
├── public/
│   └── vizuara_logo.png            # default title-page logo
└── .env.example
```

---

## 6. Downstream integration — talking to this service from Master Brain

The service is designed to be orchestrated by another LLM. Recommended
patterns:

**Fire-and-forget intake** (Master Brain already has meeting notes):

```http
POST /api/extract        → returns structured values
POST /api/save           → persists brief.json
POST /api/generate-proposal
POST /api/compile-pdf    → PDF ready at output/{slug}/proposal.pdf
```

**Interactive intake** (Master Brain drives a human through follow-ups):

```http
POST /api/extract
POST /api/probe          → ask human the returned questions
(merge answers into values)
POST /api/save
POST /api/drive-search   → cross-check transcripts
POST /api/generate-proposal
POST /api/compile-pdf
POST /api/revise-proposal (x N)   → apply user feedback
POST /api/draft-email
GET  /api/compose-eml?slug=...&to=...    → .eml download URL
```

Everything is idempotent by `clientName` (which produces a deterministic
`clientSlug`). Re-calling any endpoint for the same client overwrites
the same folder — good for iteration, note if you need
multi-version history.

---

## 7. Non-goals (what this service does **not** do)

- Send email directly via SMTP/Brevo. Emails are downloaded as `.eml`
  for the team member to review and send from their own client. (Brevo
  dispatch could be added at `/api/send-email` if desired.)
- Store briefs in a database. Everything is on the local filesystem at
  `PROPOSAL_OUTPUT_DIR`. For team-wide visibility, back it with a shared
  drive or swap out the save/serve-file routes for S3 / Supabase.
- Authenticate users. Runs on localhost for internal use. Add NextAuth
  or Clerk before exposing it publicly.
- Manage invoicing / CRM / client status beyond proposal stage.

---

Contact: hello@vizuara.com · www.vizuara.ai
