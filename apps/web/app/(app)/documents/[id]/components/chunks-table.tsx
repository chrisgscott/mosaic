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
import { Search, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Chunk = {
  id: string;
  chunk_index: number;
  content: string;
  token_count: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ChunksTableProps = {
  chunks: Chunk[];
  documentId: string;
};

export function ChunksTable({ chunks }: ChunksTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChunk, setSelectedChunk] = useState<Chunk | null>(null);

  const filteredChunks = chunks.filter((chunk) =>
    chunk.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
                    <TableRow key={chunk.id}>
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
            <div>
              <div className="text-sm font-medium text-muted-foreground mb-2">
                Content ({selectedChunk?.token_count} tokens)
              </div>
              <div className="p-4 bg-muted rounded-lg whitespace-pre-wrap text-sm">
                {selectedChunk?.content}
              </div>
            </div>
            {selectedChunk?.metadata && Object.keys(selectedChunk.metadata).length > 0 && (
              <div>
                <div className="text-sm font-medium text-muted-foreground mb-2">
                  Metadata
                </div>
                <pre className="p-4 bg-muted rounded-lg text-xs overflow-x-auto">
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
