// Robust JSON parser for LLM responses that may be truncated or contain
// unescaped control chars inside string literals.
export function parseLooseJson(raw: string): unknown {
  let s = raw
    .replace(/```json\s*/gi, "")
    .replace(/```\s*/g, "")
    .trim()
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Try direct parse
  try {
    return JSON.parse(s);
  } catch {}

  // Escape raw newlines/tabs inside string literals
  try {
    const escaped = s.replace(/"((?:[^"\\]|\\.)*)"/gs, (_m, body) =>
      `"${body.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t")}"`,
    );
    return JSON.parse(escaped);
  } catch {}

  // Repair truncation: close unterminated string, then close open brackets
  const repaired = repairTruncated(s);
  return JSON.parse(repaired);
}

function repairTruncated(s: string): string {
  let inString = false;
  let escape = false;
  const stack: string[] = [];
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\") {
      escape = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" || c === "]") stack.pop();
  }
  let out = s;
  // Remove trailing comma
  if (inString) out += '"';
  out = out.replace(/,\s*$/, "");
  while (stack.length) {
    const open = stack.pop();
    out += open === "{" ? "}" : "]";
  }
  return out;
}
