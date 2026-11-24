#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
test "$(deno --version | head -1 | cut -d' ' -f2)" = "2.5.6"
# Build only, never deploy. Dependency graph recorded by Deno.
test -s deno.lock
before=$(sha256sum deno.lock)
deno run --frozen --allow-read --allow-write --allow-env --allow-run npm:esbuild@0.25.5 runtime.cjs --bundle --platform=node --format=cjs --outfile=runtime.bundle.cjs
deno cache --frozen entry.ts deno-smoke.test.ts

deno check --frozen entry.ts
deno cache --frozen entry.ts deno-smoke.test.ts
deno check --frozen entry.ts
deno test --frozen --allow-env deno-smoke.test.ts
test "$before" = "$(sha256sum deno.lock)"
echo 'PASS: committed lockfile unchanged'
