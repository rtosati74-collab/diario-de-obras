// Gera dist/ (a interface do programa)
import { build } from "esbuild";
import { rmSync, mkdirSync, copyFileSync } from "node:fs";
rmSync("dist", { recursive: true, force: true });
mkdirSync("dist", { recursive: true });
await build({
  entryPoints: { app: "src/app.js" },
  bundle: true, minify: true, format: "iife", target: ["chrome120"],
  outdir: "dist", loader: { ".woff": "file", ".woff2": "file" }, assetNames: "fonts/[name]-[hash]",
  legalComments: "none", logLevel: "info"
});
copyFileSync("src/index.html", "dist/index.html");
