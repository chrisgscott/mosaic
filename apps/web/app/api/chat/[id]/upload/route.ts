import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Upload files for a specific chat session
 * Files are stored in Supabase storage with session metadata
 * and automatically queued for processing
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;
    const supabase = await createClient();

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify session exists and belongs to user
    const { data: session, error: sessionError } = await supabase
      .from('chat_sessions')
      .select('id, user_id')
      .eq('id', sessionId)
      .eq('user_id', user.id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Parse multipart form data
    const formData = await request.formData();
    const files = formData.getAll('files') as File[];

    if (files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    console.log(`[Upload] Processing ${files.length} files for session ${sessionId}`);

    const uploadResults = [];
    const errors = [];

    // Process each file
    for (const file of files) {
      try {
        // Create unique file path with session metadata
        const timestamp = Date.now();
        const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const filePath = `${user.id}/sessions/${sessionId}/${timestamp}_${sanitizedFileName}`;

        console.log(`[Upload] Uploading ${file.name} to ${filePath}`);

        // Upload to Supabase storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false,
          });

        if (uploadError) {
          console.error(`[Upload] Storage error for ${file.name}:`, uploadError);
          errors.push({ fileName: file.name, error: uploadError.message });
          continue;
        }

        // Create document record with session metadata
        const { data: document, error: dbError } = await supabase
          .from('documents')
          .insert({
            user_id: user.id,
            file_name: file.name,
            file_path: uploadData.path,
            file_size: file.size,
            file_type: file.type || 'application/octet-stream',
            status: 'pending',
            session_id: sessionId, // Link to session
          })
          .select()
          .single();

        if (dbError) {
          console.error(`[Upload] Database error for ${file.name}:`, dbError);
          // Clean up uploaded file
          await supabase.storage.from('documents').remove([uploadData.path]);
          errors.push({ fileName: file.name, error: dbError.message });
          continue;
        }

        console.log(`[Upload] Successfully uploaded ${file.name} with ID ${document.id}`);

        // Queue for quick processing (skips graph extraction and question generation)
        try {
          await supabase.rpc('queue_document', {
            queue_name: 'document_processing',
            msg: {
              document_id: document.id,
              user_id: user.id,
              file_path: uploadData.path,
              file_name: file.name,
              file_type: file.type || 'application/octet-stream',
              quick_mode: true, // Enable quick mode for session uploads
            },
          });
          console.log(`[Upload] Queued ${file.name} for quick processing`);
        } catch (queueError) {
          console.error(`[Upload] Failed to queue ${file.name}:`, queueError);
          // Don't fail the upload, document will be picked up by retry logic
        }

        uploadResults.push({
          id: document.id,
          fileName: file.name,
          fileSize: file.size,
          status: 'pending',
        });
      } catch (error) {
        console.error(`[Upload] Unexpected error for ${file.name}:`, error);
        errors.push({
          fileName: file.name,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Return results
    return NextResponse.json({
      success: uploadResults.length > 0,
      uploaded: uploadResults,
      errors: errors.length > 0 ? errors : undefined,
      message: `Uploaded ${uploadResults.length} of ${files.length} files`,
    });
  } catch (error) {
    console.error('[Upload] API error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
