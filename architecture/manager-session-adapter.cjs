'use strict';
function createSessionAdapter({readSession,subscribe,signOut}={}){
 if([readSession,subscribe,signOut].some(f=>typeof f!=='function'))throw TypeError('Missing session provider');
 let closed=false;
 const listeners=new Set();
 function invalidate(){if(closed)return;closed=true;for(const fn of listeners)fn();listeners.clear();}
 const unsubscribe=subscribe(event=>{if(event==='SIGNED_OUT')invalidate();});
 return Object.freeze({
 async getAccessToken(){if(closed)return null;const session=await readSession();return !closed&&typeof session?.access_token==='string'&&session.access_token?session.access_token:null;},
 onSignOut(fn){if(closed){fn();return ()=>{};}listeners.add(fn);return ()=>listeners.delete(fn);},
 async signOut(){invalidate();await signOut();},
 dispose(){invalidate();if(typeof unsubscribe==='function')unsubscribe();}
 });
}
module.exports={createSessionAdapter};
