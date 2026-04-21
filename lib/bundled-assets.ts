/**
 * Access to files that ship with the deployed app (bundled in the repo).
 * Uses process.cwd() so it works in any deployment environment — no absolute
 * paths to someone's local machine.
 */
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();

export async function loadBundledStyleGuide(): Promise<string> {
  // Allow override for custom style guides — but fall back to the bundled one.
  const override = process.env.PROPOSAL_STYLE_GUIDE;
  if (override) {
    try {
      return await fs.readFile(override, "utf-8");
    } catch {
      // fall through to bundled
    }
  }
  const bundled = path.join(ROOT, "style.md");
  try {
    return await fs.readFile(bundled, "utf-8");
  } catch {
    return "";
  }
}

export async function loadBundledVizuaraLogo(): Promise<Buffer | null> {
  const candidates = [
    path.join(ROOT, "public", "vizuara_logo.png"),
    path.join(ROOT, "public", "vizuara_logo.jpg"),
  ];
  for (const c of candidates) {
    try {
      return await fs.readFile(c);
    } catch {}
  }
  return null;
}

export function bundledVizuaraLogoName(): string {
  return "vizuara_logo.png";
}
