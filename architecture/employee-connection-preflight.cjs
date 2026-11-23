'use strict';
// Read-only credential preflight. Never prints passwords, hashes or connection strings.
// Run only from a trusted server after setting secrets in its environment.
const {createEmployeeRuntime}=require('./employee-runtime.cjs');
async function verifyEmployeeDatabaseAccess({env,Pool}={}){
 const runtime=createEmployeeRuntime({env,Pool});
 try{
  // The runtime must not expose a public endpoint during this check.
  // An invalid hash is intentionally used; it must never consume an invitation.
  const hash='0'.repeat(64);
  // The public gateway cannot be exercised without a real trusted source IP and limiter;
  // independently verify the employee SQL identity and read-only invitation operation.
  const {createRestrictedEmployeeAdapter}=require('./restricted-employee-adapter.cjs');
  const pool=new Pool({
   host:env.AUREA_STAGING_DATABASE_HOST,port:5432,database:env.AUREA_STAGING_DATABASE_NAME,
   user:'aurea_employee_login',password:env.AUREA_EMPLOYEE_DATABASE_PASSWORD,
   ssl:{rejectUnauthorized:true},max:1,connectionTimeoutMillis:4000,idleTimeoutMillis:10000
  });
  try{
   const result=await createRestrictedEmployeeAdapter({pool}).invitation(hash);
   if(!result||result.status==='ready'||typeof result.status!=='string')throw Error('Unexpected invalid-token result');
   return Object.freeze({employeeLoginVerified:true,invalidTokenRejected:true});
  }finally{await pool.end()}
 }finally{await runtime.close()}
}
module.exports={verifyEmployeeDatabaseAccess};
