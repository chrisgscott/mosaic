"use client";

import { DocumentHeader } from "./document-header";
import { ChunksTable } from "./chunks-table";
import { MetadataSection } from "./metadata-section";

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
  is_public?: boolean;
};

type DocumentDetailsViewProps = {
  document: DocumentWithStats;
  chunks: Chunk[];
};

export function DocumentDetailsView({ document, chunks }: DocumentDetailsViewProps) {
  return (
    <div className="container mx-auto py-8 space-y-6">
      <DocumentHeader document={document} />
      <MetadataSection document={document} />
      <ChunksTable chunks={chunks} documentId={document.id} />
    </div>
  );
}
