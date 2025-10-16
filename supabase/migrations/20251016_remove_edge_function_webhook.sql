-- Remove old Edge Function webhook if it exists
-- This webhook was from the old architecture before we switched to pgmq worker

-- Drop any existing webhooks that call process-documents
-- Note: Supabase webhooks are stored in the public.hooks table (if using pg_net)
-- or in the Supabase dashboard configuration

-- If using pg_net hooks, we can query and remove them
DO $$
DECLARE
    hook_record RECORD;
BEGIN
    -- Check if net schema exists (pg_net extension)
    IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'net') THEN
        -- Loop through any hooks calling process-documents
        FOR hook_record IN 
            SELECT id FROM net._http_response 
            WHERE url LIKE '%process-documents%'
        LOOP
            -- Log for debugging
            RAISE NOTICE 'Found old process-documents webhook: %', hook_record.id;
        END LOOP;
    END IF;
END $$;

-- Note: Webhooks are typically configured via Supabase Dashboard
-- This migration documents that the webhook should be removed
-- Please manually remove any webhooks calling /functions/v1/process-documents
-- from the Supabase Dashboard → Database → Webhooks
