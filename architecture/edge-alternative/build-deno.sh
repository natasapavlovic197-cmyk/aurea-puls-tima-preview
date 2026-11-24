#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
test "$(deno --version | head -1 | cut -d' ' -f2)" = "2.5.6"
# Build only, never deploy. Dependency graph recorded by Deno.
deno run --allow-read --allow-write --allow-env --allow-run npm:esbuild@0.25.5 runtime.cjs --bundle --platform=node --format=cjs --outfile=runtime.bundle.cjs
deno cache entry.ts deno-smoke.test.ts
deno check entry.ts
deno cache --frozen entry.ts deno-smoke.test.ts
deno check --frozen entry.ts
deno test --frozen --allow-env deno-smoke.test.ts
# Public package integrity metadata only; no runtime secrets.
node -e 'const fs=require("fs"); const l=JSON.parse(fs.readFileSync("deno.lock","utf8")); if(!l.npm || !l.specifiers) throw Error("Invalid lockfile"); console.log("AUREA_LOCKFILE_BASE64="+Buffer.from(fs.readFileSync("deno.lock")).toString("base64"))'
