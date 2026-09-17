// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";
import type { Plugin } from "vite";

const THREE_SOURCE_MODULE = /src\/components\/(?:BitmapWorld3D|extenders\/Extender(?:Props|Stage)|game\/).*\.(?:jsx|tsx)$/;

/**
 * TanStack's development source inspector annotates every JSX element with a
 * data-tsd-source attribute. React Three Fiber treats dashed props as nested
 * Three.js properties, so those DOM-only annotations crash the canvas before
 * it mounts. Strip the annotation from every module that renders into R3F;
 * source inspection remains enabled everywhere else in the app.
 */
function stripThreeSourceAnnotations(): Plugin {
  return {
    name: "bitmap:strip-three-source-annotations",
    enforce: "post",
    apply: "serve",
    transform(code, id) {
      const cleanId = id.split("?", 1)[0]?.replaceAll("\\", "/");
      if (!cleanId || !THREE_SOURCE_MODULE.test(cleanId)) return null;

      const stripped = code.replace(/\sdata-tsd-source=(?:"[^"]*"|'[^']*'|\{[^}]*\})/g, "");
      if (stripped === code) return null;
      return { code: stripped, map: null };
    },
  };
}

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [mcpPlugin(), stripThreeSourceAnnotations()],
  },
});
