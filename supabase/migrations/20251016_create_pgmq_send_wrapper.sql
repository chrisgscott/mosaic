-- Create a wrapper function in the public schema for pgmq.send
-- This allows PostgREST to call it since it only exposes public schema

CREATE OR REPLACE FUNCTION public.queue_document(
    queue_name text,
    msg jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN pgmq.send(queue_name, msg);
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.queue_document(text, jsonb) TO authenticated;

COMMENT ON FUNCTION public.queue_document IS 'Wrapper function to send messages to pgmq queues from PostgREST';
