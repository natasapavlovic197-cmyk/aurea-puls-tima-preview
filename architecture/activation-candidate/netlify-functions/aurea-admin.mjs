import handler from '../admin-handler.cjs';
export const config={path:'/.netlify/functions/aurea-admin',method:['POST','OPTIONS'],rateLimit:{windowLimit:30,windowSize:60,aggregateBy:['ip','domain']}};
export default req=>handler.createHandler({env:process.env})(req);
