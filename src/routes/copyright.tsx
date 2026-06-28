
import { BookOpen, Scale, Languages, Users, Sparkles, Target } from "lucide-react";

export const Route = createFileRoute("/copyright")({
  head: () => ({
    meta: [
      { title: "Copyright & Source Methodology — Verse Smart" },
      {
        name: "description",
        content:
          "How Verse Smart sources public-domain commentaries and summarises contemporary theological perspectives.",
      },
    ],
  }),
  component: CopyrightPage,
});

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 rounded-2xl border border-border bg-card p-6 sm:p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <h2 className="font-display text-xl font-semibold tracking-tight text-foreground sm:text-2xl">{title}</h2>
      </div>
      <div className="mt-5 space-y-4 text-sm leading-relaxed text-muted-foreground sm:text-base">{children}</div>
    </section>
  );
}

function CopyrightPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Legal & Methodology</p>
        <h1 className="font-display mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          Copyright & Source Methodology
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
          How Verse Smart sources classic commentaries and summarises contemporary theological perspectives —
          transparently and within copyright law.
        </p>
      </header>

      <Section icon={Scale} title="Copyright Disclaimer">
        <p>Verse Smart provides comparative summaries and theological insights for educational and devotional use.</p>
        <p>
          All classic commentaries featured in Verse Smart — including Matthew Henry, John Calvin, Charles Spurgeon,
          Albert Barnes, and John Wesley — are sourced from public-domain editions. These works are no longer under
          copyright and may be freely reproduced, adapted, and distributed.
        </p>
        <p>
          Contemporary theologians and authors — including N. T. Wright, D. A. Carson, Tim Keller, John Stott, and John
          Piper — remain under full copyright protection. Verse Smart does not reproduce, quote, scrape, or distribute
          copyrighted text from these authors or their publishers.
        </p>
        <p>
          Instead, Verse Smart provides original summaries, thematic descriptions, and high-level interpretations of
          widely known theological positions. These summaries are:
        </p>
        <ul className="ml-5 list-disc space-y-1.5 marker:text-primary/60">
          <li>written in original language</li>
          <li>non-verbatim</li>
          <li>transformative in nature</li>
          <li>intended for commentary, comparison, and educational analysis</li>
        </ul>
        <p>
          This approach complies with international copyright principles, including fair use and fair dealing provisions
          for commentary, criticism, and educational purposes.
        </p>
        <p>
          If you believe any content on Verse Smart infringes your copyright, please contact us and we will review and
          address the issue promptly.
        </p>
      </Section>

      <div className="mt-16 text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Sources & Methodology</p>
        <h2 className="font-display mt-2 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          How the comparisons are built
        </h2>
      </div>

      <Section icon={BookOpen} title="1. Public-Domain Commentary Sources">
        <p>Verse Smart draws from classic Christian commentaries that are fully in the public domain:</p>
        <ul className="ml-5 list-disc space-y-1.5 marker:text-primary/60">
          <li>Matthew Henry's Commentary on the Whole Bible (1706–1710)</li>
          <li>John Calvin's Commentaries (16th century)</li>
          <li>Charles Spurgeon's Treasury of David and other works (pre-1892)</li>
          <li>Albert Barnes' Notes on the Bible (1834–1870)</li>
          <li>John Wesley's Explanatory Notes (1754–1765)</li>
        </ul>
        <p>Public-domain texts are sourced from reputable repositories such as:</p>
        <ul className="ml-5 list-disc space-y-1.5 marker:text-primary/60">
          <li>Public-domain repositories</li>
          <li>Digitised editions of original print sources</li>
        </ul>
        <p>All texts are reformatted for clarity, readability, and comparison.</p>
      </Section>

      <Section icon={Languages} title="2. Bible Translation">
        <p>
          Verse Smart uses the World English Bible (WEB), a modern-language translation released into the public domain.
          This ensures:
        </p>
        <ul className="ml-5 list-disc space-y-1.5 marker:text-primary/60">
          <li>no licensing fees</li>
          <li>no copyright restrictions</li>
          <li>full freedom to display, quote, and integrate the text</li>
        </ul>
      </Section>

      <Section icon={Users} title="3. Contemporary Voices Methodology">
        <p>
          Verse Smart includes original summaries of theological perspectives from contemporary authors such as N. T.
          Wright, D. A. Carson, Tim Keller, John Stott, and John Piper.
        </p>
        <p>These summaries are:</p>
        <ul className="ml-5 list-disc space-y-1.5 marker:text-primary/60">
          <li>not copied from books, sermons, or websites</li>
          <li>not scraped from copyrighted sources</li>
          <li>not paraphrased from proprietary text</li>
          <li>not reproductions of any protected material</li>
        </ul>
        <p>Instead, they are:</p>
        <ul className="ml-5 list-disc space-y-1.5 marker:text-primary/60">
          <li>high-level descriptions of widely recognised themes</li>
          <li>written in original language</li>
          <li>based on publicly known theological emphases</li>
          <li>generated through research, synthesis, and AI-assisted summarisation</li>
          <li>reviewed and edited for accuracy and originality</li>
        </ul>
        <p>
          This method ensures compliance with copyright law while providing users with helpful comparative insights.
        </p>
      </Section>

      <Section icon={Sparkles} title="4. AI-Assisted Analysis">
        <p>AI is used to:</p>
        <ul className="ml-5 list-disc space-y-1.5 marker:text-primary/60">
          <li>summarise public-domain texts</li>
          <li>contrast theological themes</li>
          <li>generate comparative insights</li>
          <li>assist in organising and presenting information</li>
        </ul>
        <p>
          AI is not used to reproduce copyrighted text from contemporary authors. All AI-generated content is reviewed
          and edited for accuracy, clarity, and originality.
        </p>
      </Section>

      <Section icon={Target} title="5. Purpose of Verse Smart">
        <p>Verse Smart is designed for:</p>
        <ul className="ml-5 list-disc space-y-1.5 marker:text-primary/60">
          <li>personal Bible study</li>
          <li>theological comparison</li>
          <li>educational use</li>
          <li>devotional reflection</li>
        </ul>
        <p>
          It is not intended to replace published commentaries or compete with copyrighted works. Instead, it serves as
          a tool to help users explore Scripture through multiple lenses.
        </p>
      </Section>
    </main>
  );
}
