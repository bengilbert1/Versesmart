import { z } from "zod";
import { normalizeName } from "./commentator-metadata";
import { KNOWN_COMMENTATORS } from "./known-commentators";

/**
 * NOTE:
 * All logic moved server-side (Vercel/Supabase functions).
 * This file is now a thin client-safe API wrapper layer.
 */

const ADMIN_EMAIL = "gilbertbg@gmail.com";

function assertAdmin(email?: string) {
  if (!email || email.toLowerCase() !== ADMIN_EMAIL) {
    throw new Error("Not authorized");
  }
}

/* ---------------------------
   TYPES (unchanged)
---------------------------- */

export type CommentatorOverrideRow = {
  id: string;
  name_key: string;
  display_name: string;
  region: string | null;
  denomination: string | null;
  country: string | null;
  tradition: string | null;
  worldview: string | null;
  gender: string | null;
  publication_era: string | null;
  birth_year: number | null;
  death_year: number | null;
  portrait_url: string | null;
  is_primary: boolean;
  is_manual: boolean;
  is_hidden: boolean;
};

export type CommentatorCategoryRow = {
  id: string;
  category_type: string;
  value: string;
  label: string | null;
};

/* ---------------------------
   API WRAPPERS (CLIENT SAFE)
---------------------------- */

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}

/* ---------------------------
   OVERRIDES
---------------------------- */

export const listCommentatorOverrides = () =>
  api<CommentatorOverrideRow[]>("/api/commentators/overrides");

export const upsertCommentatorOverride = (input: unknown) =>
  api("/api/commentators/overrides/upsert", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const deleteCommentatorOverride = (id: string) =>
  api("/api/commentators/overrides/delete", {
    method: "POST",
    body: JSON.stringify({ id }),
  });

export const setPrimaryDuplicate = (id: string) =>
  api("/api/commentators/overrides/set-primary", {
    method: "POST",
    body: JSON.stringify({ id }),
  });

export const setOverrideHidden = (input: {
  id: string;
  hidden: boolean;
}) =>
  api("/api/commentators/overrides/set-hidden", {
    method: "POST",
    body: JSON.stringify(input),
  });

/* ---------------------------
   DELETE / RESTORE
---------------------------- */

export const listDeletedCommentators = () =>
  api<string[]>("/api/commentators/deleted");

export const deleteCommentatorGlobally = (display_name: string) =>
  api("/api/commentators/delete-global", {
    method: "POST",
    body: JSON.stringify({ display_name }),
  });

/* ---------------------------
   CATEGORY SYSTEM
---------------------------- */

export const listCommentatorCategories = () =>
  api<CommentatorCategoryRow[]>("/api/commentators/categories");

export const addCommentatorCategory = (input: unknown) =>
  api("/api/commentators/categories/add", {
    method: "POST",
    body: JSON.stringify(input),
  });

/* ---------------------------
   MANUAL / SIMPLE LISTS
---------------------------- */

export const listManualCommentators = () =>
  api<string[]>("/api/commentators/manual");

export const listAllSelectableCommentators = () =>
  api<string[]>("/api/commentators/selectable");

/* ---------------------------
   PORTRAIT SYSTEM
---------------------------- */

export const setCommentatorPortrait = (input: {
  display_name: string;
  data_url: string;
}) =>
  api("/api/commentators/portrait/set", {
    method: "POST",
    body: JSON.stringify(input),
  });

export const removeCommentatorPortrait = (id: string) =>
  api("/api/commentators/portrait/remove", {
    method: "POST",
    body: JSON.stringify({ id }),
  });

export const migrateLegacyPortraitsToStorage = () =>
  api("/api/commentators/portrait/migrate", {
    method: "POST",
  });

/* ---------------------------
   SEEN / ANALYTICS
---------------------------- */

export const listSeenCommentators = () =>
  api("/api/commentators/seen");

export const getCountryAnalytics = () =>
  api("/api/commentators/country-analytics");

export const getLastLookupRoster = () =>
  api("/api/commentators/last-lookup");