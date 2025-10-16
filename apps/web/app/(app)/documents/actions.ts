"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createDocumentRecord(data: {
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
}) {
  const supabase = await createClient();

  // Get the authenticated user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  try {
    // Create a document record in the database
    const { data: documentData, error: dbError } = await supabase
      .from("documents")
      .insert({
        user_id: user.id,
        file_name: data.file_name,
        file_path: data.file_path,
        file_size: data.file_size,
        file_type: data.file_type,
        status: "uploaded",
      })
      .select()
      .single();

    if (dbError) {
      console.error("Database error:", dbError);
      return { error: `Database error: ${dbError.message}` };
    }

    // Revalidate the documents page
    revalidatePath("/documents");

    // Enqueue document for processing
    try {
      console.log('Enqueueing document for processing:', {
        document_id: documentData.id,
        file_path: data.file_path,
      });
      
      const { data: queueData, error: queueError } = await supabase
        .rpc('queue_document', {
          queue_name: 'document_processing',
          msg: {
            document_id: documentData.id,
            file_path: data.file_path,
          },
        });
      
      if (queueError) {
        console.error("Queue RPC error:", queueError);
      } else {
        console.log('Document enqueued successfully:', queueData);
      }
    } catch (queueError) {
      console.error("Failed to enqueue document for processing:", queueError);
      // Don't fail the whole operation if queue fails
    }

    return {
      success: true,
      document: documentData,
    };
  } catch (error) {
    console.error("Unexpected error:", error);
    return { error: "An unexpected error occurred" };
  }
}

export async function getDocuments() {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching documents:", error);
    return { error: error.message };
  }

  return { documents: data };
}

export async function deleteDocument(documentId: string) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  // Get the document to find the file path
  const { data: document, error: fetchError } = await supabase
    .from("documents")
    .select("file_path, user_id")
    .eq("id", documentId)
    .single();

  if (fetchError || !document) {
    return { error: "Document not found" };
  }

  // Verify ownership
  if (document.user_id !== user.id) {
    return { error: "Unauthorized" };
  }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from("documents")
    .remove([document.file_path]);

  if (storageError) {
    console.error("Storage deletion error:", storageError);
    return { error: `Failed to delete file: ${storageError.message}` };
  }

  // Delete from database
  const { error: dbError } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);

  if (dbError) {
    console.error("Database deletion error:", dbError);
    return { error: `Failed to delete record: ${dbError.message}` };
  }

  revalidatePath("/documents");

  return { success: true };
}

export async function toggleDocumentPublic(documentId: string, isPublic: boolean) {
  const supabase = await createClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Unauthorized" };
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return { error: "Only admins can make documents public" };
  }

  // Get the document to verify ownership
  const { data: document, error: fetchError } = await supabase
    .from("documents")
    .select("user_id")
    .eq("id", documentId)
    .single();

  if (fetchError || !document) {
    return { error: "Document not found" };
  }

  // Verify ownership
  if (document.user_id !== user.id) {
    return { error: "Unauthorized" };
  }

  // Update the document
  const { error: updateError } = await supabase
    .from("documents")
    .update({ is_public: isPublic })
    .eq("id", documentId);

  if (updateError) {
    console.error("Update error:", updateError);
    return { error: `Failed to update document: ${updateError.message}` };
  }

  revalidatePath("/documents");
  revalidatePath(`/documents/${documentId}`);

  return { success: true };
}
