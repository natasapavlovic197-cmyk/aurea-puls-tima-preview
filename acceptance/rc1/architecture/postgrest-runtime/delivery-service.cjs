'use strict';
const {createDeliveryHttpsPool}=require('./delivery-https-pool.cjs');
const {createInvitationTokenSource,createInvitationIssuer}=require('../staging-delivery-service.cjs');
const {createDeliveryPipeline}=require('../weekly-delivery-pipeline.cjs');
function prepareHttpsDelivery({url,key,readToken,hmacSecret,origin,clock,fetchImpl=globalThis.fetch,enabled=false}={}){
 if(enabled!==false)throw Error('Delivery activation not approved');
 const pool=createDeliveryHttpsPool({url,key,readToken,fetchImpl});
 const tokens=createInvitationTokenSource(hmacSecret);
 const provider={async send(){throw Error('Email delivery prohibited')}};
 return Object.freeze({processNext:createDeliveryPipeline({pool,resolveInvitationToken:tokens.resolveInvitationToken,provider,origin,clock,enabled:false}),issue:createInvitationIssuer({pool,tokens})});
}
module.exports={prepareHttpsDelivery};
