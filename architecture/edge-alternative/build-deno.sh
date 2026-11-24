#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
test "$(deno --version | head -1 | cut -d' ' -f2)" = "2.5.6"
# Build only, never deploy. Dependency graph recorded by Deno.
deno run --allow-read --allow-write --allow-env --allow-run npm:esbuild@0.25.5 runtime.cjs --bundle --platform=node --format=cjs --outfile=runtime.bundle.cjs
deno cache entry.ts
deno check entry.ts
deno cache --frozen entry.ts
deno check --frozen entry.ts
deno test --frozen --allow-env=NODE_DEBUG,NODE_ENV,PGHOST,PGPORT,PGUSER,PGPASSWORD,PGDATABASE,PGSSLMODE,PGSERVICE,PGOPTIONS,PGCONNECT_TIMEOUT deno-smoke.test.ts
