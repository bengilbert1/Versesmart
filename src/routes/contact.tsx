import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Lightbulb, MessageSquare, Mail, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/language-context";


export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — Verse Smart" },
      {
        name: "description",
        content: "Suggest a feature, share feedback, or get in touch with the Verse Smart team.",
      },
    ],
  }),
  component: ContactPage,
});

type Category = "feature" | "feedback" | "contact";

const OPTIONS: { value: Category; label: string; description: string; icon: typeof Lightbulb }[] = [
  {
    value: "feature",
    label: "Suggest a feature",
    description: "Ideas for a future update",
    icon: Lightbulb,
  },
  {
    value: "feedback",
    label: "Share feedback",
    description: "Tell us how we can improve",
    icon: MessageSquare,
  },
  {
    value: "contact",
    label: "Get in touch",
    description: "Questions, partnerships, or anything else",
    icon: Mail,
  },
];

function ContactPage() {
  const [category, setCategory] = useState<Category>("feedback");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const t = useT();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      toast.error(t("toasts.contactMessageRequired"));
      return;
    }
    if (message.length > 5000) {
      toast.error(t("toasts.contactMessageTooLong"));
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("feedback").insert({
      category,
      name: name.trim() || null,
      email: email.trim() || null,
      message: message.trim(),
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    });
    setSubmitting(false);

    if (error) {
      console.error(error);
      toast.error(t("toasts.contactError"));

      return;
    }
    setDone(true);
    setName("");
    setEmail("");
    setMessage("");
  };

  return (
    <main className="mx-auto max-w-2xl px-5 py-12 sm:px-6 sm:py-16">
      <div className="text-center">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          We'd love to hear from you
        </h1>
        <p className="mt-3 text-sm text-muted-foreground sm:text-base">
          Suggest a new feature for a future update, share your experience to help us improve the
          app, or just get in touch.
        </p>
      </div>

      {done ? (
        <div className="mt-10 rounded-2xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Send className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-foreground">Thank you</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your message has been received. We read every one.
          </p>
          <button
            type="button"
            onClick={() => setDone(false)}
            className="mt-6 inline-flex items-center justify-center rounded-xl border border-input bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Send another
          </button>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mt-10 space-y-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8"
        >
          <fieldset>
            <legend className="text-sm font-medium text-foreground">What's this about?</legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = category === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCategory(opt.value)}
                    className={`flex flex-col items-start gap-1.5 rounded-xl border p-3 text-left transition-colors ${
                      active
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-input bg-background hover:bg-accent"
                    }`}
                  >
                    <Icon
                      className={`h-4 w-4 ${active ? "text-primary" : "text-muted-foreground"}`}
                    />
                    <span className="text-sm font-medium text-foreground">{opt.label}</span>
                    <span className="text-xs text-muted-foreground">{opt.description}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-foreground">
                Name <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                id="name"
                type="text"
                maxLength={100}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                id="email"
                type="email"
                maxLength={255}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="So we can reply"
                className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div>
            <label htmlFor="message" className="block text-sm font-medium text-foreground">
              Message
            </label>
            <textarea
              id="message"
              required
              rows={6}
              maxLength={5000}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Tell us what's on your mind..."
              className="mt-1.5 block w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-muted-foreground">{message.length} / 5000</p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            <Send className="h-4 w-4" />
            {submitting ? "Sending..." : "Send message"}
          </button>
        </form>
      )}
    </main>
  );
}
