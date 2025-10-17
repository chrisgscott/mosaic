"use client";

import { FileText, Trash2, Download, MoreHorizontal, Loader2, Trash, Sheet, FileCode, Presentation, File, Globe, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { deleteDocument, toggleDocumentPublic } from "@/app/(app)/documents/actions";
import { useIsAdmin } from "@/lib/hooks/use-is-admin";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { DocumentUpload } from "./document-upload";

type Document = {
  id: string;
  file_name: string;
  file_size: number;
  file_type: string;
  status: string;
  created_at: string;
  is_public?: boolean;
  error_message?: string;
  retry_count?: number;
  last_error_at?: string;
  processing_progress?: number;
  processing_stage_started_at?: string;
};

const getFileIcon = (fileName: string) => {
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

export function DocumentList({ 
  documents: externalDocuments,
  onDocumentsChange,
  onUploadStart,
}: { 
  documents: Document[];
  onDocumentsChange?: (updater: (prev: Document[]) => Document[]) => void;
  onUploadStart?: (file: File) => void;
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [internalDocuments, setInternalDocuments] = useState<Document[]>(externalDocuments);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingPublicId, setTogglingPublicId] = useState<string | null>(null);
  const { isAdmin } = useIsAdmin();

  // Use external or internal documents
  const documents = onDocumentsChange ? externalDocuments : internalDocuments;
  
  // Filter out temp documents for selection
  const selectableDocuments = documents.filter(doc => !doc.id.startsWith('temp-'));
  const setDocuments = onDocumentsChange || setInternalDocuments;

  // Handle optimistic upload - add document to list immediately
  const handleUploadStart = onUploadStart;

  // Subscribe to real-time document updates
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel('documents-changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'documents',
        },
        (payload) => {
          console.log('Document updated:', payload);
          const newDoc = payload.new as Document;
          
          // Update the document in our local state and check for status change
          setDocuments((current) => {
            const oldDoc = current.find(d => d.id === newDoc.id);
            
            // Show toast when document becomes ready
            if (oldDoc?.status === 'processing' && newDoc.status === 'ready') {
              toast.success(`${newDoc.file_name} is ready!`, {
                description: "Your document has been processed and is ready to use.",
              });
            }
            
            return current.map((doc) =>
              doc.id === newDoc.id ? newDoc : doc
            );
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'documents',
        },
        (payload) => {
          console.log('Document inserted:', payload);
          const newDoc = payload.new as Document;
          
          // Replace optimistic document with real one, or add if not found
          setDocuments((current) => {
            // Remove any temporary/optimistic document with same name
            const filtered = current.filter(
              (doc) => !doc.id.startsWith('temp-') || doc.file_name !== newDoc.file_name
            );
            // Add the real document
            return [newDoc, ...filtered];
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'documents',
        },
        (payload) => {
          console.log('Document deleted:', payload);
          // Remove document from the list
          setDocuments((current) =>
            current.filter((doc) => doc.id !== payload.old.id)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Update local state when external documents change
  useEffect(() => {
    if (!onDocumentsChange) {
      setInternalDocuments(externalDocuments);
    }
  }, [externalDocuments, onDocumentsChange]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);

    const result = await deleteDocument(id);

    if (result.error) {
      toast.error("Failed to delete document");
      setDeletingId(null);
      return;
    }

    toast.success("Document deleted");
    setDeletingId(null);
    
    // Update local state
    setDocuments((current) => current.filter((doc) => doc.id !== id));

    // Refresh server data
    router.refresh();
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedIds.size} document${selectedIds.size > 1 ? 's' : ''}?`
    );

    if (!confirmed) return;

    setIsDeleting(true);

    const deletePromises = Array.from(selectedIds).map(id => deleteDocument(id));
    const results = await Promise.allSettled(deletePromises);

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    if (failed === 0) {
      toast.success(`Deleted ${successful} document${successful > 1 ? 's' : ''}`);
    } else {
      toast.error(`Failed to delete ${failed} document${failed > 1 ? 's' : ''}`);
    }

    // Update local state
    setDocuments((current) => current.filter((doc) => !selectedIds.has(doc.id)));
    setSelectedIds(new Set());
    setIsDeleting(false);
    router.refresh();
  };

  const handleBulkMakePublic = async () => {
    if (selectedIds.size === 0) return;

    setIsDeleting(true);

    const togglePromises = Array.from(selectedIds).map(id => toggleDocumentPublic(id, true));
    const results = await Promise.allSettled(togglePromises);

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    if (failed === 0) {
      toast.success(`Made ${successful} document${successful > 1 ? 's' : ''} public`);
    } else {
      toast.error(`Failed to update ${failed} document${failed > 1 ? 's' : ''}`);
    }

    setSelectedIds(new Set());
    setIsDeleting(false);
    router.refresh();
  };

  const handleBulkMakePrivate = async () => {
    if (selectedIds.size === 0) return;

    setIsDeleting(true);

    const togglePromises = Array.from(selectedIds).map(id => toggleDocumentPublic(id, false));
    const results = await Promise.allSettled(togglePromises);

    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    if (failed === 0) {
      toast.success(`Made ${successful} document${successful > 1 ? 's' : ''} private`);
    } else {
      toast.error(`Failed to update ${failed} document${failed > 1 ? 's' : ''}`);
    }

    setSelectedIds(new Set());
    setIsDeleting(false);
    router.refresh();
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === selectableDocuments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableDocuments.map(doc => doc.id)));
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string, doc?: Document) => {
    const progress = doc?.processing_progress;
    const showProgress = progress !== undefined && progress > 0 && progress < 100;
    
    switch (status) {
      case "uploading":
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Uploading
          </Badge>
        );
      case "uploaded":
        return (
          <Badge variant="secondary" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Queued
          </Badge>
        );
      case "processing":
        return (
          <Badge variant="default" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Processing{showProgress ? ` ${progress}%` : ''}
          </Badge>
        );
      case "extracting":
        return (
          <Badge variant="default" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Extracting{showProgress ? ` ${progress}%` : ''}
          </Badge>
        );
      case "chunking":
        return (
          <Badge variant="default" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Chunking{showProgress ? ` ${progress}%` : ''}
          </Badge>
        );
      case "generating_summaries":
        return (
          <Badge variant="default" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Generating{showProgress ? ` ${progress}%` : ''}
          </Badge>
        );
      case "embedding":
        return (
          <Badge variant="default" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Embedding{showProgress ? ` ${progress}%` : ''}
          </Badge>
        );
      case "extracting_graph":
        return (
          <Badge variant="default" className="gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Extracting Graph{showProgress ? ` ${progress}%` : ''}
          </Badge>
        );
      case "ready":
        return <Badge variant="outline" className="border-green-500 text-green-700">Ready</Badge>;
      case "error":
        const retryInfo = doc?.retry_count ? ` (${doc.retry_count}/3)` : '';
        return (
          <Badge variant="destructive" title={doc?.error_message || 'Processing failed'}>
            Error{retryInfo}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  if (documents.length === 0) {
    return (
      <div className="rounded-lg border bg-card">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Your Documents</h2>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No documents yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Get started by uploading your first document. We support PDF, TXT, MD, and more.
            </p>
            <DocumentUpload onUploadStart={handleUploadStart} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Your Documents</h2>
          {selectedIds.size > 0 && (
            <div className="flex gap-2">
              {isAdmin && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkMakePublic}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Globe className="mr-2 h-4 w-4" />
                        Make Public
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkMakePrivate}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating...
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        Make Private
                      </>
                    )}
                  </Button>
                </>
              )}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash className="mr-2 h-4 w-4" />
                    Delete {selectedIds.size}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={selectableDocuments.length > 0 && selectedIds.size === selectableDocuments.length}
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Size</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  {!doc.id.startsWith('temp-') && (
                    <Checkbox
                      checked={selectedIds.has(doc.id)}
                      onCheckedChange={() => toggleSelection(doc.id)}
                      aria-label={`Select ${doc.file_name}`}
                    />
                  )}
                </TableCell>
                <TableCell>
                  <button
                    onClick={() => router.push(`/documents/${doc.id}`)}
                    className="flex items-center gap-2 hover:underline text-left w-full"
                  >
                    {(() => {
                      const IconComponent = getFileIcon(doc.file_name);
                      return <IconComponent className="h-4 w-4 text-muted-foreground flex-shrink-0" />;
                    })()}
                    <span className="font-medium truncate">{doc.file_name}</span>
                    {doc.is_public && (
                      <span title="Public document">
                        <Globe className="h-3 w-3 text-muted-foreground ml-1 flex-shrink-0" />
                      </span>
                    )}
                  </button>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatFileSize(doc.file_size)}
                </TableCell>
                <TableCell>{getStatusBadge(doc.status, doc)}</TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(doc.created_at)}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={deletingId === doc.id}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </DropdownMenuItem>
                      {isAdmin && (
                        <DropdownMenuItem
                          onClick={async () => {
                            setTogglingPublicId(doc.id);
                            const result = await toggleDocumentPublic(doc.id, !doc.is_public);
                            if (result.error) {
                              toast.error(result.error);
                            } else {
                              toast.success(doc.is_public ? "Document is now private" : "Document is now public");
                              router.refresh();
                            }
                            setTogglingPublicId(null);
                          }}
                          disabled={togglingPublicId === doc.id}
                        >
                          {doc.is_public ? (
                            <>
                              <Lock className="mr-2 h-4 w-4" />
                              Make Private
                            </>
                          ) : (
                            <>
                              <Globe className="mr-2 h-4 w-4" />
                              Make Public
                            </>
                          )}
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(doc.id)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
