import { useState } from "react";
import { Share2, MessageCircle, Mail, Copy, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const SHARE_TEXT = "Any Bible verse, Global perspectives, What's yours? VerseSmart lets you compare how theologians from different cultures, traditions, and worldviews interpret any Bible verse — all in one place.";
const SHARE_URL = "https://www.versesmart.org";

export function ShareAppButton() {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);

  const fullText = `${SHARE_TEXT} ${SHARE_URL}`;

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const handleEmail = () => {
    const subject = encodeURIComponent("Check out Verse Smart");
    const body = encodeURIComponent(fullText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setOpen(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground">
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">Share this app with a friend</span>
          <span className="sm:hidden">Share</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 space-y-2 p-3" align="center" sideOffset={6}>
        <p className="text-xs font-medium text-muted-foreground">Share Verse Smart</p>
        <button
          onClick={handleWhatsApp}
          className="flex w-full items-center gap-3 rounded-xl bg-[#25D366] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          <MessageCircle className="h-4 w-4" />
          Share on WhatsApp
        </button>
        <button
          onClick={handleEmail}
          className="flex w-full items-center gap-3 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
        >
          <Mail className="h-4 w-4" />
          Share by Email
        </button>
        <button
          onClick={handleCopy}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground transition hover:bg-accent"
        >
          {copied ? <Check className="h-4 w-4 text-agree" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied!" : "Copy link"}
        </button>
      </PopoverContent>
    </Popover>
  );
}
