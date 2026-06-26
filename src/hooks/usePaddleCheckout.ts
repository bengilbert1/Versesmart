import { useState } from "react";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";
import { useAuth } from "./useAuth";

export function usePaddleCheckout() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const openCheckout = async (priceId: string) => {
    if (!user) throw new Error("Sign in required");
    setLoading(true);
    try {
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(priceId);
      if (!window.Paddle?.Checkout?.open) {
        throw new Error("Checkout is not available right now. Please try again.");
      }

      // Listen for Paddle errors via global event callback
      const checkoutPayload: any = {
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        settings: {
          displayMode: "overlay",
          successUrl: `${window.location.origin}/account?checkout=success`,
          allowLogout: false,
          theme: "light",
        },
      };
      if (user.email) {
        checkoutPayload.customer = { email: user.email };
      }
      if (user.id) {
        checkoutPayload.customData = { userId: String(user.id) };
      }

      console.log("[paddle] opening checkout", { paddlePriceId, payload: checkoutPayload });
      window.Paddle.Checkout.open(checkoutPayload);
    } catch (err) {
      console.error("[paddle] checkout failed", err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
