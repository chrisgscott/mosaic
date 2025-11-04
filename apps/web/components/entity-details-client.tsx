"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteEntity, updateEntity, type Entity } from "@/app/(app)/admin/graph/actions";
import { EntityHeader } from "./entity-details/entity-header";
import { EntityInfoCard } from "./entity-details/entity-info-card";
import { EntityEditForm } from "./entity-details/entity-edit-form";
import { RelationshipsCard } from "./entity-details/relationships-card";
import { ChunksCard } from "./entity-details/chunks-card";

interface Relationship {
  id: string;
  relationship_type: string;
  description: string | null;
  source?: { id: string; name: string; type: string };
  target?: { id: string; name: string; type: string };
}

interface Document {
  id: string;
  file_name: string;
  created_at: string;
}

interface Chunk {
  id: string;
  content: string;
  document_id: string;
  chunk_index: number;
}

interface EntityDetailsClientProps {
  entity: Entity;
  outgoingRelationships: Relationship[];
  incomingRelationships: Relationship[];
  documents: Document[];
  chunks: Chunk[];
  allEntityTypes: string[];
}

export function EntityDetailsClient({
  entity: initialEntity,
  outgoingRelationships,
  incomingRelationships,
  documents,
  chunks,
  allEntityTypes,
}: EntityDetailsClientProps) {
  const router = useRouter();
  const [entity, setEntity] = useState(initialEntity);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Edit form state (derive from initialEntity to prevent undefined during updates)
  const [editName, setEditName] = useState(initialEntity?.name ?? "");
  const [editType, setEditType] = useState(initialEntity?.type ?? "");
  const [editDescription, setEditDescription] = useState(initialEntity?.description ?? "");
  const [editAliases, setEditAliases] = useState(initialEntity?.aliases?.join(", ") ?? "");

  const handleSave = async () => {
    setIsSaving(true);

    const result = await updateEntity(entity.id, {
      name: editName,
      type: editType,
      description: editDescription,
      aliases: editAliases.split(",").map((a) => a.trim()).filter(Boolean),
    });

    if (result.success) {
      toast.success("Entity updated successfully");
      // Locally merge the updated fields to avoid undefined result.entity
      setEntity((prev) => ({
        ...(prev as Entity),
        name: editName,
        type: editType as any,
        description: editDescription,
        aliases: editAliases.split(",").map((a) => a.trim()).filter(Boolean),
      }));
      setIsEditing(false);
    } else {
      toast.error(result.error || "Failed to update entity");
    }

    setIsSaving(false);
  };

  const handleCancel = () => {
    setEditName(entity.name);
    setEditType(entity.type);
    setEditDescription(entity.description || "");
    setEditAliases(entity.aliases?.join(", ") || "");
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${entity.name}"?`)) {
      return;
    }

    setIsDeleting(true);

    const result = await deleteEntity(entity.id);

    if (result.success) {
      toast.success("Entity deleted successfully");
      router.push("/admin/graph");
    } else {
      toast.error(result.error || "Failed to delete entity");
      setIsDeleting(false);
    }
  };

  const handleRelationshipUpdated = () => {
    // Trigger a refresh by incrementing the key
    setRefreshKey((prev) => prev + 1);
    // In a real app, you'd refetch the data here
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <EntityHeader
        name={entity.name}
        type={entity.type}
        aliases={entity.aliases}
        isEditing={isEditing}
        isDeleting={isDeleting}
        isSaving={isSaving}
        onEdit={() => setIsEditing(true)}
        onDelete={handleDelete}
        onSave={handleSave}
        onCancel={handleCancel}
      />

      {/* Edit Form or Details */}
      {isEditing ? (
        <EntityEditForm
          name={editName}
          type={editType}
          description={editDescription}
          aliases={editAliases}
          allEntityTypes={allEntityTypes}
          onNameChange={setEditName}
          onTypeChange={setEditType}
          onDescriptionChange={setEditDescription}
          onAliasesChange={setEditAliases}
        />
      ) : (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Entity Information - 33% */}
          <div className="md:col-span-1">
            <EntityInfoCard
              description={entity.description}
              extractionConfidence={entity.extraction_confidence || 0}
              documentCount={entity.document_ids?.length || 0}
              chunkCount={entity.chunk_ids?.length || 0}
              createdAt={entity.created_at}
            />
          </div>

          {/* Relationships - 66% */}
          <div className="md:col-span-2">
            <RelationshipsCard
              key={refreshKey}
              currentEntityId={entity.id}
              outgoingRelationships={outgoingRelationships}
              incomingRelationships={incomingRelationships}
              onRelationshipUpdated={handleRelationshipUpdated}
            />
          </div>
        </div>
      )}

      {/* Source Chunks - Full Width */}
      {!isEditing && (
        <ChunksCard chunks={chunks} documents={documents} />
      )}
    </div>
  );
}
