/**
 * Storage abstraction — shared across all API routes.
 *
 * Keys follow the convention "{slug}/{filename}" (e.g. "acme/proposal.pdf").
 * Two drivers:
 *  - "supabase" (production): writes to a Supabase Storage bucket.
 *  - "local" (dev fallback): writes to PROPOSAL_OUTPUT_DIR on the local filesystem.
 *
 * Driver auto-selection: if SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set,
 * use Supabase. Otherwise local. Force with PROPOSAL_STORAGE=supabase|local.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export interface Storage {
  put(key: string, data: Buffer | string, contentType?: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  getText(key: string): Promise<string>;
  list(prefix: string): Promise<string[]>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
  copy(from: string, to: string): Promise<void>;
  /** URL the browser can hit to download the object (may be /api/file or a signed CDN URL). */
  publicUrl(key: string): string;
}

// ---------- LOCAL DRIVER ----------

class LocalStorage implements Storage {
  private root: string;
  constructor() {
    this.root =
      process.env.PROPOSAL_OUTPUT_DIR ||
      path.join(process.cwd(), ".proposal-output");
  }
  private full(key: string) {
    if (key.includes("..")) throw new Error("bad key");
    return path.join(this.root, key);
  }
  async put(key: string, data: Buffer | string) {
    const p = this.full(key);
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, typeof data === "string" ? data : data);
  }
  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.full(key));
  }
  async getText(key: string): Promise<string> {
    return fs.readFile(this.full(key), "utf-8");
  }
  async list(prefix: string): Promise<string[]> {
    const dir = this.full(prefix.replace(/\/$/, ""));
    try {
      const entries = await fs.readdir(dir);
      return entries.map((e) => path.posix.join(prefix.replace(/\/$/, ""), e));
    } catch {
      return [];
    }
  }
  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.full(key));
      return true;
    } catch {
      return false;
    }
  }
  async delete(key: string) {
    try {
      await fs.unlink(this.full(key));
    } catch {}
  }
  async copy(from: string, to: string) {
    const src = this.full(from);
    const dst = this.full(to);
    await fs.mkdir(path.dirname(dst), { recursive: true });
    await fs.copyFile(src, dst);
  }
  publicUrl(key: string): string {
    const [slug, ...rest] = key.split("/");
    return `/api/file?slug=${encodeURIComponent(slug)}&name=${encodeURIComponent(
      rest.join("/")
    )}`;
  }
}

// ---------- SUPABASE DRIVER ----------

class SupabaseStorage implements Storage {
  private client: SupabaseClient;
  private bucket: string;
  constructor() {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    this.bucket = process.env.SUPABASE_BUCKET || "proposals";
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  async put(key: string, data: Buffer | string, contentType?: string) {
    const body = typeof data === "string" ? Buffer.from(data, "utf-8") : data;
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(key, body, {
        upsert: true,
        contentType: contentType || guessContentType(key),
      });
    if (error) throw new Error(`supabase put ${key}: ${error.message}`);
  }
  async get(key: string): Promise<Buffer> {
    const { data, error } = await this.client.storage.from(this.bucket).download(key);
    if (error || !data) throw new Error(`supabase get ${key}: ${error?.message}`);
    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
  }
  async getText(key: string): Promise<string> {
    const buf = await this.get(key);
    return buf.toString("utf-8");
  }
  async list(prefix: string): Promise<string[]> {
    const folder = prefix.replace(/\/$/, "");
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .list(folder, { limit: 1000 });
    if (error) return [];
    return (data ?? []).map((f) => `${folder}/${f.name}`);
  }
  async exists(key: string): Promise<boolean> {
    const slash = key.lastIndexOf("/");
    const folder = slash >= 0 ? key.slice(0, slash) : "";
    const name = slash >= 0 ? key.slice(slash + 1) : key;
    const { data, error } = await this.client.storage
      .from(this.bucket)
      .list(folder, { search: name, limit: 100 });
    if (error) return false;
    return (data ?? []).some((f) => f.name === name);
  }
  async delete(key: string) {
    await this.client.storage.from(this.bucket).remove([key]);
  }
  async copy(from: string, to: string) {
    const { error } = await this.client.storage.from(this.bucket).copy(from, to);
    if (error) {
      // Fall back to get+put
      const buf = await this.get(from);
      await this.put(to, buf);
    }
  }
  publicUrl(key: string): string {
    // Route through the server so access is controlled — the client never sees service-role URLs.
    const [slug, ...rest] = key.split("/");
    return `/api/file?slug=${encodeURIComponent(slug)}&name=${encodeURIComponent(
      rest.join("/")
    )}`;
  }
}

function guessContentType(key: string): string {
  const ext = path.extname(key).toLowerCase();
  return (
    {
      ".pdf": "application/pdf",
      ".tex": "text/x-tex",
      ".json": "application/json",
      ".md": "text/markdown",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".txt": "text/plain",
    }[ext] || "application/octet-stream"
  );
}

// ---------- FACTORY ----------

let singleton: Storage | null = null;

export function getStorage(): Storage {
  if (singleton) return singleton;
  const forced = process.env.PROPOSAL_STORAGE?.toLowerCase();
  const hasSupabase =
    !!process.env.SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (forced === "supabase" || (!forced && hasSupabase)) {
    singleton = new SupabaseStorage();
  } else {
    singleton = new LocalStorage();
  }
  return singleton;
}

export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "unnamed-client"
  );
}
