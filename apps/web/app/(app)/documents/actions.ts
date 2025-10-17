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
        .rpc('pgmq_send', {
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

  // Clean up any pending queue messages for this document
  // This prevents queue corruption when deleting documents in error state
  try {
    await supabase.rpc('pgmq_archive_by_document', {
      p_document_id: documentId
    });
    console.log(`Archived queue messages for document ${documentId}`);
  } catch (queueError) {
    // Log but don't fail - queue cleanup is best-effort
    console.warn("Queue cleanup failed (non-fatal):", queueError);
  }

  // Smart cascade delete for graph data
  // Remove this document from entities and relationships, deleting orphaned ones
  try {
    // Get chunk IDs for this document (they'll be deleted, so we need to clean them up)
    const { data: chunks } = await supabase
      .from("chunks")
      .select("id")
      .eq("document_id", documentId);
    
    const chunkIds = chunks?.map(c => c.id) || [];

    // Get all entities that reference this document or its chunks
    const { data: entities, error: entitiesError } = await supabase
      .from("entities")
      .select("id, document_ids, chunk_ids")
      .or(`document_ids.cs.{${documentId}},chunk_ids.ov.{${chunkIds.join(",")}}`);

    if (!entitiesError && entities) {
      for (const entity of entities) {
        // Remove this document_id and chunk_ids from the arrays
        const updatedDocIds = entity.document_ids.filter((id: string) => id !== documentId);
        const updatedChunkIds = entity.chunk_ids.filter((id: string) => !chunkIds.includes(id));
        
        if (updatedDocIds.length === 0 && updatedChunkIds.length === 0) {
          // No more documents or chunks reference this entity - delete it
          await supabase.from("entities").delete().eq("id", entity.id);
          console.log(`Deleted orphaned entity ${entity.id}`);
        } else {
          // Still has other references - update the arrays
          await supabase
            .from("entities")
            .update({ 
              document_ids: updatedDocIds,
              chunk_ids: updatedChunkIds 
            })
            .eq("id", entity.id);
          console.log(`Updated entity ${entity.id}, removed document/chunk references`);
        }
      }
    }

    // Now handle relationships (reuse chunkIds from above)
    // Get all relationships that reference this document or its chunks
    const { data: relationships, error: relsError } = await supabase
      .from("relationships")
      .select("id, document_ids, chunk_ids")
      .or(`document_ids.cs.{${documentId}},chunk_ids.ov.{${chunkIds.join(",")}}`);

    if (!relsError && relationships) {
      for (const rel of relationships) {
        // Remove this document_id and chunk_ids from the arrays
        const updatedDocIds = rel.document_ids.filter((id: string) => id !== documentId);
        const updatedChunkIds = rel.chunk_ids.filter((id: string) => !chunkIds.includes(id));
        
        if (updatedDocIds.length === 0 && updatedChunkIds.length === 0) {
          // No more documents or chunks reference this relationship - delete it
          await supabase.from("relationships").delete().eq("id", rel.id);
          console.log(`Deleted orphaned relationship ${rel.id}`);
        } else {
          // Still has other references - update the arrays
          await supabase
            .from("relationships")
            .update({ 
              document_ids: updatedDocIds,
              chunk_ids: updatedChunkIds 
            })
            .eq("id", rel.id);
          console.log(`Updated relationship ${rel.id}, removed document/chunk references`);
        }
      }
    }

    console.log(`Graph cleanup complete for document ${documentId}`);
  } catch (graphError) {
    // Log but don't fail - graph cleanup is best-effort
    console.warn("Graph cleanup failed (non-fatal):", graphError);
  }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from("documents")
    .remove([document.file_path]);

  if (storageError) {
    console.error("Storage deletion error:", storageError);
    return { error: `Failed to delete file: ${storageError.message}` };
  }

  // Delete from database (chunks and embeddings cascade automatically via foreign keys)
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
