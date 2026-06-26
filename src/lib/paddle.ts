import { resolvePaddlePrice } from "@/utils/payments.functions";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN;

declare global {
  interface Window {
    Paddle: any;
  }
}

export function getPaddleEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

let paddleInitialized = false;
let paddleInitPromise: Promise<void> | null = null;

export async function initializePaddle(): Promise<void> {
  if (paddleInitialized) return;
  if (paddleInitPromise) return paddleInitPromise;

  if (!clientToken) {
    throw new Error("VITE_PAYMENTS_CLIENT_TOKEN is not set");
  }

  paddleInitPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://cdn.paddle.com/paddle/v2/paddle.js"]',
    );
    const onReady = () => {
      if (!window.Paddle?.Initialize || !window.Paddle?.Environment?.set) {
        paddleInitPromise = null;
        reject(new Error("Paddle checkout script loaded, but checkout is unavailable."));
        return;
      }
      const paddleJsEnvironment =
        getPaddleEnvironment() === "sandbox" ? "sandbox" : "production";
      window.Paddle.Environment.set(paddleJsEnvironment);
      window.Paddle.Initialize({
        token: clientToken,
        eventCallback: (event: any) => {
          if (event?.name === "checkout.error" || event?.type === "checkout.error") {
            console.error("[paddle] checkout.error event", event);
          } else {
            console.log("[paddle] event", event?.name ?? event?.type, event);
          }
        },
      });
      paddleInitialized = true;
      resolve();
    };
    if (existing && window.Paddle) {
      onReady();
      return;
    }
    if (existing && !window.Paddle) {
      existing.remove();
    }
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.onload = onReady;
    script.onerror = () => {
      script.remove();
      paddleInitPromise = null;
      reject(new Error("Could not load Paddle checkout. Please check your connection and try again."));
    };
    document.head.appendChild(script);
  });

  return paddleInitPromise;
}

export async function getPaddlePriceId(priceId: string): Promise<string> {
  const environment = getPaddleEnvironment();
  return resolvePaddlePrice({ data: { priceId, environment } });
}
