"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { RelationshipSentence } from "./relationship-sentence";
import { RelationshipEditForm } from "./relationship-edit-form";
import type { Entity } from "@/app/(app)/admin/graph/actions";
import { toast } from "sonner";
import { updateRelationship, deleteRelationship, getEntities, createRelationship } from "@/app/(app)/admin/graph/actions";
import { createClient } from "@/lib/supabase/client";

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

export function RelationshipsCard({
  currentEntityId,
  outgoingRelationships,
  incomingRelationships,
  onRelationshipUpdated,
}: RelationshipsCardProps) {
  const [editingRelationshipId, setEditingRelationshipId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [allEntities, setAllEntities] = useState<Entity[]>([]);
  const [relationshipTypes, setRelationshipTypes] = useState<string[]>([]);

  // Load all entities and relationship types
  useEffect(() => {
    const loadData = async () => {
      // Load entities
      const result = await getEntities();
      if (result.entities) {
        setAllEntities(result.entities);
      }

      // Load relationship types from schema settings
      const supabase = createClient();
      const { data: schemaSettings } = await supabase
        .from("system_settings")
        .select("value")
        .eq("key", "schema.relationshipTypes")
        .single();

      if (schemaSettings?.value) {
        const types = (schemaSettings.value as Array<{ name: string; description: string }>).map(t => t.name);
        setRelationshipTypes(types);
      }
    };
    loadData();
  }, []);

  // Combine all relationships with A->Z sorting within groups
  // Outgoing: sort by target entity name; Incoming: sort by source entity name
  const outgoingSorted = [...outgoingRelationships].sort((a, b) =>
    (a.target?.name || "").localeCompare(b.target?.name || "", undefined, {
      sensitivity: "base",
    })
  );
  const incomingSorted = [...incomingRelationships].sort((a, b) =>
    (a.source?.name || "").localeCompare(b.source?.name || "", undefined, {
      sensitivity: "base",
    })
  );
  const allRelationships = [...outgoingSorted, ...incomingSorted];

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
    type: string,
    description?: string
  ) => {
    try {
      await updateRelationship(relationshipId, {
        source_entity_id: sourceId,
        target_entity_id: targetId,
        relationship_type: type,
        description: description || null,
      });
      toast.success("Relationship updated successfully");
      setEditingRelationshipId(null);
      onRelationshipUpdated();
    } catch (error) {
      toast.error("Failed to update relationship");
      console.error(error);
    }
  };

  const handleCreateNew = async (
    sourceId: string,
    targetId: string,
    type: string,
    description?: string
  ) => {
    try {
      await createRelationship({
        source_entity_id: sourceId,
        target_entity_id: targetId,
        relationship_type: type,
        description: description || null,
      });
      toast.success("Relationship created successfully");
      setIsCreatingNew(false);
      onRelationshipUpdated();
    } catch (error) {
      toast.error("Failed to create relationship");
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
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Relationships</CardTitle>
            <CardDescription>
              {allRelationships.length} total
            </CardDescription>
          </div>
          <Button
            size="sm"
            onClick={() => setIsCreatingNew(true)}
            disabled={isCreatingNew}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Relationship
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div>
          {/* New Relationship Form */}
          {isCreatingNew && (
            <div className="mb-4">
              <RelationshipEditForm
                sourceEntityId={currentEntityId}
                targetEntityId=""
                relationshipType={relationshipTypes[0]}
                description=""
                allEntities={allEntities}
                relationshipTypes={relationshipTypes}
                onSave={(sourceId, targetId, type, description) =>
                  handleCreateNew(sourceId, targetId, type, description)
                }
                onCancel={() => setIsCreatingNew(false)}
              />
            </div>
          )}

          {/* Existing Relationships */}
          {allRelationships.length === 0 && !isCreatingNew ? (
            <p className="text-sm text-muted-foreground">No relationships found</p>
          ) : (
            allRelationships.map((rel, index) => {
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
                  description={rel.description || ""}
                  allEntities={allEntities}
                  relationshipTypes={relationshipTypes}
                  onSave={(sourceId, targetId, type, description) =>
                    handleSave(rel.id, sourceId, targetId, type, description)
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
                  isLast={index === allRelationships.length - 1}
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
