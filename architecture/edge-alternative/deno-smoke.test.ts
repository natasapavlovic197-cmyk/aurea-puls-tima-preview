import pg from "npm:pg@8.16.3";
// @ts-types="./runtime.bundle.d.cts"
import runtime from "./runtime.bundle.cjs";
Deno.test("driver loads, runtime remains closed without approval", () => {
  if(typeof pg.Pool !== "function") throw Error("Missing driver");
  let constructed = false;
  class ForbiddenPool { constructor(){ constructed=true; throw Error("Unexpected pool"); } }
  let refused=false;
  try { runtime.createEdgeRuntime({env:{},Pool:ForbiddenPool}); } catch { refused=true; }
  if(!refused || constructed) throw Error("Approval gate failed");
});
Deno.test("no administrator fallback", () => {
  let refused=false;
  try { runtime.createEdgeRuntime({env:{AUREA_EDGE_MANAGER_ENABLED:"true",AUREA_EDGE_MANAGER_APPROVED:"true",AUREA_SUPABASE_URL:"https://ublzmoroanhlcgpnxilw.supabase.co",AUREA_STAGING_DATABASE_USER:"postgres"},Pool:pg.Pool}); } catch { refused=true; }
  if(!refused) throw Error("Admin fallback");
});
