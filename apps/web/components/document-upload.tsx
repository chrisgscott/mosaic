"use client";

import { useState, useCallback } from "react";
import { Upload, X, FileText, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createDocumentRecord } from "@/app/(app)/documents/actions";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export function DocumentUpload({ onUploadStart }: { onUploadStart?: (file: File) => void } = {}) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const router = useRouter();

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    setError(null);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles(Array.from(e.dataTransfer.files));
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    setError(null);
    if (e.target.files && e.target.files.length > 0) {
      setFiles(Array.from(e.target.files));
    }
  }, []);

  const uploadSingleFile = async (file: File, supabase: SupabaseClient, user: User) => {
    // Create unique file path
    const timestamp = Date.now();
    const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filePath = `${user.id}/${timestamp}_${sanitizedFileName}`;

    // Use resumable upload for large files (>6MB)
    const useResumable = file.size > 6 * 1024 * 1024;

    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
        ...(useResumable && { duplex: 'half' as const }),
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Upload failed for ${file.name}: ${uploadError.message}`);
    }

    // Create database record (server action handles queueing automatically)
    const result = await createDocumentRecord({
      file_name: file.name,
      file_path: uploadData.path,
      file_size: file.size,
      file_type: file.type,
    });

    if (result.error) {
      console.error('Database record creation error:', result.error);
      // Clean up uploaded file if DB insert fails
      await supabase.storage.from("documents").remove([uploadData.path]);
      throw new Error(`Database error for ${file.name}: ${result.error}`);
    }

    return { success: true, fileName: file.name };
  };

  const handleUpload = async () => {
    if (files.length === 0) return;

    // Validate all files
    const allowedTypes = [
      "application/pdf",
      "text/plain",
      "text/markdown",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
      "application/msword", // .doc
      "text/html",
      "application/xml",
      "text/xml",
      "text/csv",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
      "application/vnd.ms-excel", // .xls
      "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
      "application/vnd.ms-powerpoint", // .ppt
    ];
    const maxSize = 50 * 1024 * 1024; // 50MB

    for (const file of files) {
      if (!allowedTypes.includes(file.type)) {
        setError(`Invalid file type for ${file.name}. Supported: PDF, DOC, DOCX, TXT, MD, HTML, XML, CSV, XLSX, PPTX`);
        return;
      }
      if (file.size > maxSize) {
        setError(`${file.name} exceeds 50MB limit`);
        return;
      }
    }

    // Close modal and start uploads
    const filesToUpload = [...files];
    setFiles([]);
    setOpen(false);

    // Add optimistic documents
    filesToUpload.forEach((file) => {
      if (onUploadStart) {
        onUploadStart(file);
      }
    });

    // Show toast
    toast.info(
      filesToUpload.length === 1
        ? `Uploading ${filesToUpload[0].name}...`
        : `Uploading ${filesToUpload.length} files...`,
      {
        description: "You can continue working. We'll notify you when they're done.",
      }
    );

    setUploading(true);
    setError(null);

    try {
      const supabase = createClient();

      // Refresh session
      await supabase.auth.refreshSession();

      // Get user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        setUploading(false);
        return;
      }

      // Upload all files in parallel
      const results = await Promise.allSettled(
        filesToUpload.map((file) => uploadSingleFile(file, supabase, user))
      );

      // Count successes and failures
      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      // Log any failures
      results.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error(`Upload failed for ${filesToUpload[index].name}:`, result.reason);
        }
      });

      // Show result toast
      if (failed === 0) {
        toast.success(
          successful === 1
            ? `${filesToUpload[0].name} uploaded successfully!`
            : `All ${successful} files uploaded successfully!`,
          {
            description: "Your documents are being processed in the background.",
          }
        );
      } else if (successful === 0) {
        toast.error(`Failed to upload ${failed} file(s)`);
      } else {
        toast.warning(`${successful} uploaded, ${failed} failed`);
      }

      setUploading(false);
      router.refresh();
    } catch (error) {
      console.error('Unexpected error during upload:', error);
      toast.error("An unexpected error occurred");
      setUploading(false);
    }
  };

  const resetUpload = () => {
    setFiles([]);
    setError(null);
    setUploading(false);
  };

  const removeFile = (index: number) => {
    setFiles((current) => current.filter((_, i) => i !== index));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[525px]">
        <DialogHeader>
          <DialogTitle>Upload Document</DialogTitle>
          <DialogDescription>
            Upload a document to your knowledge base. Supported formats: PDF, DOC, DOCX, TXT, MD, HTML, XML, CSV, XLSX, PPTX
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {files.length === 0 ? (
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? "border-primary bg-primary/5"
                  : "border-muted-foreground/25 hover:border-muted-foreground/50"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="file-upload"
                multiple
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={handleChange}
                accept=".pdf,.txt,.md,.doc,.docx,.html,.xml,.csv,.xlsx,.pptx"
              />
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    Drop your files here, or{" "}
                    <span className="text-primary">browse</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    PDF, DOC, DOCX, TXT, MD, HTML, XML, CSV, XLSX, PPTX (max 50MB each)
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center gap-3 p-3 border rounded-lg">
                    <FileText className="h-6 w-6 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" title={file.name}>
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                    {!uploading && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeFile(index)}
                        className="flex-shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {error && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg">
                  {error}
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="flex-1"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="mr-2 h-4 w-4" />
                      Upload {files.length > 1 ? `${files.length} Files` : 'File'}
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={resetUpload}
                  disabled={uploading}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
