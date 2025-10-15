"use client";

import { useState, useCallback, useEffect } from "react";
import { FileText } from "lucide-react";
import { DocumentUpload } from "@/components/document-upload";
import { DocumentList } from "@/components/document-list";
import { createClient } from "@/lib/supabase/client";

type Document = {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  status: string;
  created_at: string;
};

export function DocumentsPageClient({ initialDocuments }: { initialDocuments: Document[] }) {
  const [documents, setDocuments] = useState<Document[]>(initialDocuments);

  // Poll for document updates (using polling instead of Realtime due to connection pooling issues)
  useEffect(() => {
    const supabase = createClient();
    let isActive = true;

    const pollDocuments = async () => {
      if (!isActive) return;

      try {
        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('[Polling] Error fetching documents:', error);
          return;
        }

        if (data && isActive) {
          setDocuments((current) => {
            // Merge with current documents, keeping optimistic updates
            const tempDocs = current.filter(doc => doc.id.startsWith('temp-'));
            const realDocs = data as Document[];
            
            // Remove temp docs that have matching real docs
            const filteredTempDocs = tempDocs.filter(tempDoc => 
              !realDocs.some(realDoc => realDoc.file_name === tempDoc.file_name)
            );
            
            return [...filteredTempDocs, ...realDocs];
          });
        }
      } catch (error) {
        console.error('[Polling] Exception:', error);
      }
    };

    // Poll immediately
    pollDocuments();

    // Then poll every 2 seconds
    const interval = setInterval(pollDocuments, 2000);

    return () => {
      isActive = false;
      clearInterval(interval);
    };
  }, []);

  // Shared handler for optimistic uploads
  const handleUploadStart = useCallback((file: File) => {
    const optimisticDoc: Document = {
      id: `temp-${Date.now()}-${Math.random()}`,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type,
      status: 'uploading',
      created_at: new Date().toISOString(),
    };
    
    setDocuments((current) => [optimisticDoc, ...current]);
  }, []);

  return (
    <>
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Manage Documents</h1>
          <p className="text-muted-foreground">
            Upload, organize, and manage your knowledge base documents
          </p>
        </div>
        <DocumentUpload onUploadStart={handleUploadStart} />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Total Documents</h3>
          </div>
          <p className="mt-2 text-3xl font-bold">{documents.length}</p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Processing</h3>
          </div>
          <p className="mt-2 text-3xl font-bold">
            {documents.filter((d) => d.status === "processing" || d.status === "uploading").length}
          </p>
        </div>
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-muted-foreground">Ready</h3>
          </div>
          <p className="mt-2 text-3xl font-bold">
            {documents.filter((d) => d.status === "ready" || d.status === "uploaded").length}
          </p>
        </div>
      </div>

      {/* Documents List/Table Area */}
      <DocumentList 
        documents={documents} 
        onDocumentsChange={setDocuments}
        onUploadStart={handleUploadStart}
      />
    </>
  );
}
