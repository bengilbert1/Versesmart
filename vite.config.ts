// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from 'vite' // or '@tanstack/react-start/config'
// ... your other imports

export default defineConfig({
  // Add or update the server configuration block here:
  server: {
    preset: "vercel"
  },
  // ... rest of your existing config (plugins, paths, etc.)
})