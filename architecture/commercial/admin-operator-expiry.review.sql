ALTER TABLE aurea_admin.auth_operators ADD COLUMN expires_at timestamptz;
CREATE OR REPLACE FUNCTION aurea_admin.require_operator() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF auth.uid() IS NULL OR NOT EXISTS (
 SELECT 1 FROM aurea_admin.auth_operators o JOIN auth.users u ON u.id=o.user_id JOIN auth.sessions s ON s.user_id=u.id
 WHERE o.user_id=auth.uid() AND o.enabled AND (o.expires_at IS NULL OR o.expires_at>clock_timestamp()) AND s.id::text=auth.jwt()->>'session_id'
 AND u.deleted_at IS NULL AND NOT u.is_anonymous AND (u.banned_until IS NULL OR u.banned_until<=clock_timestamp())
 AND (s.not_after IS NULL OR s.not_after>clock_timestamp())
 ) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;
END $$;