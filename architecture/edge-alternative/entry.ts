// Candidate only. Bundle runtime.cjs into runtime.bundle.cjs before Deno verification.
// Never deploy this file over the existing functions.
import pg from "npm:pg@8.16.3";
import runtime from "./runtime.bundle.cjs";
const routes = new Set(["employee-invitation","employee-submit","manager-summary","manager-workspace","manager-session"]);
let service: ReturnType<typeof runtime.createEdgeRuntime> | undefined;
Deno.serve(async (req: Request) => {
  const route = new URL(req.url).pathname.split("/").filter(Boolean).at(-1) ?? "";
  if (!routes.has(route)) return new Response('{"status":"unavailable"}',{status:404});
  try {
    service ??= runtime.createEdgeRuntime({env:Deno.env.toObject(),Pool:pg.Pool});
    return await service.handle(req,route);
  } catch {
    return new Response('{"status":"unavailable"}',{status:503,headers:{"cache-control":"no-store","content-type":"application/json"}});
  }
});
