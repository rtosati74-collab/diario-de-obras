// Gera a pasta www/ (o app web que vai dentro do APK)
import { build } from "esbuild";
import { rmSync, mkdirSync, copyFileSync } from "node:fs";
rmSync("www", { recursive: true, force: true });
mkdirSync("www", { recursive: true });
await build({
  entryPoints: { app: "src/app.js" },
  bundle: true, minify: true, format: "iife", target: ["chrome80"],
  outdir: "www", loader: { ".woff": "file", ".woff2": "file" }, assetNames: "fonts/[name]-[hash]",
  legalComments: "none", logLevel: "info"
});
copyFileSync("src/index.html", "www/index.html");
