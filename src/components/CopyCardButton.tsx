import { useState } from "react";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useT } from "@/lib/language-context";


interface CopyCardButtonProps {
  author: string;
  country?: string | null;
  era?: string;
  summary: string;
  keyInsight?: string;
  verseRef?: string;
  className?: string;
}

export function CopyCardButton({
  author,
  country,
  era,
  summary,
  keyInsight,
  verseRef,
  className,
}: CopyCardButtonProps) {
  const [copied, setCopied] = useState(false);
  const t = useT();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const lines: string[] = [];
    // Leading emoji renders as an icon in WhatsApp / iMessage / Slack etc.
    if (verseRef) lines.push(`📖 ${verseRef}`);
    lines.push(`✍️ ${author}`);
    if (era) lines.push(`🗓 ${era}`);
    if (country) lines.push(`🌍 ${country}`);
    lines.push("", summary);
    if (keyInsight) lines.push("", `💡 Key insight: ${keyInsight}`);
    lines.push("", "— via VerseSmart");


    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopied(true);
      toast(t("toasts.copiedToClipboard"));
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={t("copy.summary")}
      title={t("copy.summary")}
      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition hover:bg-accent hover:text-foreground ${className ?? ""}`}

    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-agree" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}
