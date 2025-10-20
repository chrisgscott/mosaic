"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Edit2, Trash2, Save, X, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { 
  deleteEntity, 
  updateEntity, 
  deleteRelationship,
  updateRelationship,
  type Entity 
} from "@/app/(app)/graph/actions";

type Relationship = {
  id: string;
  relationship_type: string;
  description: string | null;
  source?: { id: string; name: string; type: string };
  target?: { id: string; name: string; type: string };
};

type Document = {
  id: string;
  file_name: string;
  created_at: string;
};

type Chunk = {
  id: string;
  content: string;
  document_id: string;
  chunk_index: number;
};

export function EntityDetailsClient({
  entity: initialEntity,
  outgoingRelationships,
  incomingRelationships,
  documents,
  chunks,
  allEntityTypes,
}: {
  entity: Entity;
  outgoingRelationships: Relationship[];
  incomingRelationships: Relationship[];
  documents: Document[];
  chunks: Chunk[];
  allEntityTypes: string[];
}) {
  const router = useRouter();
  const [entity, setEntity] = useState(initialEntity);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingRelationshipId, setEditingRelationshipId] = useState<string | null>(null);
  const [editRelType, setEditRelType] = useState("");
  const [editRelDesc, setEditRelDesc] = useState("");

  // Edit form state
  const [editName, setEditName] = useState(entity.name);
  const [editType, setEditType] = useState(entity.type);
  const [editDescription, setEditDescription] = useState(entity.description || "");
  const [editAliases, setEditAliases] = useState(entity.aliases?.join(", ") || "");

  const handleSave = async () => {
    setIsSaving(true);

    const result = await updateEntity(entity.id, {
      name: editName,
      type: editType,
      description: editDescription || null,
      aliases: editAliases
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0),
    });

    if (result.error) {
      toast.error("Failed to update entity");
      setIsSaving(false);
      return;
    }

    toast.success("Entity updated");
    setEntity({
      ...entity,
      name: editName,
      type: editType,
      description: editDescription || null,
      aliases: editAliases
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0),
    });
    setIsEditing(false);
    setIsSaving(false);
    router.refresh();
  };

  const handleCancel = () => {
    setEditName(entity.name);
    setEditType(entity.type);
    setEditDescription(entity.description || "");
    setEditAliases(entity.aliases?.join(", ") || "");
    setIsEditing(false);
  };

  const handleDelete = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${entity.name}"? This will also delete all relationships involving this entity.`
    );

    if (!confirmed) return;

    setIsDeleting(true);

    const result = await deleteEntity(entity.id);

    if (result.error) {
      toast.error("Failed to delete entity");
      setIsDeleting(false);
      return;
    }

    toast.success("Entity deleted");
    router.push("/graph");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getQualityColor = () => {
    const confidence = entity.extraction_confidence || 0;
    const docCount = entity.document_ids?.length || 0;

    if (confidence >= 0.85 && docCount > 1) return "text-green-600";
    if (confidence >= 0.7 || docCount === 1) return "text-yellow-600";
    return "text-red-600";
  };

  const handleEditRelationship = (rel: Relationship) => {
    setEditingRelationshipId(rel.id);
    setEditRelType(rel.relationship_type);
    setEditRelDesc(rel.description || "");
  };

  const handleSaveRelationship = async (relationshipId: string) => {
    const result = await updateRelationship(relationshipId, {
      relationship_type: editRelType,
      description: editRelDesc || null,
    });

    if (result.error) {
      toast.error("Failed to update relationship");
      return;
    }

    toast.success("Relationship updated");
    setEditingRelationshipId(null);
    router.refresh();
  };

  const handleCancelEditRelationship = () => {
    setEditingRelationshipId(null);
    setEditRelType("");
    setEditRelDesc("");
  };

  const handleDeleteRelationship = async (relationshipId: string, relType: string, targetName: string) => {
    const confirmed = window.confirm(
      `Delete relationship "${relType}" to "${targetName}"?`
    );

    if (!confirmed) return;

    const result = await deleteRelationship(relationshipId);

    if (result.error) {
      toast.error("Failed to delete relationship");
      return;
    }

    toast.success("Relationship deleted");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header with Actions */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{entity.name}</h1>
            <Badge variant="outline">{entity.type}</Badge>
          </div>
          {entity.aliases && entity.aliases.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Also known as: {entity.aliases.join(", ")}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          {!isEditing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                <Edit2 className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {isDeleting ? "Deleting..." : "Delete"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={isSaving}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                <Save className="mr-2 h-4 w-4" />
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Edit Form or Details */}
      {isEditing ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit Entity</CardTitle>
            <CardDescription>Update the entity information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Entity name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select value={editType} onValueChange={setEditType}>
                  <SelectTrigger id="type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {allEntityTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Entity description"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="aliases">Aliases (comma-separated)</Label>
              <Input
                id="aliases"
                value={editAliases}
                onChange={(e) => setEditAliases(e.target.value)}
                placeholder="Alternative names, separated by commas"
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Entity Information */}
          <Card>
            <CardHeader>
              <CardTitle>Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {entity.description && (
                <div>
                  <Label className="text-muted-foreground">Description</Label>
                  <p className="mt-1">{entity.description}</p>
                </div>
              )}
              <div>
                <Label className="text-muted-foreground">Confidence</Label>
                <div className="mt-1 flex items-center gap-2">
                  <div className="flex-1 bg-secondary rounded-full h-2">
                    <div
                      className={`${getQualityColor()} bg-current rounded-full h-2`}
                      style={{ width: `${(entity.extraction_confidence || 0) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-medium">
                    {Math.round((entity.extraction_confidence || 0) * 100)}%
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Documents</Label>
                  <p className="mt-1 font-medium">{entity.document_ids?.length || 0}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Chunks</Label>
                  <p className="mt-1 font-medium">{entity.chunk_ids?.length || 0}</p>
                </div>
              </div>
              <div>
                <Label className="text-muted-foreground">Created</Label>
                <p className="mt-1">{formatDate(entity.created_at)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Relationships */}
          <Card>
            <CardHeader>
              <CardTitle>Relationships</CardTitle>
              <CardDescription>
                {outgoingRelationships.length + incomingRelationships.length} total
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {outgoingRelationships.length > 0 && (
                <div>
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <ArrowRight className="h-4 w-4" />
                    Outgoing ({outgoingRelationships.length})
                  </Label>
                  <div className="mt-2 space-y-2">
                    {outgoingRelationships.map((rel) => (
                      <div key={rel.id} className="space-y-2">
                        {editingRelationshipId === rel.id ? (
                          <div className="flex flex-col gap-2 p-2 border rounded">
                            <Input
                              value={editRelType}
                              onChange={(e) => setEditRelType(e.target.value)}
                              placeholder="Relationship type"
                              className="text-sm"
                            />
                            <Input
                              value={editRelDesc}
                              onChange={(e) => setEditRelDesc(e.target.value)}
                              placeholder="Description (optional)"
                              className="text-sm"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveRelationship(rel.id)}
                              >
                                <Save className="h-3 w-3 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEditRelationship}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm group">
                            <Badge variant="secondary" className="text-xs">
                              {rel.relationship_type}
                            </Badge>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <button
                              onClick={() => router.push(`/graph/${rel.target?.id}`)}
                              className="hover:underline"
                            >
                              {rel.target?.name}
                            </button>
                            <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditRelationship(rel)}
                                className="h-6 w-6 p-0"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteRelationship(rel.id, rel.relationship_type, rel.target?.name || '')}
                                className="h-6 w-6 p-0 text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                        {rel.description && editingRelationshipId !== rel.id && (
                          <p className="text-xs text-muted-foreground ml-6">{rel.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {incomingRelationships.length > 0 && (
                <div>
                  <Label className="text-muted-foreground flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Incoming ({incomingRelationships.length})
                  </Label>
                  <div className="mt-2 space-y-2">
                    {incomingRelationships.map((rel) => (
                      <div key={rel.id} className="space-y-2">
                        {editingRelationshipId === rel.id ? (
                          <div className="flex flex-col gap-2 p-2 border rounded">
                            <Input
                              value={editRelType}
                              onChange={(e) => setEditRelType(e.target.value)}
                              placeholder="Relationship type"
                              className="text-sm"
                            />
                            <Input
                              value={editRelDesc}
                              onChange={(e) => setEditRelDesc(e.target.value)}
                              placeholder="Description (optional)"
                              className="text-sm"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveRelationship(rel.id)}
                              >
                                <Save className="h-3 w-3 mr-1" />
                                Save
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={handleCancelEditRelationship}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-sm group">
                            <button
                              onClick={() => router.push(`/graph/${rel.source?.id}`)}
                              className="hover:underline"
                            >
                              {rel.source?.name}
                            </button>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <Badge variant="secondary" className="text-xs">
                              {rel.relationship_type}
                            </Badge>
                            <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditRelationship(rel)}
                                className="h-6 w-6 p-0"
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteRelationship(rel.id, rel.relationship_type, rel.source?.name || '')}
                                className="h-6 w-6 p-0 text-destructive"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                        {rel.description && editingRelationshipId !== rel.id && (
                          <p className="text-xs text-muted-foreground ml-6">{rel.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {outgoingRelationships.length === 0 && incomingRelationships.length === 0 && (
                <p className="text-sm text-muted-foreground">No relationships found</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Documents */}
      {documents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Source Documents</CardTitle>
            <CardDescription>{documents.length} documents</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <button
                    onClick={() => router.push(`/documents/${doc.id}`)}
                    className="hover:underline"
                  >
                    {doc.file_name}
                  </button>
                  <span className="text-muted-foreground">• {formatDate(doc.created_at)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Source Chunks */}
      {chunks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Source Context</CardTitle>
            <CardDescription>{chunks.length} chunks where this entity appears</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {chunks.map((chunk) => (
                <div key={chunk.id} className="space-y-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-3 w-3" />
                    <span>Chunk {chunk.chunk_index + 1}</span>
                  </div>
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <p>{chunk.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
