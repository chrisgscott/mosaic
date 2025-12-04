/**
 * Document Upload API - For external apps to upload documents
 * 
 * Accepts multipart form data with a file and optional metadata.
 * Documents are scoped to the tenant_id from the API key.
 */

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";

export const maxDuration = 60; // Allow up to 60 seconds for large file uploads

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const auth = await authenticateRequest(request);
    if (!auth.authenticated) {
      return NextResponse.json({ error: auth.error || "Unauthorized" }, { status: 401 });
    }

    // Require API key auth for this endpoint (not cookie auth)
    if (!auth.tenantId) {
      return NextResponse.json(
        { error: "This endpoint requires API key authentication with a tenant scope" },
        { status: 403 }
      );
    }

    const tenantId = auth.tenantId;

    // 2. Parse multipart form data
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const allowedTypes = [
      "application/pdf",
      "text/plain",
      "text/markdown",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/msword",
    ];
    
    if (!allowedTypes.includes(file.type) && !file.name.endsWith(".md")) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: PDF, TXT, MD, DOCX` },
        { status: 400 }
      );
    }

    // 3. Upload to Supabase Storage
    const supabase = auth.supabase!;
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${tenantId}/${timestamp}_${sanitizedName}`;

    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error("[Upload] Storage error:", uploadError);
      return NextResponse.json(
        { error: `Failed to upload file: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // 4. Create document record
    const { data: document, error: dbError } = await supabase
      .from("documents")
      .insert({
        user_id: auth.user?.id || "00000000-0000-0000-0000-000000000000",
        tenant_id: tenantId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_type: file.type || "application/octet-stream",
        status: "uploaded",
      })
      .select()
      .single();

    if (dbError) {
      console.error("[Upload] Database error:", dbError);
      // Try to clean up the uploaded file
      await supabase.storage.from("documents").remove([filePath]);
      return NextResponse.json(
        { error: `Failed to create document record: ${dbError.message}` },
        { status: 500 }
      );
    }

    // 5. Enqueue for processing
    try {
      await supabase.rpc("pgmq_send", {
        queue_name: "document_processing",
        msg: {
          document_id: document.id,
          file_path: filePath,
        },
      });
      console.log(`[Upload] Document ${document.id} enqueued for processing`);
    } catch (queueError) {
      console.error("[Upload] Queue error (non-fatal):", queueError);
      // Don't fail the upload if queue fails - document is still saved
    }

    // 6. Return success
    return NextResponse.json({
      success: true,
      document: {
        id: document.id,
        file_name: document.file_name,
        file_size: document.file_size,
        status: document.status,
        created_at: document.created_at,
      },
      message: "Document uploaded and queued for processing",
    });

  } catch (error) {
    console.error("[Upload] Unexpected error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Health check
export async function GET() {
  return NextResponse.json({
    endpoint: "Document Upload API",
    method: "POST",
    contentType: "multipart/form-data",
    requiredFields: ["file"],
    authentication: "API Key (X-API-Key header)",
    status: "ready",
  });
}
