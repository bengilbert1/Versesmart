import { useEffect, useState } from "react";

const KEY = "vs_client_id";

function generateId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useClientId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    try {
      let v = localStorage.getItem(KEY);
      if (!v) {
        v = generateId();
        localStorage.setItem(KEY, v);
      }
      setId(v);
    } catch {
      setId(generateId());
    }
  }, []);
  return id;
}
