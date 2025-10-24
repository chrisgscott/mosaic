"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Chunk {
  id: string;
  content: string;
  document_id: string;
  chunk_index: number;
}

interface Document {
  id: string;
  file_name: string;
  created_at: string;
}

interface ChunksCardProps {
  chunks: Chunk[];
  documents: Document[];
}

export function ChunksCard({ chunks, documents }: ChunksCardProps) {
  if (chunks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Source Chunks
          </CardTitle>
          <CardDescription>
            No source chunks found for this entity
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Create a map of document IDs to document names
  const documentMap = new Map(documents.map(doc => [doc.id, doc.file_name]));

  // Group chunks by document
  const chunksByDocument = chunks.reduce((acc, chunk) => {
    if (!acc[chunk.document_id]) {
      acc[chunk.document_id] = [];
    }
    acc[chunk.document_id].push(chunk);
    return acc;
  }, {} as Record<string, Chunk[]>);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Source Chunks
        </CardTitle>
        <CardDescription>
          {chunks.length} chunk{chunks.length > 1 ? "s" : ""} from {documents.length} document{documents.length > 1 ? "s" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.entries(chunksByDocument).map(([documentId, docChunks]) => {
          const documentName = documentMap.get(documentId) || "Unknown Document";
          
          return (
            <div key={documentId} className="space-y-2">
              {/* Document Header */}
              <div className="flex items-center gap-2 text-sm font-medium">
                <FileText className="h-4 w-4 text-muted-foreground" />
                <Link
                  href={`/documents/${documentId}`}
                  className="hover:underline text-primary"
                >
                  {documentName}
                </Link>
                <Badge variant="outline" className="text-xs">
                  {docChunks.length} chunk{docChunks.length > 1 ? "s" : ""}
                </Badge>
              </div>

              {/* Chunks from this document */}
              <div className="space-y-2 ml-6">
                {docChunks.map((chunk) => (
                  <div
                    key={chunk.id}
                    className="border rounded-lg p-3 bg-muted/30 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Badge variant="secondary" className="text-xs">
                        Chunk {chunk.chunk_index + 1}
                      </Badge>
                      <Link
                        href={`/documents/${chunk.document_id}#chunk-${chunk.id}`}
                        className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
                      >
                        View in document
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {chunk.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
