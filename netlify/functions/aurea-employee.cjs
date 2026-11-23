'use strict';
// Public employee submission remains disabled until a durable rate limiter,
// restricted database executor, token abuse controls and end-to-end tests exist.
exports.handler=async()=>({statusCode:503,headers:{'content-type':'application/json','cache-control':'no-store'},body:JSON.stringify({status:'unavailable'})});
