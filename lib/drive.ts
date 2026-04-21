import { google } from "googleapis";

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set");
  const creds = JSON.parse(raw);
  return new google.auth.JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/drive.readonly"],
  });
}

export function getDrive() {
  return google.drive({ version: "v3", auth: getAuth() });
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string | null;
  createdTime?: string | null;
  webViewLink?: string | null;
}

export async function listFolderFiles(folderId: string): Promise<DriveFile[]> {
  const drive = getDrive();
  const files: DriveFile[] = [];
  let pageToken: string | undefined = undefined;
  do {
    const res: any = await drive.files.list({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType, modifiedTime, createdTime, webViewLink)",
      pageSize: 200,
      pageToken,
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    });
    if (res.data.files) files.push(...res.data.files);
    pageToken = res.data.nextPageToken ?? undefined;
  } while (pageToken);
  return files;
}

/**
 * Fetch the textual content of a Drive file.
 * - Google Docs → export as text/plain
 * - text/plain, .vtt, .srt, .md → download raw
 * - Otherwise return empty
 */
export async function getFileText(file: DriveFile): Promise<string> {
  const drive = getDrive();
  if (file.mimeType === "application/vnd.google-apps.document") {
    const res: any = await drive.files.export(
      { fileId: file.id, mimeType: "text/plain" },
      { responseType: "text" }
    );
    return typeof res.data === "string" ? res.data : "";
  }
  if (
    file.mimeType?.startsWith("text/") ||
    file.name.match(/\.(txt|md|vtt|srt)$/i)
  ) {
    const res: any = await drive.files.get(
      { fileId: file.id, alt: "media", supportsAllDrives: true },
      { responseType: "text" }
    );
    return typeof res.data === "string" ? res.data : String(res.data ?? "");
  }
  return "";
}

/**
 * Score a file's relevance given (clientName, meetingDate) — returns 0..1.
 * - Filename match for client name (tokens, case-insensitive)
 * - Modified or created time on the same calendar day as meetingDate
 */
export function scoreFile(
  file: DriveFile,
  clientName?: string,
  meetingDate?: string
): number {
  let score = 0;
  const name = file.name.toLowerCase();

  if (clientName) {
    const tokens = clientName
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length >= 3);
    const matches = tokens.filter((t) => name.includes(t)).length;
    if (tokens.length > 0) score += 0.5 * (matches / tokens.length);
  }

  if (meetingDate) {
    const parsed = parseLooseDate(meetingDate);
    if (parsed) {
      const target = parsed.toISOString().slice(0, 10);
      const mt = (file.modifiedTime ?? file.createdTime ?? "").slice(0, 10);
      if (mt === target) score += 0.5;
      else {
        // Partial credit within +/- 1 day (timezone fuzziness)
        const diff = Math.abs(
          (new Date(mt).getTime() - parsed.getTime()) / (1000 * 60 * 60 * 24)
        );
        if (diff < 2) score += 0.25;
      }
      // Also check filename contains the date
      if (name.includes(target)) score += 0.2;
      const compact = target.replace(/-/g, "");
      if (name.includes(compact)) score += 0.1;
    }
  }

  return Math.min(1, score);
}

function parseLooseDate(s: string): Date | null {
  if (!s) return null;
  // ISO YYYY-MM-DD
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00`);
  // DD/MM/YYYY or MM/DD/YYYY
  const slash = s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (slash) {
    const [, a, b, y] = slash;
    // Assume DD/MM/YYYY first (user is in India)
    const d = new Date(`${y}-${b.padStart(2, "0")}-${a.padStart(2, "0")}T00:00:00`);
    if (!isNaN(d.getTime())) return d;
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export async function findMatchingTranscripts(
  folderId: string,
  clientName?: string,
  meetingDate?: string,
  topN = 3
) {
  const files = await listFolderFiles(folderId);
  const scored = files
    .map((f) => ({ file: f, score: scoreFile(f, clientName, meetingDate) }))
    .filter((s) => s.score > 0.15)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
  return scored;
}
