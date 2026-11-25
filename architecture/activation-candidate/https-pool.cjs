'use strict';
const {verifyPublic}=require('../postgrest-runtime/production-runtime-gate.cjs');
const {requireRole}=require('./policy.cjs');
// Server-only adapter. Dedicated short-lived bearer token, never a database password.
const operations=[
  [
    "claim",
    "select id,organization_id,week_start,action,lease_token from aurea_private.claim_weekly_delivery_job($1::uuid)",
    [
      "p_lease_token"
    ]
  ],
  [
    "finish",
    "select aurea_private.finish_weekly_delivery_job($1::bigint,$2::uuid,true) as finished",
    [
      "p_id",
      "p_lease_token"
    ],
    true
  ],
  [
    "finish",
    "select aurea_private.finish_weekly_delivery_job($1::bigint,$2::uuid,false) as finished",
    [
      "p_id",
      "p_lease_token"
    ],
    false
  ],
  [
    "snapshot",
    "select aurea_private.delivery_snapshot($1::bigint,$2::uuid,$3::uuid,$4::date,$5::text) as snapshot",
    [
      "p_job",
      "p_lease",
      "p_org",
      "p_week",
      "p_action"
    ]
  ],
  [
    "publications",
    "select * from aurea_private.delivery_publications($1::bigint,$2::uuid,$3::uuid,$4::date)",
    [
      "p_job",
      "p_lease",
      "p_org",
      "p_week"
    ]
  ],
  [
    "reserve",
    "select aurea_private.reserve_recipient_delivery($1::bigint,$2::uuid,$3::uuid,$4::text) as state",
    [
      "p_job",
      "p_lease",
      "p_recipient",
      "p_key"
    ]
  ],
  [
    "receipt",
    "select aurea_private.finish_recipient_delivery($1::bigint,$2::uuid,$3::text,$4::text,$5::boolean) as finished",
    [
      "p_job",
      "p_lease",
      "p_key",
      "p_provider",
      "p_confirm"
    ]
  ],
  [
    "digest",
    "select aurea_private.persist_weekly_digest($1::bigint,$2::uuid,$3::jsonb) as finished",
    [
      "p_job",
      "p_lease",
      "p_digest"
    ]
  ],
  [
    "issue",
    "select aurea_private.issue_hmac_invitation($1::uuid,$2::date,$3::uuid,$4::text,$5::text,$6::timestamptz) as state",
    [
      "p_org",
      "p_week",
      "p_id",
      "p_address",
      "p_hash",
      "p_expires"
    ]
  ]
];
function createDeliveryHttpsPool({url,key,readToken,fetchImpl=globalThis.fetch,role,env}={}){
 verifyPublic({url,key});requireRole(role,env);
 if(url!=='https://dlibifwlmbfkboerlmqd.supabase.co'||typeof key!=='string'||!key.startsWith('sb_publishable_')||typeof readToken!=='function')throw TypeError('Invalid production delivery configuration');
 const allowed=new Map(operations.map(o=>[o[1],o]));
 return Object.freeze({async query(query,args){
  requireRole(role,env);
  const op=allowed.get(query);
  if(!op||(role==='scheduler'&&op[0]!=='issue')||(role==='delivery'&&op[0]==='issue')||!Array.isArray(args)||args.length!==op[2].length)throw TypeError('Unapproved delivery operation');
  const payload=Object.fromEntries(op[2].map((k,i)=>[k,args[i]]));
  if(op[0]==='finish')payload.p_success=op[3];
  if(op[0]==='digest')payload.p_digest=JSON.parse(payload.p_digest);
  const token=await readToken();
  if(typeof token!=='string'||!/^[-\w]+\.[-\w]+\.[-\w]+$/.test(token))throw Error('Dedicated delivery session required');
  const res=await fetchImpl(url+'/rest/v1/rpc/aurea_delivery_'+op[0],{method:'POST',headers:{apikey:key,authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify(payload),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!res.ok)throw Error('Delivery HTTPS denied: '+res.status);
  const rows=await res.json();
  if(!Array.isArray(rows))throw Error('Invalid delivery response');
  return {rows};
 }});
}
module.exports={createDeliveryHttpsPool};
