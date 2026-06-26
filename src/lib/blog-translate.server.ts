// Server-only helpers that translate a blog post into every supported
// language and persist the static result in `blog_post_translations`.
// Translations are generated ONCE on publish and never re-run at request
// time — every rendered blog page reads static rows from the database.

import { LANGUAGES, type LanguageCode } from "./languages";

type Translation = { title: string; description: string; content: string };

const MODEL = "google/gemini-2.5-flash";
const ENDPOINT = "https://ai.gateway.lovable.dev/v1/chat/completions";

function systemPrompt(langName: string) {
  return [
    `You translate short blog articles from English into ${langName}.`,
    "Preserve the EXACT Markdown formatting of the input: headings (#, ##, ###, ####), bold (**…**), italics (*…*), bullet lists (- …), numbered lists (1. …), block quotes (> …), horizontal rules (---), inline code, fenced code blocks, and links — never drop, add, or restructure them.",
    "Translate proper names only when there is a widely-used native form; otherwise leave them in the original script.",
    "Return JSON ONLY in the requested schema. Do not add commentary.",
  ].join(" ");
}

async function translateOne(
  apiKey: string,
  lang: { code: LanguageCode; englishName: string },
  post: Translation,
): Promise<Translation> {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt(lang.englishName) },
        {
          role: "user",
          content: `Translate the following blog post into ${lang.englishName}. Keep all Markdown formatting intact.\n\n--- TITLE ---\n${post.title}\n\n--- DESCRIPTION ---\n${post.description}\n\n--- CONTENT (Markdown) ---\n${post.content}`,
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "blog_translation",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              title: { type: "string" },
              description: { type: "string" },
              content: { type: "string" },
            },
            required: ["title", "description", "content"],
          },
        },
      },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`AI gateway ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const raw = json.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(raw) as Translation;
  return {
    title: parsed.title || post.title,
    description: parsed.description || post.description,
    content: parsed.content || post.content,
  };
}

export async function translatePostToAllLanguages(postId: string): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: post, error } = await supabaseAdmin
    .from("blog_posts")
    .select("id, title, description, content")
    .eq("id", postId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!post) throw new Error("Post not found");

  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

  const english: Translation = {
    title: post.title,
    description: post.description ?? "",
    content: post.content ?? "",
  };

  const rows: Array<{
    post_id: string; language_code: string;
    title: string; description: string; content: string;
  }> = [];

  // English row is the canonical source.
  rows.push({ post_id: post.id, language_code: "en", ...english });

  const nonEnglish = LANGUAGES.filter((l) => l.code !== "en");
  // Translate sequentially to stay well inside gateway rate limits; this only
  // runs when an admin publishes a post.
  for (const lang of nonEnglish) {
    try {
      const t = await translateOne(apiKey, lang, english);
      rows.push({ post_id: post.id, language_code: lang.code, ...t });
    } catch (err) {
      console.warn(`[blog-translate] ${lang.code} failed, falling back to English`, err);
      rows.push({ post_id: post.id, language_code: lang.code, ...english });
    }
  }

  const { error: upErr } = await supabaseAdmin
    .from("blog_post_translations")
    .upsert(rows, { onConflict: "post_id,language_code" });
  if (upErr) throw new Error(upErr.message);
}
