"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
};

type MetadataSectionProps = {
  document: DocumentWithStats;
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString();
};

export function MetadataSection({ document }: MetadataSectionProps) {
  const processingDuration = document.updated_at && document.created_at
    ? Math.round((new Date(document.updated_at).getTime() - new Date(document.created_at).getTime()) / 1000)
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document Metadata</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-medium text-muted-foreground mb-1">Document ID</div>
            <div className="font-mono text-xs">{document.id}</div>
          </div>
          <div>
            <div className="font-medium text-muted-foreground mb-1">Storage Path</div>
            <div className="font-mono text-xs truncate">{document.file_path}</div>
          </div>
          <div>
            <div className="font-medium text-muted-foreground mb-1">MIME Type</div>
            <div>{document.file_type}</div>
          </div>
          <div>
            <div className="font-medium text-muted-foreground mb-1">Status</div>
            <div className="capitalize">{document.status}</div>
          </div>
          <div>
            <div className="font-medium text-muted-foreground mb-1">Created At</div>
            <div>{formatDate(document.created_at)}</div>
          </div>
          <div>
            <div className="font-medium text-muted-foreground mb-1">Last Updated</div>
            <div>{formatDate(document.updated_at)}</div>
          </div>
          {processingDuration !== null && (
            <div>
              <div className="font-medium text-muted-foreground mb-1">Processing Duration</div>
              <div>{processingDuration}s</div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
