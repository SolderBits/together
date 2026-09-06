/**
 * Bundles the custom server.
 *
 * `next build` compiles the application; it does not compile the process that
 * hosts it. This turns `server/index.ts` — which imports the realtime server,
 * the data layer and the `@/` path alias — into one plain `.mjs` that Node can
 * run with no loader and no TypeScript at runtime.
 *
 * Next itself stays external: it is a large dependency with its own runtime
 * requirements and bundling it would be both slow and wrong.
 */
import { build } from "esbuild";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

await build({
  entryPoints: [join(root, "server/index.ts")],
  outfile: join(root, "dist/server.mjs"),
  platform: "node",
  target: "node20",
  format: "esm",
  bundle: true,
  sourcemap: true,
  // Anything with a native binding, a large runtime, or its own resolution
  // rules is left to Node to require at runtime.
  external: ["next", "pg", "pg-native", "ws", "jose", "@aws-sdk/*"],
  alias: {
    "@": root,
    // `server-only` is a marker that throws unless the bundler resolved it
    // under the `react-server` condition. Next does that for its own code; this
    // is a plain Node process, so it resolves to the package's own no-op build
    // instead. The guarantee it provides — that this code cannot reach a client
    // bundle — is enforced by Next at build time and by check-db-access.mjs,
    // not by the throw.
    "server-only": join(root, "node_modules/server-only/empty.js"),
  },
  banner: {
    // Bundled ESM that pulls in CommonJS needs these; esbuild does not add them.
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      "import { fileURLToPath as __fileURLToPath } from 'node:url';",
      "import { dirname as __dirname_ } from 'node:path';",
      "const require = __createRequire(import.meta.url);",
      "const __filename = __fileURLToPath(import.meta.url);",
      "const __dirname = __dirname_(__filename);",
    ].join("\n"),
  },
  logLevel: "info",
});

console.log("  built dist/server.mjs");
