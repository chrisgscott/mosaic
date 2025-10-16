/**
 * API Endpoint: Graph Extraction
 * 
 * POST /api/graph/extract
 * 
 * Extracts entities and relationships from a document's chunks
 * and stores them in the knowledge graph.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { processDocumentForGraph } from '@/lib/graph/entity-extraction';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { documentId } = body;

    if (!documentId) {
      return NextResponse.json(
        { error: 'Missing documentId' },
        { status: 400 }
      );
    }

    // Verify document belongs to user
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id, file_name, status')
      .eq('id', documentId)
      .eq('user_id', user.id)
      .single();

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      );
    }

    if (document.status !== 'ready') {
      return NextResponse.json(
        { error: 'Document must be in ready status' },
        { status: 400 }
      );
    }

    console.log(`[Graph Extract] Starting extraction for document: ${document.file_name}`);

    // Process document for graph extraction
    const startTime = Date.now();
    const result = await processDocumentForGraph(documentId, user.id, {
      batchSize: 5,
      onProgress: (processed, total) => {
        console.log(`[Graph Extract] Progress: ${processed}/${total} chunks processed`);
      },
    });

    const processingTime = Date.now() - startTime;

    console.log(`[Graph Extract] Completed in ${processingTime}ms`);
    console.log(`[Graph Extract] Extracted ${result.totalEntities} entities and ${result.totalRelationships} relationships`);

    return NextResponse.json({
      success: true,
      documentId,
      documentName: document.file_name,
      entities: result.totalEntities,
      relationships: result.totalRelationships,
      processingTimeMs: processingTime,
    });

  } catch (error) {
    console.error('[Graph Extract] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
