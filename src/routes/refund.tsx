

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "Refund Policy — VerseSmart" },
      { name: "description", content: "VerseSmart's 30-day money-back guarantee on subscriptions, plus how cancellations and refunds work." },
      { property: "og:title", content: "Refund Policy — VerseSmart" },
      { property: "og:description", content: "VerseSmart's 30-day money-back guarantee on subscriptions, plus how cancellations and refunds work." },
      { property: "og:url", content: "https://versesmart.org/refund" },
    ],
    links: [{ rel: "canonical", href: "https://versesmart.org/refund" }],
  }),
  component: RefundPage,
});

function RefundPage() {
  return (
    <main className="prose prose-sm sm:prose-base mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <h1>Refund Policy</h1>
      <p><em>Last updated: {new Date().toLocaleDateString("en-GB", { year: "numeric", month: "long", day: "numeric" })}</em></p>

      <p>We want you to be happy with Verse Smart. We offer a <strong>30-day money-back guarantee</strong> on any subscription purchase.</p>

      <h2>How it works</h2>
      <ul>
        <li>If you're not satisfied for any reason, you can request a full refund within 30 days of your purchase.</li>
        <li>Refunds are processed by our payment provider, <strong>Paddle</strong>, which is the Merchant of Record for all our orders.</li>
        <li>To request a refund, visit <a href="https://paddle.net" target="_blank" rel="noopener noreferrer">paddle.net</a> and find your purchase, or contact us directly.</li>
        <li>Approved refunds are returned to the original payment method, typically within 5–10 business days depending on your bank or card issuer.</li>
      </ul>

      <h2>Cancellations</h2>
      <p>You can cancel an active subscription at any time from your <a href="/account">Account page</a>. After cancellation you keep access to unlimited features until the end of the billing period you have already paid for. Cancelling does not automatically issue a refund — use the process above if you would also like a refund of the most recent payment.</p>

      <h2>Questions</h2>
      <p>If you have a question about a charge or a refund, contact us through Paddle (the email address shown on your receipt) and we'll help.</p>
    </main>
  );
}
