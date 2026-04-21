import { NextRequest, NextResponse } from "next/server";
import { findMatchingTranscripts, getFileText, listFolderFiles } from "@/lib/drive";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST { clientName, meetingDate, fetchTextFor? (fileId) }
 * - If fetchTextFor provided: returns the file's text content.
 * - Otherwise: returns top matching files with scores.
 */
export async function POST(req: NextRequest) {
  try {
    const { clientName, meetingDate, fetchTextFor } = await req.json();
    const folderId = process.env.MEET_TRANSCRIPTS_FOLDER_ID;
    if (!folderId) {
      return NextResponse.json(
        { configured: false, error: "MEET_TRANSCRIPTS_FOLDER_ID not set" },
        { status: 200 }
      );
    }
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
      return NextResponse.json(
        { configured: false, error: "Service account not configured" },
        { status: 200 }
      );
    }

    // Sanity-check access: try listing (will throw with a clear message if folder isn't shared).
    try {
      if (fetchTextFor) {
        const files = await listFolderFiles(folderId);
        const file = files.find((f) => f.id === fetchTextFor);
        if (!file) {
          return NextResponse.json({ error: "File not in folder" }, { status: 404 });
        }
        const text = await getFileText(file);
        return NextResponse.json({ file, text });
      }

      const matches = await findMatchingTranscripts(folderId, clientName, meetingDate);
      return NextResponse.json({ configured: true, matches });
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      return NextResponse.json(
        {
          configured: true,
          error: msg,
          hint: msg.includes("not found") || msg.includes("permission") || msg.includes("forbidden")
            ? "Share the Drive folder with vizuara-drive-uploader@vizuara-pods.iam.gserviceaccount.com (Viewer access)."
            : undefined,
          matches: [],
        },
        { status: 200 }
      );
    }
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message ?? "drive search failed" },
      { status: 500 }
    );
  }
}
