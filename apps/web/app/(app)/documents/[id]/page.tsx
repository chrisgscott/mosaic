import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { DocumentDetailsView } from "./components/document-details-view";

type Chunk = {
  id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type DocumentWithStats = {
  id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  status: string;
  created_at: string;
  updated_at: string;
  chunk_count: number;
  total_tokens: number;
  user_name?: string;
  is_public?: boolean;
};

async function getDocumentWithChunks(documentId: string) {
  const supabase = await createClient();

  // Get document with user info
  const { data: document, error: docError } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .single();

  if (docError || !document) {
    return null;
  }

  // Get user profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", document.user_id)
    .single();
  
  const user_name = profile?.full_name || profile?.email?.split("@")[0] || "Unknown";

  // Get accurate chunk count (PostgREST has 1000 row default limit)
  const { count: chunkCount } = await supabase
    .from("chunks")
    .select("*", { count: "exact", head: true })
    .eq("document_id", documentId);

  // Get chunks (limited to 1000 for display, but show accurate count)
  const { data: chunks, error: chunksError } = await supabase
    .from("chunks")
    .select("id, chunk_index, content, token_count, metadata, created_at")
    .eq("document_id", documentId)
    .order("chunk_index", { ascending: true })
    .limit(1000); // PostgREST default max, paginate if needed

  if (chunksError) {
    console.error("Error fetching chunks:", chunksError);
  }

  // Calculate stats
  const totalTokens = chunks?.reduce((sum, chunk) => sum + (chunk.token_count || 0), 0) || 0;

  return {
    document: {
      ...document,
      chunk_count: chunkCount,
      total_tokens: totalTokens,
      user_name,
    } as DocumentWithStats,
    chunks: (chunks || []) as Chunk[],
  };
}

export default async function DocumentDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getDocumentWithChunks(id);

  if (!data) {
    notFound();
  }

  return <DocumentDetailsView document={data.document} chunks={data.chunks} />;
}
