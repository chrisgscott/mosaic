"use client";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Edit2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

// Convert snake_case to plain language
function formatRelationshipType(type: string): string {
  return type.replace(/_/g, " ");
}

interface RelationshipSentenceProps {
  relationshipId: string;
  sourceEntity: { id: string; name: string; type: string };
  relationshipType: string;
  targetEntity: { id: string; name: string; type: string };
  description?: string | null;
  isLast?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function RelationshipSentence({
  sourceEntity,
  relationshipType,
  targetEntity,
  description,
  isLast = false,
  onEdit,
  onDelete,
}: RelationshipSentenceProps) {
  const router = useRouter();

  return (
    <>
      <div className="py-3 group">
        <div className="flex items-center gap-2 text-sm">
          {/* Source Entity */}
          <span
            className="font-medium hover:underline cursor-pointer"
            onClick={() => router.push(`/admin/graph/${sourceEntity.id}`)}
          >
            {sourceEntity.name}
          </span>

          {/* Relationship Type */}
          <span className="text-muted-foreground">{formatRelationshipType(relationshipType)}</span>

          {/* Target Entity */}
          <span
            className="font-medium hover:underline cursor-pointer"
            onClick={() => router.push(`/admin/graph/${targetEntity.id}`)}
          >
            {targetEntity.name}
          </span>

          {/* Edit/Delete buttons */}
          <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={onEdit}
              className="h-7 w-7 p-0"
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Description */}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </div>

      {/* Separator between relationships */}
      {!isLast && <Separator />}
    </>
  );
}
