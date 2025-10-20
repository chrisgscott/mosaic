"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RelationshipSentence } from "./relationship-sentence";
import { RelationshipEditForm } from "./relationship-edit-form";
import type { Entity } from "@/app/(app)/graph/actions";
import { toast } from "sonner";
import { updateRelationship, deleteRelationship, getEntities } from "@/app/(app)/graph/actions";

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
  onRelationshipUpdated,
}: RelationshipsCardProps) {
  const [editingRelationshipId, setEditingRelationshipId] = useState<string | null>(null);
  const [allEntities, setAllEntities] = useState<Entity[]>([]);

  // Load all entities for relationship editing
  useEffect(() => {
    const loadEntities = async () => {
      const result = await getEntities();
      if (result.entities) {
        setAllEntities(result.entities);
      }
    };
    loadEntities();
  }, []);

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
      await updateRelationship(relationshipId, {
        source_entity_id: sourceId,
        target_entity_id: targetId,
        relationship_type: type,
      });
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
              // For outgoing: source is current entity, target is rel.target
              // For incoming: source is rel.source, target is current entity
              const isOutgoing = !rel.source || rel.source.id === currentEntityId;
              
              let sourceEntity, targetEntity;
              
              if (isOutgoing) {
                // Outgoing: current entity -> target
                sourceEntity = allEntities.find((e) => e.id === currentEntityId) || {
                  id: currentEntityId,
                  name: "Current Entity",
                  type: "unknown"
                };
                targetEntity = rel.target || {
                  id: "unknown",
                  name: "Unknown",
                  type: "unknown"
                };
              } else {
                // Incoming: source -> current entity
                sourceEntity = rel.source || {
                  id: "unknown",
                  name: "Unknown",
                  type: "unknown"
                };
                targetEntity = allEntities.find((e) => e.id === currentEntityId) || {
                  id: currentEntityId,
                  name: "Current Entity",
                  type: "unknown"
                };
              }

              // Get the relationship for editing
              const editSourceId = rel.source?.id || currentEntityId;
              const editTargetId = rel.target?.id || currentEntityId;

              // Skip if we don't have valid entities
              if (!sourceEntity || !targetEntity) {
                return null;
              }

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
