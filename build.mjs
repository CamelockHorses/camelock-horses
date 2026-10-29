import { build } from "esbuild";
import { cpSync, readFileSync, writeFileSync, rmSync } from "node:fs";

rmSync("dist", { recursive: true, force: true });
cpSync("public", "dist", { recursive: true });
await build({ entryPoints: ["src/main.js"], bundle: true, format: "esm", minify: true, target: "es2020", outfile: "dist/app.js" });
const sw = readFileSync("dist/sw.js", "utf8").replace("__BUILD__", Date.now().toString(36));
writeFileSync("dist/sw.js", sw);
console.log("Built dist/");
