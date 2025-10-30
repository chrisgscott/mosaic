"use client";

import { ArrowLeft, Download, Trash2, FileText, Sheet, FileCode, Presentation, File, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { deleteDocument, toggleDocumentPublic } from "@/app/(app)/admin/documents/actions";
import { useIsAdmin } from "@/lib/hooks/use-is-admin";
import { useState } from "react";

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

type DocumentHeaderProps = {
  document: DocumentWithStats;
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "ready":
      return <Badge variant="default" className="bg-green-500">Ready</Badge>;
    case "processing":
      return <Badge variant="default" className="bg-blue-500">Processing</Badge>;
    case "uploaded":
      return <Badge variant="secondary">Uploaded</Badge>;
    case "error":
      return <Badge variant="destructive">Error</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleString();
};

const getFileIcon = (fileType: string, fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  
  // Spreadsheets
  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    return Sheet;
  }
  
  // Presentations
  if (ext === 'pptx' || ext === 'ppt') {
    return Presentation;
  }
  
  // Code/Markup
  if (ext === 'html' || ext === 'xml' || ext === 'md') {
    return FileCode;
  }
  
  // Documents
  if (ext === 'pdf' || ext === 'doc' || ext === 'docx') {
    return FileText;
  }
  
  // Default
  return File;
};

export function DocumentHeader({ document }: DocumentHeaderProps) {
  const router = useRouter();
  const supabase = createClient();
  const { isAdmin } = useIsAdmin();
  const [isTogglingPublic, setIsTogglingPublic] = useState(false);

  const handleDownload = async () => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(document.file_path, 60); // 60 second expiry

      if (error) throw error;

      // Open in new tab
      window.open(data.signedUrl, "_blank");
      toast.success("Download started");
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Failed to download document");
    }
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${document.file_name}"? This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      await deleteDocument(document.id);
      toast.success("Document deleted");
      router.push("/documents");
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete document");
    }
  };

  const handleTogglePublic = async () => {
    setIsTogglingPublic(true);
    try {
      const result = await toggleDocumentPublic(document.id, !document.is_public);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(document.is_public ? "Document is now private" : "Document is now public");
        router.refresh();
      }
    } catch (error) {
      console.error("Toggle public error:", error);
      toast.error("Failed to update document");
    } finally {
      setIsTogglingPublic(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/documents")}
        className="gap-2"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Documents
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-muted rounded-lg">
            {(() => {
              const IconComponent = getFileIcon(document.file_type, document.file_name);
              return <IconComponent className="h-8 w-8 text-muted-foreground" />;
            })()}
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">{document.file_name}</h1>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                Uploaded {formatDate(document.created_at)}
                {document.user_name && ` by ${document.user_name}`}
              </span>
              <span>•</span>
              <span>{formatFileSize(document.file_size)}</span>
              <span>•</span>
              {getStatusBadge(document.status)}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          {isAdmin && (
            <Button 
              variant={document.is_public ? "default" : "outline"} 
              size="sm" 
              onClick={handleTogglePublic}
              disabled={isTogglingPublic}
            >
              {document.is_public ? (
                <>
                  <Globe className="h-4 w-4 mr-2" />
                  Public
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 mr-2" />
                  Private
                </>
              )}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button variant="destructive" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}
