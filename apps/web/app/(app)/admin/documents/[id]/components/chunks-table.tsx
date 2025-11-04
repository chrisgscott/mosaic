"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Eye, Sparkles, Loader2, Network } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { extractEntitiesFromChunk } from "@/app/(app)/admin/graph/actions";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import ReactMarkdown from "react-markdown";

type Chunk = {
  id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type Entity = {
  id: string;
  name: string;
  type: string;
  description: string | null;
};

type ChunksTableProps = {
  chunks: Chunk[];
  documentId: string;
};

// Helper function to get color for entity type
function getColorForType(type: string): string {
  const colors: Record<string, string> = {
    methodology: "#3b82f6",
    framework: "#8b5cf6",
    tool: "#10b981",
    concept: "#f59e0b",
    organization: "#ef4444",
    person: "#ec4899",
    program: "#06b6d4",
    project: "#84cc16",
    location: "#f97316",
  };
  return colors[type.toLowerCase()] || "#6b7280";
}

export function ChunksTable({ chunks, documentId }: ChunksTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChunk, setSelectedChunk] = useState<Chunk | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [chunkEntities, setChunkEntities] = useState<Entity[]>([]);

  // Handle URL hash to open specific chunk on page load
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#chunk-')) {
      const chunkId = hash.replace('#chunk-', '');
      const chunk = chunks.find(c => c.id === chunkId);
      if (chunk) {
        setSelectedChunk(chunk);
        fetchChunkEntities(chunk.id);
        // Scroll to the chunk in the table
        setTimeout(() => {
          const element = document.getElementById(`chunk-row-${chunkId}`);
          element?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [chunks]);

  const filteredChunks = chunks.filter((chunk) =>
    chunk.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleExtractEntities = async () => {
    if (!selectedChunk) return;

    setIsExtracting(true);

    const result = await extractEntitiesFromChunk({
      chunkContent: selectedChunk.content,
      chunkId: selectedChunk.id,
      documentId,
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      const message = result.skipped
        ? `Created ${result.count} entit${result.count! > 1 ? "ies" : "y"} (${result.skipped} skipped - already exist)`
        : `Created ${result.count} entit${result.count! > 1 ? "ies" : "y"} from this chunk`;
      toast.success(message);
      // Refresh entities for this chunk
      if (selectedChunk) {
        fetchChunkEntities(selectedChunk.id);
      }
      router.refresh();
    }

    setIsExtracting(false);
  };

  // Fetch entities associated with a chunk
  const fetchChunkEntities = async (chunkId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("entities")
      .select("id, name, type, description")
      .contains("chunk_ids", [chunkId])
      .order("name");
    
    setChunkEntities(data || []);
  };

  // Fetch entities when chunk is selected
  useEffect(() => {
    if (selectedChunk) {
      fetchChunkEntities(selectedChunk.id);
    } else {
      setChunkEntities([]);
    }
  }, [selectedChunk]);

  // Keyboard navigation for chunk modal
  useEffect(() => {
    if (!selectedChunk) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const currentIndex = filteredChunks.findIndex(c => c.id === selectedChunk.id);
      
      if (e.key === "ArrowLeft" && currentIndex > 0) {
        e.preventDefault();
        setSelectedChunk(filteredChunks[currentIndex - 1]);
      } else if (e.key === "ArrowRight" && currentIndex < filteredChunks.length - 1) {
        e.preventDefault();
        setSelectedChunk(filteredChunks[currentIndex + 1]);
      } else if (e.key === "Escape") {
        setSelectedChunk(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedChunk, filteredChunks]);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Chunks ({filteredChunks.length})</CardTitle>
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search chunks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredChunks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No chunks match your search" : "No chunks found"}
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Index</TableHead>
                    <TableHead>Content Preview</TableHead>
                    <TableHead className="w-[100px]">Tokens</TableHead>
                    <TableHead className="w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredChunks.map((chunk) => (
                    <TableRow key={chunk.id} id={`chunk-row-${chunk.id}`}>
                      <TableCell className="font-mono text-sm">
                        #{chunk.chunk_index}
                      </TableCell>
                      <TableCell>
                        <div className="max-w-xl truncate">
                          {chunk.content.substring(0, 150)}
                          {chunk.content.length > 150 && "..."}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {chunk.token_count}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedChunk(chunk)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Chunk Detail Dialog */}
      <Dialog open={!!selectedChunk} onOpenChange={() => setSelectedChunk(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Chunk #{selectedChunk?.chunk_index}</DialogTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleExtractEntities}
                  disabled={isExtracting}
                >
                  {isExtracting ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Extracting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-3 w-3" />
                      Extract Entities
                    </>
                  )}
                </Button>
                <div className="h-4 w-px bg-border" />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const currentIndex = filteredChunks.findIndex(c => c.id === selectedChunk?.id);
                    if (currentIndex > 0) {
                      setSelectedChunk(filteredChunks[currentIndex - 1]);
                    }
                  }}
                  disabled={!selectedChunk || filteredChunks.findIndex(c => c.id === selectedChunk?.id) === 0}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  {selectedChunk ? filteredChunks.findIndex(c => c.id === selectedChunk.id) + 1 : 0} / {filteredChunks.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const currentIndex = filteredChunks.findIndex(c => c.id === selectedChunk?.id);
                    if (currentIndex < filteredChunks.length - 1) {
                      setSelectedChunk(filteredChunks[currentIndex + 1]);
                    }
                  }}
                  disabled={!selectedChunk || filteredChunks.findIndex(c => c.id === selectedChunk?.id) === filteredChunks.length - 1}
                >
                  Next
                </Button>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4">
            {/* Associated Entities */}
            {chunkEntities.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                  <Network className="h-4 w-4" />
                  Associated Entities ({chunkEntities.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {chunkEntities.map((entity) => (
                    <Link
                      key={entity.id}
                      href={`/admin/graph/${entity.id}`}
                      className="transition-opacity hover:opacity-80"
                    >
                      <Badge
                        variant="outline"
                        className="cursor-pointer"
                        style={{
                          borderColor: getColorForType(entity.type),
                          color: getColorForType(entity.type),
                        }}
                      >
                        {entity.name}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Content ({selectedChunk?.token_count} tokens)
              </div>
              <div className="p-4 bg-muted rounded-lg text-sm prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown
                  components={{
                    // Style markdown elements
                    p: ({ children }) => <p className="mb-4 last:mb-0">{children}</p>,
                    ul: ({ children }) => <ul className="mb-4 ml-6 list-disc">{children}</ul>,
                    ol: ({ children }) => <ol className="mb-4 ml-6 list-decimal">{children}</ol>,
                    li: ({ children }) => <li className="mb-1">{children}</li>,
                    code: ({ inline, children, ...props }: { inline?: boolean; children?: React.ReactNode }) =>
                      inline ? (
                        <code className="px-1 py-0.5 rounded bg-background font-mono text-xs" {...props}>
                          {children}
                        </code>
                      ) : (
                        <code className="block p-4 rounded bg-background font-mono text-xs overflow-x-auto" {...props}>
                          {children}
                        </code>
                      ),
                    a: ({ children, href }) => (
                      <a href={href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                        {children}
                      </a>
                    ),
                    h1: ({ children }) => <h1 className="text-xl font-bold mb-4 mt-6">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-lg font-bold mb-3 mt-5">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-4">{children}</h3>,
                    blockquote: ({ children }) => (
                      <blockquote className="border-l-4 border-muted-foreground pl-4 italic my-4">
                        {children}
                      </blockquote>
                    ),
                  }}
                >
                  {selectedChunk?.content || ''}
                </ReactMarkdown>
              </div>
            </div>
            {selectedChunk?.metadata && Object.keys(selectedChunk.metadata).length > 0 && (
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Metadata
                </div>
                <pre className="p-4 bg-muted rounded-lg text-xs whitespace-pre-wrap break-words overflow-hidden">
                  {JSON.stringify(selectedChunk.metadata, null, 2)}
                </pre>
              </div>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Chunk ID: {selectedChunk?.id}</span>
              <span className="text-muted-foreground/60">
                Use ← → arrow keys to navigate
              </span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
