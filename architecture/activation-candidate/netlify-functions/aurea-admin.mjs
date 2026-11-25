import handler from '../admin-handler.cjs';
export default req=>handler.createHandler({env:process.env})(req);
