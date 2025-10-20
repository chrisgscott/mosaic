"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

interface RelationshipSentenceProps {
  relationshipId: string;
  sourceEntity: { id: string; name: string; type: string };
  relationshipType: string;
  targetEntity: { id: string; name: string; type: string };
  description?: string | null;
  onEdit: () => void;
  onDelete: () => void;
}

// Helper function to get color for entity type
function getColorForType(type: string): string {
  const colors: Record<string, string> = {
    methodology: "#3b82f6", // blue
    framework: "#8b5cf6", // purple
    tool: "#10b981", // green
    concept: "#f59e0b", // amber
    organization: "#ef4444", // red
    person: "#ec4899", // pink
    program: "#06b6d4", // cyan
    project: "#84cc16", // lime
  };
  return colors[type.toLowerCase()] || "#6b7280"; // gray as default
}

export function RelationshipSentence({
  sourceEntity,
  relationshipType,
  targetEntity,
  description,
  onEdit,
  onDelete,
}: RelationshipSentenceProps) {
  const router = useRouter();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap group">
        {/* Source Entity Chip */}
        <Badge
          variant="outline"
          className="text-sm px-3 py-1 cursor-pointer hover:underline"
          style={{
            borderColor: getColorForType(sourceEntity.type),
            color: getColorForType(sourceEntity.type),
          }}
          onClick={() => router.push(`/graph/${sourceEntity.id}`)}
        >
          {sourceEntity.name}
        </Badge>

        {/* Relationship Type Chip */}
        <Badge variant="secondary" className="text-sm px-3 py-1">
          {relationshipType}
        </Badge>

        {/* Target Entity Chip */}
        <Badge
          variant="outline"
          className="text-sm px-3 py-1 cursor-pointer hover:underline"
          style={{
            borderColor: getColorForType(targetEntity.type),
            color: getColorForType(targetEntity.type),
          }}
          onClick={() => router.push(`/graph/${targetEntity.id}`)}
        >
          {targetEntity.name}
        </Badge>

        {/* Edit/Delete buttons */}
        <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={onEdit}
            className="h-6 w-6 p-0"
          >
            <Edit2 className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onDelete}
            className="h-6 w-6 p-0 text-destructive"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Description */}
      {description && (
        <p className="text-xs text-muted-foreground ml-2">{description}</p>
      )}
    </div>
  );
}
