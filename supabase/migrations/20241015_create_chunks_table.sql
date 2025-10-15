-- Create chunks table for storing document text chunks
CREATE TABLE IF NOT EXISTS public.chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    token_count INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    
    -- Ensure unique chunk index per document
    CONSTRAINT unique_document_chunk UNIQUE (document_id, chunk_index)
);

-- Create indexes for efficient querying
CREATE INDEX idx_chunks_document_id ON public.chunks(document_id);
CREATE INDEX idx_chunks_user_id ON public.chunks(user_id);
CREATE INDEX idx_chunks_created_at ON public.chunks(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own chunks
CREATE POLICY "Users can view their own chunks"
    ON public.chunks
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chunks"
    ON public.chunks
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own chunks"
    ON public.chunks
    FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own chunks"
    ON public.chunks
    FOR DELETE
    USING (auth.uid() = user_id);

-- Service role can do everything (for background worker)
CREATE POLICY "Service role has full access to chunks"
    ON public.chunks
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');

-- Add comment for documentation
COMMENT ON TABLE public.chunks IS 'Text chunks extracted from documents for RAG retrieval';
COMMENT ON COLUMN public.chunks.chunk_index IS 'Sequential index of chunk within document (0-based)';
COMMENT ON COLUMN public.chunks.token_count IS 'Number of tokens in this chunk';
COMMENT ON COLUMN public.chunks.metadata IS 'Additional metadata (page numbers, sections, etc.)';
