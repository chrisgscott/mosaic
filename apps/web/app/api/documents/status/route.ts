import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Check the processing status of multiple documents
 */
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

    const { documentIds } = await request.json();

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json(
        { error: 'Document IDs required' },
        { status: 400 }
      );
    }

    // Fetch document statuses
    const { data: documents, error: dbError } = await supabase
      .from('documents')
      .select('id, file_name, status, processing_progress, error_message')
      .in('id', documentIds)
      .eq('user_id', user.id);

    if (dbError) {
      console.error('[DocumentStatus] Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to fetch document status' },
        { status: 500 }
      );
    }

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('[DocumentStatus] API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
