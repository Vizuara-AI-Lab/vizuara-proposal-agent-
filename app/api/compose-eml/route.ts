import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "unnamed-client"
  );
}

/**
 * Encode a string as quoted-printable (RFC 2045) for 8-bit safe email bodies.
 */
function quotedPrintable(input: string): string {
  const bytes = Buffer.from(input, "utf-8");
  let out = "";
  let lineLen = 0;
  const push = (s: string) => {
    if (lineLen + s.length > 75) {
      out += "=\r\n";
      lineLen = 0;
    }
    out += s;
    lineLen += s.length;
  };
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b === 0x0a) {
      out += "\r\n";
      lineLen = 0;
      continue;
    }
    if (b === 0x0d) continue;
    if ((b >= 33 && b <= 126 && b !== 61) || b === 0x20 || b === 0x09) {
      push(String.fromCharCode(b));
    } else {
      push("=" + b.toString(16).toUpperCase().padStart(2, "0"));
    }
  }
  return out;
}

function foldHeader(name: string, value: string): string {
  // Simple header folding at ~72 chars
  const line = `${name}: ${value}`;
  if (line.length <= 78) return line;
  const words = value.split(" ");
  let current = `${name}:`;
  const parts: string[] = [];
  for (const w of words) {
    if ((current + " " + w).length > 74) {
      parts.push(current);
      current = " " + w;
    } else {
      current += " " + w;
    }
  }
  parts.push(current);
  return parts.join("\r\n");
}

function encodeHeaderWord(s: string): string {
  // MIME Encoded-Word if non-ASCII
  if (/^[\x20-\x7e]*$/.test(s)) return s;
  return `=?UTF-8?B?${Buffer.from(s, "utf-8").toString("base64")}?=`;
}

function chunkBase64(b64: string, width = 76): string {
  const out: string[] = [];
  for (let i = 0; i < b64.length; i += width) out.push(b64.slice(i, i + width));
  return out.join("\r\n");
}

/**
 * GET /api/compose-eml?slug=...&to=...&from=...&subject=...&body=...&filename=...
 * Streams a .eml file with the proposal PDF attached.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const slug = sp.get("slug");
  if (!slug || slug.includes("/") || slug.includes(".."))
    return new Response("bad slug", { status: 400 });

  const to = sp.get("to") || "";
  const from = sp.get("from") || "hello@vizuara.com";
  const subject = sp.get("subject") || "Proposal from Vizuara Technologies";
  const body = sp.get("body") || "";
  const clientName = sp.get("clientName") || slug;
  const attachName = sp.get("filename") || `${slug}-proposal.pdf`;

  const outputDir = process.env.PROPOSAL_OUTPUT_DIR || "/Users/raj/Desktop/Proposal Agent/output";
  const pdfPath = path.join(outputDir, slug, "proposal.pdf");
  let pdf: Buffer;
  try {
    pdf = await fs.readFile(pdfPath);
  } catch {
    return new Response("proposal.pdf not found — compile it first.", { status: 404 });
  }

  const boundary = "=_vizuara_" + Math.random().toString(36).slice(2, 14);
  const date = new Date().toUTCString();
  const pdfB64 = chunkBase64(pdf.toString("base64"));

  const toHeader = to ? foldHeader("To", encodeHeaderWord(to)) : "";
  const headers = [
    foldHeader("From", encodeHeaderWord(from)),
    toHeader,
    foldHeader("Subject", encodeHeaderWord(subject)),
    `Date: ${date}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
  ]
    .filter(Boolean)
    .join("\r\n");

  const bodyPart = [
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: quoted-printable",
    "",
    quotedPrintable(body),
  ].join("\r\n");

  const pdfPart = [
    `--${boundary}`,
    `Content-Type: application/pdf; name="${attachName}"`,
    "Content-Transfer-Encoding: base64",
    `Content-Disposition: attachment; filename="${attachName}"`,
    "",
    pdfB64,
  ].join("\r\n");

  const eml = [headers, "", bodyPart, pdfPart, `--${boundary}--`, ""].join("\r\n");

  const fileNameOut = `${slug}-${Date.now()}.eml`;
  return new Response(eml, {
    headers: {
      "content-type": "message/rfc822",
      "content-disposition": `attachment; filename="${fileNameOut}"`,
      "cache-control": "no-store",
    },
  });
}
