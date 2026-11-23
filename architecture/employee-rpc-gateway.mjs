// Server-only composition of the existing employee RPC protocol and gateway.
// This module does NOT expose a Netlify function or grant SQL EXECUTE permissions.
import {createRequire} from 'node:module';
import {employeeClient} from './employee-rpc-adapter.mjs';
const require=createRequire(import.meta.url);
const {createEmployeeGateway}=require('./employee-server-gateway.cjs');

export function createEmployeeRpcGateway({client,rateLimit}={}){
 if(!client||typeof client.rpc!=='function'||typeof rateLimit!=='function')
  throw new TypeError('Trusted RPC client and durable rate limiter required');
 const adapter=Object.freeze({
  async invitation(hash){return employeeClient(client,hash).invitation()},
  async submit(hash,answers){return employeeClient(client,hash).submit(answers)}
 });
 return createEmployeeGateway({adapter,rateLimit});
}
