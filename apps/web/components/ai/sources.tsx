import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, ExternalLink } from "lucide-react";
import Link from "next/link";

interface Source {
  chunkId: string;
  documentId: string;
  documentName: string;
  chunkIndex: number;
  relevanceScore: number;
}

interface SourcesProps {
  sources: Source[];
  className?: string;
}

export function Sources({ sources, className }: SourcesProps) {
  if (sources.length === 0) return null;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Sources ({sources.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {sources.map((source, idx) => (
          <Link
            key={source.chunkId}
            href={`/admin/documents/${source.documentId}`}
            className="flex items-start gap-2 p-2 rounded-md hover:bg-muted transition-colors group"
          >
            <span className="text-xs font-mono text-muted-foreground mt-0.5">
              [{idx + 1}]
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate group-hover:text-primary">
                {source.documentName}
              </div>
              <div className="text-xs text-muted-foreground">
                Chunk {source.chunkIndex} • Relevance: {(source.relevanceScore * 100).toFixed(0)}%
              </div>
            </div>
            <ExternalLink className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
