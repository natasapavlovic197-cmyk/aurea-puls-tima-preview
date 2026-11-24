BEGIN;
DROP FUNCTION IF EXISTS public.aurea_delivery_schedule_due();
DROP FUNCTION IF EXISTS aurea_delivery_rpc.schedule_due();
DROP FUNCTION IF EXISTS aurea_delivery_rpc.schedule_at(timestamptz);
DROP FUNCTION IF EXISTS public.aurea_delivery_prepare_current();
DROP FUNCTION IF EXISTS aurea_delivery_rpc.prepare_current();
DROP FUNCTION IF EXISTS aurea_delivery_rpc.prepare_monday(timestamptz);
DROP TABLE IF EXISTS aurea_delivery_rpc.active_recipients;
COMMIT;
