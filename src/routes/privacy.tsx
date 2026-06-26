import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — VerseSmart" },
      { name: "description", content: "How VerseSmart collects, uses, and protects your personal data, with your rights under GDPR." },
      { property: "og:title", content: "Privacy Notice — VerseSmart" },
      { property: "og:description", content: "How VerseSmart collects, uses, and protects your personal data, with your rights under GDPR." },
      { property: "og:url", content: "https://versesmart.org/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://versesmart.org/privacy" }],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <main className="prose prose-sm sm:prose-base mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <h1>Privacy Notice</h1>
      <p>
        <em>
          Last updated: {new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}
        </em>
      </p>

      <p>
        This notice explains how <strong>Refuge</strong> ("we") collects, uses, and shares personal data through Verse
        Smart ("the Service"). We act as the data controller for the personal data described below.
      </p>

      <h2>What we collect and why</h2>
      <ul>
        <li>
          <strong>Account data</strong> (email, hashed password, OAuth identifiers if you sign in with Google) — to
          create and secure your account. Legal basis: performance of contract.
        </li>
        <li>
          <strong>Usage data</strong> (the verse references you look up, a random browser identifier, the date of each
          lookup) — to enforce the free 3-lookups-per-day limit and to operate the Service. Legal basis: legitimate
          interest in providing the Service.
        </li>
        <li>
          <strong>Subscription data</strong> (subscription status, plan, billing-period dates, Paddle customer &
          subscription IDs) — to grant access to paid features. Legal basis: performance of contract.
        </li>
        <li>
          <strong>Support communications</strong> if you contact us. Legal basis: legitimate interest in responding to
          you.
        </li>
        <li>
          <strong>Technical telemetry</strong> (IP address, browser type, error logs) collected by our hosting and
          error-reporting providers — for security, abuse prevention, and reliability. Legal basis: legitimate interest.
        </li>
      </ul>

      <p>
        We do <strong>not</strong> collect or store your payment card details — those are handled directly by Paddle.
      </p>

      <h2>Who we share data with</h2>
      <ul>
        <li>
          <strong>Hosting & backend</strong> — Lovable Cloud (which uses Supabase) to host the application, database,
          and authentication.
        </li>
        <li>
          <strong>Payments</strong> — <strong>Paddle.com</strong>, our Merchant of Record, who processes payments,
          manages subscriptions, calculates and remits tax, and issues invoices. Paddle's privacy notice is available on
          their website.
        </li>
        <li>
          <strong>AI provider</strong> — Lovable AI gateway forwards your Bible reference (not your account data) to a
          large-language-model provider to generate the commentary summary.
        </li>
        <li>
          <strong>Authorities</strong> where required by law.
        </li>
        <li>
          <strong>Professional advisers</strong> (e.g. legal, accounting) when necessary.
        </li>
      </ul>
      <p>We do not sell your personal data.</p>

      <h2>International transfers</h2>
      <p>
        Some of these providers operate outside your country (including the EEA, UK, and the US). Where transfers occur
        we rely on appropriate safeguards such as Standard Contractual Clauses or adequacy decisions.
      </p>

      <h2>How long we keep data</h2>
      <ul>
        <li>
          Account data: while your account exists, plus a short retention period for backups and legal obligations.
        </li>
        <li>
          Daily usage rows: cleaned up regularly (within a few days) — they exist only to enforce the daily limit.
        </li>
        <li>
          Subscription records: retained as long as needed for tax and accounting obligations (typically up to 7 years).
        </li>
      </ul>

      <h2>Your rights</h2>
      <p>
        Depending on your country, you may have rights to access, correct, delete, restrict, port, or object to
        processing of your personal data, and to withdraw consent. You may also complain to your local data-protection
        authority. To exercise any of these rights, contact us through the email on your Paddle receipt or our support
        page. We aim to respond within one month.
      </p>

      <h2>Security</h2>
      <p>
        We use industry-standard technical and organisational measures (encryption in transit, access controls, hashed
        passwords) to protect your data. No system is perfectly secure — please use a strong, unique password.
      </p>

      <h2>Cookies</h2>
      <p>
        We use only essential storage: a small browser identifier (in localStorage) for the daily-lookup limit, and an
        authentication session cookie/token when you sign in. We do not currently use third-party analytics or marketing
        cookies.
      </p>

      <h2>Children</h2>
      <p>
        The Service is not directed at children under 13. If you believe a child has provided us with personal data,
        contact us and we will delete it.
      </p>

      <h2>Changes</h2>
      <p>We may update this notice from time to time. The "last updated" date above reflects the most recent change.</p>
    </main>
  );
}
