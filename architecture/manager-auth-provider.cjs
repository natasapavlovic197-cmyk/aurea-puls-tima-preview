'use strict';
function createManagerSignIn(client){
 const auth=client?.auth;
 if(!auth||['signInWithPassword','getSession','onAuthStateChange','signOut'].some(k=>typeof auth[k]!=='function'))throw TypeError('Auth client required');
 return async function signIn(email,password){
 const {data,error}=await auth.signInWithPassword({email,password});
 if(error||!data?.session?.access_token)throw Error('Sign-in failed');
 return {
 async readSession(){const result=await auth.getSession();if(result.error)throw Error('Session unavailable');return result.data.session;},
 subscribe(fn){const {data}=auth.onAuthStateChange(event=>fn(event));return ()=>data.subscription.unsubscribe();},
 async signOut(){const result=await auth.signOut({scope:'local'});if(result.error)throw Error('Sign-out failed');}
 };
 };
}
module.exports={createManagerSignIn};
