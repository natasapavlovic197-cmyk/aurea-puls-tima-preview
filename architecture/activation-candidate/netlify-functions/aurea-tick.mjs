import auth from '../background-auth.cjs';
import policyModule from '../policy.cjs';
import orchestrator from '../../weekly-orchestrator.cjs';
export const config={schedule:'*/15 * * * *'};
export default async function(){
 const env=process.env,p=orchestrator.belgradeParts(new Date());
 if(['monday','wednesday','friday'].includes(p.day)&&p.hour>=9&&policyModule.policy(env).scheduler)await auth.trigger('scheduler',env);
 if(policyModule.policy(env).delivery)await auth.trigger('delivery',env);
 return new Response(null,{status:204});
}
