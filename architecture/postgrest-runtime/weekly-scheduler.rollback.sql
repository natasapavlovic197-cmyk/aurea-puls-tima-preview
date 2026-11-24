BEGIN;
DROP FUNCTION IF EXISTS public.aurea_delivery_schedule_due();
DROP FUNCTION IF EXISTS aurea_delivery_rpc.schedule_due();
COMMIT;
