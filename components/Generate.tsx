"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  values: Record<string, string>;
  notes: string[];
  clientSlug: string;
  onBack: () => void;
  onRestart: () => void;
}

type Stage =
  | "idle"
  | "checking-drive"
  | "drive-done"
  | "generating"
  | "generated"
  | "compiling"
  | "ready"
  | "revising"
  | "error";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface DriveMatch {
  file: { id: string; name: string; modifiedTime?: string | null; webViewLink?: string | null };
  score: number;
  picked: boolean;
  text?: string;
}

export default function Generate({ values, notes, clientSlug, onBack, onRestart }: Props) {
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState<string | null>(null);
  const [driveConfigured, setDriveConfigured] = useState<boolean | null>(null);
  const [driveHint, setDriveHint] = useState<string | null>(null);
  const [matches, setMatches] = useState<DriveMatch[]>([]);
  const [logos, setLogos] = useState<{ vizuara: string | null; client: string | null }>({
    vizuara: null,
    client: null,
  });
  const [uploadingKind, setUploadingKind] = useState<string | null>(null);
  const [pdfReady, setPdfReady] = useState(false);
  const [pdfBust, setPdfBust] = useState(0);
  const clientFileRef = useRef<HTMLInputElement>(null);
  const vizFileRef = useRef<HTMLInputElement>(null);
  const [chat, setChat] = useState<ChatTurn[]>([]);
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Email drafting state
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSignature, setEmailSignature] = useState("");
  const [emailDrafting, setEmailDrafting] = useState(false);
  const [emailInstruction, setEmailInstruction] = useState("");
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // On mount: auto-detect logos + start Drive search.
  useEffect(() => {
    refreshLogos();
    runDriveSearch();
  }, []);

  async function refreshLogos() {
    try {
      const r = await fetch(`/api/upload-logo?slug=${clientSlug}`);
      const data = await r.json();
      setLogos({ vizuara: data.vizuara ?? null, client: data.client ?? null });
    } catch {}
  }

  async function runDriveSearch() {
    setStage("checking-drive");
    try {
      const r = await fetch("/api/drive-search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientName: values.clientName,
          meetingDate: values.meetingDate,
        }),
      });
      const data = await r.json();
      setDriveConfigured(!!data.configured);
      setDriveHint(data.hint ?? null);
      const m: DriveMatch[] = (data.matches ?? []).map((x: any, i: number) => ({
        ...x,
        picked: i === 0 && x.score >= 0.5,
      }));
      setMatches(m);
      setStage("drive-done");
    } catch (e: any) {
      setDriveConfigured(false);
      setStage("drive-done");
    }
  }

  async function toggleMatch(idx: number) {
    setMatches((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], picked: !next[idx].picked };
      return next;
    });
  }

  async function uploadLogo(kind: "vizuara" | "client", file: File) {
    setUploadingKind(kind);
    try {
      const form = new FormData();
      form.append("clientName", values.clientName);
      form.append("kind", kind);
      form.append("file", file);
      const r = await fetch("/api/upload-logo", { method: "POST", body: form });
      if (!r.ok) throw new Error((await r.json()).error ?? "upload failed");
      await refreshLogos();
    } catch (e: any) {
      setError(e?.message ?? "logo upload failed");
    } finally {
      setUploadingKind(null);
    }
  }

  async function fetchTranscriptText(): Promise<{ name: string; text: string }[]> {
    const picked = matches.filter((m) => m.picked);
    const out: { name: string; text: string }[] = [];
    for (const m of picked) {
      if (m.text) {
        out.push({ name: m.file.name, text: m.text });
        continue;
      }
      try {
        const r = await fetch("/api/drive-search", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fetchTextFor: m.file.id, clientName: values.clientName }),
        });
        const data = await r.json();
        if (data.text) {
          out.push({ name: m.file.name, text: data.text });
        }
      } catch {}
    }
    return out;
  }

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [chat.length, stage]);

  async function draftEmail(withInstruction?: string) {
    setEmailError(null);
    setEmailDrafting(true);
    try {
      const r = await fetch("/api/draft-email", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          values,
          notes,
          priorBody: withInstruction ? emailBody : undefined,
          instruction: withInstruction,
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "draft failed");
      setEmailSubject(data.subject ?? "");
      setEmailBody(data.body ?? "");
      setEmailSignature(data.signature ?? "");
      if (!emailExpanded) setEmailExpanded(true);
      setEmailInstruction("");
    } catch (e: any) {
      setEmailError(e?.message ?? "draft failed");
    } finally {
      setEmailDrafting(false);
    }
  }

  const fullEmailBody = emailBody + (emailSignature ? "\n\n" + emailSignature : "");

  function openInMailClient() {
    // mailto has no attachments, but opens their default mail app with fields pre-filled.
    const qs = new URLSearchParams({
      subject: emailSubject,
      body: fullEmailBody,
    });
    const href = `mailto:${emailTo}?${qs.toString()}`;
    window.location.href = href;
  }

  function downloadEml() {
    const slug = clientSlug;
    const sp = new URLSearchParams({
      slug,
      to: emailTo,
      from: "hello@vizuara.com",
      subject: emailSubject,
      body: fullEmailBody,
      clientName: values.clientName,
      filename: `${slug}-proposal.pdf`,
    });
    window.location.href = `/api/compose-eml?${sp.toString()}`;
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  }

  async function sendRevision() {
    const instruction = chatInput.trim();
    if (!instruction || stage === "revising" || stage === "compiling") return;

    setChatInput("");
    const userTurn: ChatTurn = { role: "user", content: instruction };
    const priorHistory = chat; // history BEFORE this turn
    setChat((prev) => [...prev, userTurn]);
    setError(null);
    setStage("revising");

    try {
      const rev = await fetch("/api/revise-proposal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          clientName: values.clientName,
          instruction,
          history: priorHistory,
        }),
      });
      const revData = await rev.json();
      if (!rev.ok) throw new Error(revData.error ?? "revision failed");

      setChat((prev) => [
        ...prev,
        { role: "assistant", content: revData.summary ?? "Updated." },
      ]);

      // Auto-recompile after every revision
      setStage("compiling");
      const com = await fetch("/api/compile-pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientName: values.clientName }),
      });
      const comData = await com.json();
      if (!com.ok) {
        const detail = comData.logTail ?? comData.stderr ?? "";
        throw new Error(`pdflatex failed after revision.\n\n${detail.slice(-1500)}`);
      }
      setPdfBust(Date.now());
      setStage("ready");
    } catch (e: any) {
      setError(e?.message ?? "revision failed");
      setStage("error");
    }
  }

  async function generate() {
    setError(null);
    setPdfReady(false);
    try {
      setStage("generating");
      const transcriptExcerpts = await fetchTranscriptText();
      const gen = await fetch("/api/generate-proposal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ values, notes, transcriptExcerpts }),
      });
      const genData = await gen.json();
      if (!gen.ok) throw new Error(genData.error ?? "generation failed");
      setStage("generated");

      setStage("compiling");
      const com = await fetch("/api/compile-pdf", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clientName: values.clientName }),
      });
      const comData = await com.json();
      if (!com.ok) {
        const detail = comData.logTail ?? comData.stderr ?? "";
        throw new Error(`pdflatex failed.\n\n${detail.slice(-1500)}`);
      }
      setPdfReady(true);
      setPdfBust(Date.now());
      setStage("ready");
    } catch (e: any) {
      setError(e?.message ?? "generation failed");
      setStage("error");
    }
  }

  const pdfUrl = `/api/file?slug=${clientSlug}&name=proposal.pdf&t=${pdfBust}`;
  const texUrl = `/api/file?slug=${clientSlug}&name=proposal.tex`;

  const canGenerate = stage !== "generating" && stage !== "compiling" && stage !== "checking-drive";

  return (
    <div className="animate-in">
      <div className="mb-6">
        <h1 className="text-3xl md:text-4xl font-serif text-viz-ink mb-2">
          Draft the proposal.
        </h1>
        <p className="text-gray-600 leading-relaxed max-w-2xl">
          Everything runs in-app. We&apos;ll pick up any matching Meet transcript, write the LaTeX,
          and compile it to PDF. No Claude Code needed.
        </p>
      </div>

      {/* DRIVE CROSS-CHECK */}
      <div className="card p-5 md:p-6 mb-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-viz-navy font-semibold mb-1">
              Step 1 · Meet transcript cross-check
            </div>
            <p className="text-[13px] text-gray-500">
              Looking in the Drive folder for anything matching{" "}
              <strong className="text-viz-ink">{values.clientName}</strong>
              {values.meetingDate ? (
                <>
                  {" "}on <strong className="text-viz-ink">{values.meetingDate}</strong>
                </>
              ) : null}
              .
            </p>
          </div>
          <button
            onClick={runDriveSearch}
            disabled={stage === "checking-drive"}
            className="text-[12px] text-viz-navy/80 hover:text-viz-navy underline underline-offset-4"
          >
            {stage === "checking-drive" ? "searching…" : "re-run"}
          </button>
        </div>

        {driveConfigured === false && (
          <div className="text-[13px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Drive access isn&apos;t configured. Generation will proceed without transcript context.
          </div>
        )}
        {driveHint && (
          <div className="text-[13px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            {driveHint}
          </div>
        )}

        {stage === "checking-drive" ? (
          <div className="py-6 text-center text-[13px] text-gray-400">
            <span className="inline-flex gap-1 mr-2 align-middle">
              <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-viz-navy/50" />
              <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-viz-navy/50" />
              <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-viz-navy/50" />
            </span>
            Scanning Drive…
          </div>
        ) : matches.length > 0 ? (
          <div className="space-y-2 mt-4">
            {matches.map((m, i) => (
              <label
                key={m.file.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-viz-navy/30 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={m.picked}
                  onChange={() => toggleMatch(i)}
                  className="accent-viz-navy"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[14px] text-viz-ink truncate">{m.file.name}</div>
                  <div className="text-[11px] text-gray-500">
                    {m.file.modifiedTime?.slice(0, 10)} · match score{" "}
                    {Math.round(m.score * 100)}%
                  </div>
                </div>
                {m.file.webViewLink && (
                  <a
                    href={m.file.webViewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12px] text-viz-navy/70 hover:text-viz-navy"
                    onClick={(e) => e.stopPropagation()}
                  >
                    open ↗
                  </a>
                )}
              </label>
            ))}
          </div>
        ) : driveConfigured ? (
          <div className="text-[13px] text-gray-500 mt-2">
            No transcript matched. You can still generate — we&apos;ll use the brief only.
          </div>
        ) : null}
      </div>

      {/* LOGOS */}
      <div className="card p-5 md:p-6 mb-5">
        <div className="text-[11px] uppercase tracking-wider text-viz-navy font-semibold mb-4">
          Step 2 · Logos (title page)
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LogoSlot
            label="Vizuara logo"
            fileName={logos.vizuara}
            kind="vizuara"
            onPick={() => vizFileRef.current?.click()}
            uploading={uploadingKind === "vizuara"}
            slug={clientSlug}
          />
          <LogoSlot
            label={`${values.clientName || "Client"} logo`}
            fileName={logos.client}
            kind="client"
            onPick={() => clientFileRef.current?.click()}
            uploading={uploadingKind === "client"}
            slug={clientSlug}
          />
        </div>
        <input
          ref={vizFileRef}
          type="file"
          accept="image/png,image/jpeg,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadLogo("vizuara", f);
          }}
        />
        <input
          ref={clientFileRef}
          type="file"
          accept="image/png,image/jpeg,application/pdf"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadLogo("client", f);
          }}
        />
        <p className="text-[12px] text-gray-500 mt-4">
          If a logo is missing, we&apos;ll fall back to text on the title page.
        </p>
      </div>

      {/* GENERATE */}
      <div className="card p-5 md:p-6 mb-5">
        <div className="text-[11px] uppercase tracking-wider text-viz-navy font-semibold mb-3">
          Step 3 · Draft &amp; compile
        </div>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="text-[13px] text-gray-600">
            <StageText stage={stage} />
          </div>
          <button
            onClick={generate}
            disabled={!canGenerate}
            className="px-5 py-2.5 rounded-lg bg-viz-navy text-white text-sm font-medium hover:bg-viz-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {stage === "ready" ? "Re-generate" : "Draft the proposal →"}
          </button>
        </div>

        {error && (
          <pre className="mt-4 text-[12px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-3 whitespace-pre-wrap font-mono overflow-auto max-h-60">
            {error}
          </pre>
        )}
      </div>

      {/* PDF PREVIEW */}
      {pdfReady && (
        <div className="card p-0 mb-5 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-100">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-viz-navy font-semibold">
                Proposal preview
              </div>
              <div className="text-[13px] text-gray-500 mt-0.5">
                output/{clientSlug}/proposal.pdf
              </div>
            </div>
            <div className="flex items-center gap-3">
              <a
                href={texUrl}
                className="text-[12px] text-viz-navy/80 hover:text-viz-navy underline underline-offset-4"
                download="proposal.tex"
              >
                .tex
              </a>
              <a
                href={pdfUrl}
                download={`${clientSlug}-proposal.pdf`}
                className="px-4 py-1.5 rounded-lg bg-viz-navy text-white text-[12px] font-medium hover:bg-viz-ink"
              >
                Download PDF
              </a>
            </div>
          </div>
          <iframe
            src={pdfUrl}
            className="w-full"
            style={{ height: "calc(100vh - 160px)", minHeight: 640 }}
          />
        </div>
      )}

      {/* CHAT: iterative refinement */}
      {pdfReady && (
        <div className="card p-0 mb-5 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <div className="text-[11px] uppercase tracking-wider text-viz-navy font-semibold">
              Refine with chat
            </div>
            <div className="text-[13px] text-gray-500 mt-0.5">
              Tell me what to change. Each message edits the proposal and recompiles.
            </div>
          </div>

          <div className="max-h-96 overflow-y-auto px-4 py-4 space-y-3 bg-viz-cream/40">
            {chat.length === 0 ? (
              <div className="text-[13px] text-gray-400 italic py-6 text-center">
                Try things like: <span className="not-italic text-viz-ink">&ldquo;Make Day 3 focus more on RAG with a live demo&rdquo;</span>
                &nbsp;·&nbsp;<span className="not-italic text-viz-ink">&ldquo;Add a 4-tier pricing table&rdquo;</span>
                &nbsp;·&nbsp;<span className="not-italic text-viz-ink">&ldquo;Shorten the intro to one paragraph&rdquo;</span>
              </div>
            ) : (
              chat.map((t, i) => (
                <div
                  key={i}
                  className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-3 py-2 rounded-2xl text-[14px] leading-snug ${
                      t.role === "user"
                        ? "bg-viz-navy text-white rounded-br-sm"
                        : "bg-white border border-gray-200 text-viz-ink rounded-bl-sm"
                    }`}
                  >
                    {t.role === "assistant" && (
                      <div className="text-[10px] uppercase tracking-wider text-viz-navy/60 mb-0.5">
                        change applied
                      </div>
                    )}
                    {t.content}
                  </div>
                </div>
              ))
            )}
            {(stage === "revising" || (stage === "compiling" && chat.length > 0)) && (
              <div className="flex justify-start">
                <div className="px-3 py-2 rounded-2xl rounded-bl-sm bg-white border border-gray-200 text-[14px] text-gray-500 flex items-center gap-2">
                  <span className="flex gap-1">
                    <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-viz-navy/50" />
                    <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-viz-navy/50" />
                    <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-viz-navy/50" />
                  </span>
                  {stage === "revising" ? "Rewriting…" : "Recompiling…"}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="p-3 border-t border-gray-100 bg-white">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendRevision();
              }}
              className="flex gap-2 items-end"
            >
              <textarea
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendRevision();
                  }
                }}
                placeholder="What should I change? (Enter to send, Shift+Enter for newline)"
                rows={2}
                disabled={stage === "revising" || stage === "compiling"}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-[14px] resize-none focus:border-viz-navy disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={!chatInput.trim() || stage === "revising" || stage === "compiling"}
                className="px-4 py-2.5 rounded-lg bg-viz-navy text-white text-sm font-medium hover:bg-viz-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {stage === "revising" || stage === "compiling" ? "…" : "Send"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EMAIL */}
      {pdfReady && (
        <div className="card p-0 mb-5 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-wider text-viz-navy font-semibold">
                Cover email
              </div>
              <div className="text-[13px] text-gray-500 mt-0.5">
                Drafted in your tight, no-fluff style. Download as .eml to open in Mail/Outlook with the proposal already attached.
              </div>
            </div>
            {!emailBody && !emailDrafting && (
              <button
                onClick={() => draftEmail()}
                className="px-4 py-2 rounded-lg bg-viz-navy text-white text-[13px] font-medium hover:bg-viz-ink transition-colors"
              >
                Draft email
              </button>
            )}
          </div>

          {emailDrafting && !emailBody && (
            <div className="p-8 text-center text-[13px] text-gray-400">
              <span className="inline-flex gap-1 mr-2 align-middle">
                <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-viz-navy/50" />
                <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-viz-navy/50" />
                <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-viz-navy/50" />
              </span>
              Writing the email…
            </div>
          )}

          {emailBody && (
            <div className="p-4 md:p-5 space-y-4">
              <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 items-center text-[13px]">
                <label className="text-gray-500">To</label>
                <input
                  type="email"
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="recipient@company.com"
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[14px] focus:border-viz-navy"
                />
                <label className="text-gray-500">From</label>
                <div className="px-3 py-1.5 text-[14px] text-gray-500">hello@vizuara.com</div>
                <label className="text-gray-500">Subject</label>
                <input
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[14px] focus:border-viz-navy"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-[13px] text-gray-500">Body</label>
                  <button
                    onClick={() => copyToClipboard(fullEmailBody)}
                    className="text-[11px] text-viz-navy/70 hover:text-viz-navy"
                  >
                    copy body + signature
                  </button>
                </div>
                <textarea
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  rows={7}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 bg-white text-[14px] leading-relaxed resize-y focus:border-viz-navy"
                />
                {emailSignature && (
                  <textarea
                    value={emailSignature}
                    onChange={(e) => setEmailSignature(e.target.value)}
                    rows={4}
                    className="w-full mt-2 px-3 py-2 rounded-lg border border-gray-200 bg-viz-light/30 text-[13px] leading-relaxed resize-y focus:border-viz-navy"
                  />
                )}
              </div>

              {/* Attachment chip */}
              <div className="flex items-center gap-2 text-[13px]">
                <div className="pill bg-viz-light text-viz-navy">
                  <span className="w-1.5 h-1.5 rounded-full bg-viz-navy" />
                  Attachment
                </div>
                <span className="text-viz-ink">{clientSlug}-proposal.pdf</span>
                <span className="text-gray-400">· will be attached to the .eml download</span>
              </div>

              {/* Refinement input (single-shot) */}
              <div className="border-t border-gray-100 pt-4">
                <label className="text-[11px] uppercase tracking-wider text-viz-navy/80 font-semibold">
                  Rewrite with instructions
                </label>
                <div className="flex gap-2 mt-2">
                  <input
                    value={emailInstruction}
                    onChange={(e) => setEmailInstruction(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && emailInstruction.trim()) {
                        draftEmail(emailInstruction.trim());
                      }
                    }}
                    placeholder={'e.g. "even shorter", "mention we\'re available next week", "more formal"'}
                    disabled={emailDrafting}
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-[13px] focus:border-viz-navy"
                  />
                  <button
                    onClick={() => draftEmail(emailInstruction.trim() || undefined)}
                    disabled={emailDrafting}
                    className="px-4 py-2 rounded-lg border border-viz-navy text-viz-navy text-[13px] font-medium hover:bg-viz-navy hover:text-white disabled:opacity-40 transition-colors"
                  >
                    {emailDrafting ? "…" : emailInstruction.trim() ? "Rewrite" : "Re-draft"}
                  </button>
                </div>
              </div>

              {emailError && (
                <div className="text-[13px] text-rose-700 bg-rose-50 border border-rose-100 rounded-lg px-3 py-2">
                  {emailError}
                </div>
              )}

              {/* Send actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                <button
                  onClick={downloadEml}
                  className="px-4 py-2 rounded-lg bg-viz-navy text-white text-[13px] font-medium hover:bg-viz-ink transition-colors"
                >
                  Download .eml with proposal attached
                </button>
                <button
                  onClick={openInMailClient}
                  className="px-4 py-2 rounded-lg border border-gray-200 text-viz-ink text-[13px] font-medium hover:border-viz-navy transition-colors"
                >
                  Open in mail app (no attachment)
                </button>
              </div>

              <p className="text-[11px] text-gray-500 leading-relaxed">
                The <code className="px-1 bg-viz-light/70 rounded">.eml</code> file opens in Apple Mail, Outlook, or Thunderbird with everything — recipient, subject, body, and proposal PDF — pre-filled. Review and hit send.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-between items-center mt-8">
        <button
          onClick={onBack}
          className="text-sm text-gray-500 hover:text-viz-ink underline underline-offset-4"
        >
          ← back to brief
        </button>
        <button
          onClick={onRestart}
          className="text-sm text-gray-500 hover:text-viz-ink underline underline-offset-4"
        >
          Start a new intake
        </button>
      </div>
    </div>
  );
}

function LogoSlot({
  label,
  fileName,
  kind,
  onPick,
  uploading,
  slug,
}: {
  label: string;
  fileName: string | null;
  kind: string;
  onPick: () => void;
  uploading: boolean;
  slug: string;
}) {
  const hasFile = !!fileName;
  const previewUrl = hasFile ? `/api/file?slug=${slug}&name=${fileName}` : null;
  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-[13px] font-medium text-viz-ink">{label}</div>
        <div className="text-[11px]">
          {hasFile ? (
            <span className="pill bg-emerald-50 text-emerald-700">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              uploaded
            </span>
          ) : (
            <span className="pill bg-gray-100 text-gray-500">missing</span>
          )}
        </div>
      </div>
      <div className="h-20 flex items-center justify-center bg-viz-light/40 rounded-md mb-3 overflow-hidden">
        {previewUrl && /\.(png|jpg|jpeg)$/i.test(fileName ?? "") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt={label} className="max-h-16 object-contain" />
        ) : (
          <span className="text-[11px] text-gray-400">{fileName ?? "no logo"}</span>
        )}
      </div>
      <button
        onClick={onPick}
        disabled={uploading}
        className="w-full text-[12px] text-viz-navy hover:text-viz-ink underline underline-offset-4 disabled:opacity-50"
      >
        {uploading ? "uploading…" : hasFile ? "replace" : "upload"}
      </button>
    </div>
  );
}

function StageText({ stage }: { stage: Stage }) {
  switch (stage) {
    case "idle":
      return <>Ready when you are.</>;
    case "checking-drive":
      return <>Scanning the Drive archive…</>;
    case "drive-done":
      return <>Ready to draft. Pick a transcript above if any looked right, then hit draft.</>;
    case "generating":
      return (
        <span className="flex items-center gap-2">
          <span className="flex gap-1">
            <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-viz-navy/60" />
            <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-viz-navy/60" />
            <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-viz-navy/60" />
          </span>
          Writing the LaTeX… (30–60s)
        </span>
      );
    case "generated":
      return <>LaTeX ready. Starting compile…</>;
    case "compiling":
      return (
        <span className="flex items-center gap-2">
          <span className="flex gap-1">
            <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-viz-navy/60" />
            <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-viz-navy/60" />
            <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-viz-navy/60" />
          </span>
          Running pdflatex…
        </span>
      );
    case "revising":
      return (
        <span className="flex items-center gap-2">
          <span className="flex gap-1">
            <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-viz-navy/60" />
            <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-viz-navy/60" />
            <span className="thinking-dot w-1.5 h-1.5 rounded-full bg-viz-navy/60" />
          </span>
          Applying your edit…
        </span>
      );
    case "ready":
      return <span className="text-emerald-700 font-medium">PDF ready below.</span>;
    case "error":
      return <span className="text-rose-700">Something went wrong — see below.</span>;
  }
}
