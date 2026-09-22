// Marks dist-workers/ as CommonJS, overriding the root package.json's
// "type": "module" for just that output tree — the worker is compiled to
// CommonJS (tsconfig.worker.json) since Piscina resolves it via require()/
// dynamic import outside of Next's own bundler.
import { mkdirSync, writeFileSync } from "fs";

mkdirSync("dist-workers", { recursive: true });
writeFileSync("dist-workers/package.json", JSON.stringify({ type: "commonjs" }, null, 2) + "\n");
