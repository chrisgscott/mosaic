"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2, X, Save } from "lucide-react";

interface EntityHeaderProps {
  name: string;
  type: string;
  aliases?: string[];
  isEditing: boolean;
  isDeleting: boolean;
  isSaving: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onSave: () => void;
  onCancel: () => void;
}

export function EntityHeader({
  name,
  type,
  aliases,
  isEditing,
  isDeleting,
  isSaving,
  onEdit,
  onDelete,
  onSave,
  onCancel,
}: EntityHeaderProps) {
  return (
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold">{name}</h1>
          <Badge variant="outline">{type}</Badge>
        </div>
        {aliases && aliases.length > 0 && (
          <p className="text-sm text-muted-foreground">
            Also known as: {aliases.join(", ")}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        {!isEditing ? (
          <>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit2 className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={onDelete}
              disabled={isDeleting}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </>
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
            <Button size="sm" onClick={onSave} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? "Saving..." : "Save"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
