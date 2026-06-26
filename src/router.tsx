import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Prefetch route data on hover/focus intent — makes navigation feel instant.
    // Routes that rely on TanStack Query keep `defaultPreloadStaleTime: 0` so
    // Query controls freshness; routes that read straight from loader data can
    // opt into a longer per-route `staleTime` / `preloadStaleTime`.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  });

  return router;
};
