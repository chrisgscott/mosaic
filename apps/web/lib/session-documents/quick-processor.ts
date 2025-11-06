/**
 * Quick document processor for session uploads
 * Fast path: text extraction → chunking → embeddings
 * Skips: knowledge graph, entity extraction, full pipeline
 */

import { createClient } from '@/lib/supabase/server';
import { getModelForDepth } from '@/lib/ai/gateway';
import { embedMany } from 'ai';

// Simple text chunking
export function chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    const chunk = text.slice(start, end);
    
    // Only add non-empty chunks
    if (chunk.trim().length > 0) {
      chunks.push(chunk.trim());
    }
    
    start = end - overlap;
    
    // Prevent infinite loop
    if (start >= text.length) break;
  }

  return chunks;
}

// Extract text from file (basic support for common formats)
export async function extractText(file: File): Promise<string> {
  const fileType = file.type || '';
  
  // Plain text files
  if (fileType.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
    return await file.text();
  }
  
  // For now, just handle text files
  // TODO: Add PDF support with pdf-parse or similar
  throw new Error(`Unsupported file type: ${fileType}. Currently only .txt and .md files are supported.`);
}

export interface ProcessedChunk {
  content: string;
  embedding: number[];
  chunk_index: number;
}

/**
 * Quick process a file: extract text, chunk, embed
 * Returns chunks with embeddings ready to store
 */
export async function quickProcessFile(file: File): Promise<ProcessedChunk[]> {
  console.log(`[QuickProcess] Processing ${file.name} (${file.size} bytes)`);
  
  // 1. Extract text
  const text = await extractText(file);
  console.log(`[QuickProcess] Extracted ${text.length} characters`);
  
  // 2. Chunk text
  const chunks = chunkText(text);
  console.log(`[QuickProcess] Created ${chunks.length} chunks`);
  
  // 3. Generate embeddings for all chunks
  const embeddingModel = await getModelForDepth('embedding');
  const { embeddings } = await embedMany({
    model: embeddingModel,
    values: chunks,
  });
  
  console.log(`[QuickProcess] Generated ${embeddings.length} embeddings`);
  
  // 4. Combine chunks with embeddings
  return chunks.map((content, index) => ({
    content,
    embedding: embeddings[index],
    chunk_index: index,
  }));
}

/**
 * Store processed chunks in session_chunks table
 */
export async function storeSessionChunks(
  sessionId: string,
  documentId: string,
  chunks: ProcessedChunk[]
): Promise<void> {
  const supabase = await createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  
  // Insert chunks into session_chunks table
  const chunksToInsert = chunks.map(chunk => ({
    session_id: sessionId,
    document_id: documentId,
    user_id: user.id,
    content: chunk.content,
    embedding: chunk.embedding,
    chunk_index: chunk.chunk_index,
    metadata: {
      chunk_size: chunk.content.length,
    },
  }));
  
  const { error } = await supabase
    .from('session_chunks')
    .insert(chunksToInsert);
  
  if (error) {
    console.error('[QuickProcess] Failed to store chunks:', error);
    throw error;
  }
  
  console.log(`[QuickProcess] Stored ${chunks.length} chunks for session ${sessionId}`);
}
