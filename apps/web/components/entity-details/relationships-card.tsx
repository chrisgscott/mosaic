"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RelationshipSentence } from "./relationship-sentence";
import { RelationshipEditForm } from "./relationship-edit-form";
import type { Entity } from "@/app/(app)/graph/actions";
import { toast } from "sonner";
import { updateRelationship, deleteRelationship } from "@/app/(app)/graph/actions";

interface Relationship {
  id: string;
  relationship_type: string;
  description: string | null;
  source?: { id: string; name: string; type: string };
  target?: { id: string; name: string; type: string };
}

interface RelationshipsCardProps {
  currentEntityId: string;
  outgoingRelationships: Relationship[];
  incomingRelationships: Relationship[];
  allEntities: Entity[];
  onRelationshipUpdated: () => void;
}

const relationshipTypes = [
  "is part of",
  "uses",
  "implements",
  "extends",
  "depends on",
  "related to",
  "created by",
  "manages",
  "contributes to",
];

export function RelationshipsCard({
  currentEntityId,
  outgoingRelationships,
  incomingRelationships,
  allEntities,
  onRelationshipUpdated,
}: RelationshipsCardProps) {
  const [editingRelationshipId, setEditingRelationshipId] = useState<string | null>(null);

  // Combine all relationships
  const allRelationships = [...outgoingRelationships, ...incomingRelationships];

  const handleEdit = (relationshipId: string) => {
    setEditingRelationshipId(relationshipId);
  };

  const handleCancelEdit = () => {
    setEditingRelationshipId(null);
  };

  const handleSave = async (
    relationshipId: string,
    sourceId: string,
    targetId: string,
    type: string
  ) => {
    try {
      await updateRelationship(relationshipId, sourceId, targetId, type);
      toast.success("Relationship updated successfully");
      setEditingRelationshipId(null);
      onRelationshipUpdated();
    } catch (error) {
      toast.error("Failed to update relationship");
      console.error(error);
    }
  };

  const handleDelete = async (
    relationshipId: string,
    relationshipType: string,
    targetName: string
  ) => {
    if (!confirm(`Delete relationship "${relationshipType}" to "${targetName}"?`)) {
      return;
    }

    try {
      await deleteRelationship(relationshipId);
      toast.success("Relationship deleted successfully");
      onRelationshipUpdated();
    } catch (error) {
      toast.error("Failed to delete relationship");
      console.error(error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Relationships</CardTitle>
        <CardDescription>
          {allRelationships.length} total
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {allRelationships.length === 0 ? (
            <p className="text-sm text-muted-foreground">No relationships found</p>
          ) : (
            allRelationships.map((rel) => {
              // Determine source and target entities
              const isOutgoing = rel.source?.id === currentEntityId || !rel.source;
              const sourceEntity = isOutgoing
                ? allEntities.find((e) => e.id === currentEntityId)!
                : rel.source!;
              const targetEntity = isOutgoing
                ? rel.target!
                : allEntities.find((e) => e.id === currentEntityId)!;

              // Get the relationship for editing
              const editRel = allRelationships.find((r) => r.id === rel.id);
              const editSourceId = editRel?.source?.id || currentEntityId;
              const editTargetId = editRel?.target?.id || currentEntityId;

              return editingRelationshipId === rel.id ? (
                <RelationshipEditForm
                  key={rel.id}
                  sourceEntityId={editSourceId}
                  targetEntityId={editTargetId}
                  relationshipType={rel.relationship_type}
                  allEntities={allEntities}
                  relationshipTypes={relationshipTypes}
                  onSave={(sourceId, targetId, type) =>
                    handleSave(rel.id, sourceId, targetId, type)
                  }
                  onCancel={handleCancelEdit}
                />
              ) : (
                <RelationshipSentence
                  key={rel.id}
                  relationshipId={rel.id}
                  sourceEntity={sourceEntity}
                  relationshipType={rel.relationship_type}
                  targetEntity={targetEntity}
                  description={rel.description}
                  onEdit={() => handleEdit(rel.id)}
                  onDelete={() =>
                    handleDelete(rel.id, rel.relationship_type, targetEntity.name)
                  }
                />
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}
