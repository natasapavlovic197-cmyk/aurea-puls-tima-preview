'use strict';
function createLimiterRoleQuery(pool){
 if(typeof pool?.connect!=='function')throw TypeError('Pool required');
 return async function query(sql,args){
 const client=await pool.connect();
 let discard=false;
 try{
 await client.query('BEGIN');
 await client.query('SET LOCAL ROLE aurea_rate_limiter');
 const result=await client.query(sql,args);
 await client.query('COMMIT');
 return result;
 }catch(e){
 try{await client.query('ROLLBACK');}catch{discard=true;}
 throw e;
 }finally{client.release(discard);}
 };
}
module.exports={createLimiterRoleQuery};
