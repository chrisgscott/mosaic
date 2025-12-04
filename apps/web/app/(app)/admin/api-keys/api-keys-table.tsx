"use client";

import { useState } from "react";
import { revokeApiKey } from "./actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useRouter } from "next/navigation";
import { Trash2, Copy } from "lucide-react";
import { toast } from "sonner";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  tenant_id: string;
  created_at: string;
  last_used_at: string | null;
  is_active: boolean;
  description: string | null;
}

interface ApiKeysTableProps {
  apiKeys: ApiKey[];
}

export function ApiKeysTable({ apiKeys }: ApiKeysTableProps) {
  const router = useRouter();
  const [isRevoking, setIsRevoking] = useState<string | null>(null);

  const handleRevoke = async (keyId: string) => {
    setIsRevoking(keyId);
    try {
      const result = await revokeApiKey(keyId);

      if (result.error) {
        throw new Error(result.error);
      }

      toast.success("API key revoked");
      router.refresh();
    } catch (error) {
      console.error("Error revoking API key:", error);
      toast.error("Failed to revoke API key");
    } finally {
      setIsRevoking(null);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Never";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (apiKeys.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center">
        <p className="text-muted-foreground">No API keys yet. Create one to get started.</p>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Key</TableHead>
            <TableHead>Tenant ID</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Last Used</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {apiKeys.map((apiKey) => (
            <TableRow key={apiKey.id}>
              <TableCell>
                <div>
                  <div className="font-medium">{apiKey.name}</div>
                  {apiKey.description && (
                    <div className="text-sm text-muted-foreground">{apiKey.description}</div>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <code className="text-sm bg-muted px-2 py-1 rounded">{apiKey.key_prefix}</code>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {apiKey.tenant_id.substring(0, 8)}...
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => copyToClipboard(apiKey.tenant_id)}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </TableCell>
              <TableCell>{formatDate(apiKey.created_at)}</TableCell>
              <TableCell>{formatDate(apiKey.last_used_at)}</TableCell>
              <TableCell>
                {apiKey.is_active ? (
                  <Badge variant="default">Active</Badge>
                ) : (
                  <Badge variant="secondary">Revoked</Badge>
                )}
              </TableCell>
              <TableCell>
                {apiKey.is_active && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        disabled={isRevoking === apiKey.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Revoke API Key</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to revoke &quot;{apiKey.name}&quot;? This action cannot be undone.
                          Any applications using this key will lose access immediately.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleRevoke(apiKey.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Revoke Key
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
