// Copy to staging-config.js in the isolated artifact; never include secret keys.
globalThis.AUREA_STAGING_CONFIG = Object.freeze({
 url: 'https://ublzmoroanhlcgpnxilw.supabase.co',
 key: 'REPLACE_WITH_STAGING_PUBLISHABLE_KEY',
 endpoint: '/api/manager-workspace'
});
