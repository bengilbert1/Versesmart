/**
 * Server-only AI response cache.
 *
 * Keyed by function name + a stable hash of the inputs that affect the AI
 * output. Same verse + same params → same cached payload, no AI call.
 *
 * IMPORTANT: never import this file from client-reachable modules at the
 * top level. Inside `.functions.ts` files used by routes/components,
 * import it dynamically inside the `.handler()` body.
 */
import { createClient } from "@supabase/supabase-js";

// Simple non-cryptographic hash (FNV-1a 64-bit, base36).
// Avoids importing node:crypto so this file stays bundle-safe even if
// transitively pulled into a client build.
function hashHex(input: string): string {
  let h1 = 0xcbf29ce4 | 0;
  let h2 = 0x84222325 | 0;
  for (let i = 0; i < input.length; i++) {
    const c = input.charCodeAt(i);
    h1 ^= c;
    h2 ^= c;
    h1 = Math.imul(h1, 0x01000193);
    h2 = Math.imul(h2, 0x01000193);
  }
  return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}

const CACHE_VERSION = "v1";

let _admin: any = null;
function admin(): any {
  if (!_admin) {
    _admin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _admin;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}

export function buildCacheKey(fnName: string, params: Record<string, unknown>): string {
  const canonical = stableStringify(params);
  const hash = hashHex(canonical);
  return `${fnName}:${CACHE_VERSION}:${hash}`;
}

export async function getCached<T>(cacheKey: string): Promise<T | null> {
  try {
    const { data, error } = await admin()
      .from("ai_cache")
      .select("payload, expires_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();
    if (error || !data) return null;
    if (data.expires_at && new Date(data.expires_at as string).getTime() < Date.now()) return null;
    // Fire-and-forget hit_count bump; ignore errors.
    admin()
      .from("ai_cache")
      .update({ hit_count: (data as any).hit_count != null ? (data as any).hit_count + 1 : 1 })
      .eq("cache_key", cacheKey)
      .then(() => {}, () => {});
    return data.payload as T;
  } catch (e) {
    console.error("ai_cache read failed:", e);
    return null;
  }
}

export async function setCached(
  cacheKey: string,
  fnName: string,
  payload: unknown,
  opts?: { ttlDays?: number; model?: string },
): Promise<void> {
  try {
    const expiresAt = opts?.ttlDays
      ? new Date(Date.now() + opts.ttlDays * 24 * 60 * 60 * 1000).toISOString()
      : null;
    await admin().from("ai_cache").upsert(
      {
        cache_key: cacheKey,
        fn_name: fnName,
        payload,
        model: opts?.model ?? null,
        expires_at: expiresAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cache_key" },
    );
  } catch (e) {
    console.error("ai_cache write failed:", e);
  }
}

/**
 * Normalise a verse reference for use in a cache key so casing/whitespace
 * differences don't fragment the cache.
 */
export function normaliseReference(ref: string): string {
  return ref.trim().toLowerCase().replace(/\s+/g, " ");
}
