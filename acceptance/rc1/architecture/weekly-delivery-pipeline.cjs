'use strict';
const {createWeeklyDeliveryStore}=require('./weekly-delivery-store.cjs');
const {createRecipientSender}=require('./weekly-recipient-sender.cjs');
const {createWeeklyDeliveryWorker}=require('./weekly-delivery-worker.cjs');
// Explicit composition; no scheduler, credentials or production provider installed here.
function createDeliveryPipeline({pool,resolveInvitationToken,provider,origin,enabled=false,clock=()=>new Date()}={}){
 const store=createWeeklyDeliveryStore({pool,resolveInvitationToken});
 const sender=createRecipientSender({store,provider,origin,enabled,clock});
 return createWeeklyDeliveryWorker({store,sender,enabled,clock});
}
module.exports={createDeliveryPipeline};
