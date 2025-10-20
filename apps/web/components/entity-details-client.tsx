"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { FileText, Edit2, Trash2, Save, X, ArrowRight, ArrowLeft, Check, ChevronsUpDown, ArrowLeftRight } from "lucide-react";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { 
  deleteEntity, 
  updateEntity, 
  deleteRelationship,
  updateRelationship,
  getEntities,
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
  const [editTargetEntityId, setEditTargetEntityId] = useState("");
  const [editSourceEntityId, setEditSourceEntityId] = useState("");
  const [allEntities, setAllEntities] = useState<Entity[]>([]);
  const [openCombobox, setOpenCombobox] = useState(false);

  // Common relationship types
  const relationshipTypes = [
    "uses",
    "integrates with",
    "depends on",
    "implements",
    "extends",
    "contains",
    "part of",
    "related to",
    "manages",
    "owned by",
  ];

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

  // Fetch all entities for the combobox
  useEffect(() => {
    const fetchEntities = async () => {
      const result = await getEntities();
      if (result.entities) {
        setAllEntities(result.entities);
      }
    };
    fetchEntities();
  }, []);

  const handleEditRelationship = (rel: Relationship, isOutgoing: boolean) => {
    setEditingRelationshipId(rel.id);
    setEditRelType(rel.relationship_type);
    setEditRelDesc(rel.description || "");
    // Set both source and target for full editing capability
    setEditSourceEntityId(rel.source?.id || "");
    setEditTargetEntityId(rel.target?.id || "");
  };

  const handleReverseDirection = () => {
    // Swap source and target
    const temp = editSourceEntityId;
    setEditSourceEntityId(editTargetEntityId);
    setEditTargetEntityId(temp);
  };

  const handleSaveRelationship = async (relationshipId: string, isOutgoing: boolean) => {
    const result = await updateRelationship(relationshipId, {
      relationship_type: editRelType,
      description: editRelDesc || null,
      source_entity_id: editSourceEntityId,
      target_entity_id: editTargetEntityId,
    });

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success("Relationship updated");
    setEditingRelationshipId(null);
    setEditSourceEntityId("");
    setEditTargetEntityId("");
    router.refresh();
  };

  const handleCancelEditRelationship = () => {
    setEditingRelationshipId(null);
    setEditRelType("");
    setEditRelDesc("");
    setEditSourceEntityId("");
    setEditTargetEntityId("");
    setOpenCombobox(false);
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
        <div className="space-y-6">
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
                  <div className="mt-3 space-y-3">
                    {outgoingRelationships.map((rel) => (
                      <div key={rel.id} className="space-y-2">
                        {editingRelationshipId === rel.id ? (
                          <div className="flex flex-col gap-3 p-3 border rounded bg-muted/30">
                            <div className="flex items-center gap-2 flex-wrap">
                              {/* Source Entity Chip */}
                              <Badge 
                                variant="outline" 
                                className="text-sm px-3 py-1"
                                style={{ 
                                  borderColor: getColorForType(entity.type),
                                  color: getColorForType(entity.type)
                                }}
                              >
                                {allEntities.find((e) => e.id === editSourceEntityId)?.name || entity.name}
                              </Badge>

                              {/* Relationship Type Chip */}
                              <Select value={editRelType} onValueChange={setEditRelType}>
                                <SelectTrigger className="w-auto h-auto px-3 py-1 text-sm border-dashed">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {relationshipTypes.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {type}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>

                              {/* Target Entity Chip */}
                              <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                <PopoverTrigger asChild>
                                  <Badge 
                                    variant="outline" 
                                    className="text-sm px-3 py-1 cursor-pointer hover:bg-muted border-dashed"
                                    style={{ 
                                      borderColor: rel.target ? getColorForType(rel.target.type) : undefined,
                                      color: rel.target ? getColorForType(rel.target.type) : undefined
                                    }}
                                  >
                                    {editTargetEntityId
                                      ? allEntities.find((e) => e.id === editTargetEntityId)?.name
                                      : "Select entity..."}
                                    <ChevronsUpDown className="ml-2 h-3 w-3" />
                                  </Badge>
                                </PopoverTrigger>
                                <PopoverContent className="w-[300px] p-0">
                                  <Command>
                                    <CommandInput placeholder="Search entities..." />
                                    <CommandList>
                                      <CommandEmpty>No entity found.</CommandEmpty>
                                      <CommandGroup>
                                        {allEntities.map((e) => (
                                          <CommandItem
                                            key={e.id}
                                            value={e.name}
                                            onSelect={() => {
                                              setEditTargetEntityId(e.id);
                                              setOpenCombobox(false);
                                            }}
                                          >
                                            <Check
                                              className={cn(
                                                "mr-2 h-4 w-4",
                                                editTargetEntityId === e.id ? "opacity-100" : "opacity-0"
                                              )}
                                            />
                                            <div className="flex flex-col">
                                              <span>{e.name}</span>
                                              <span className="text-xs text-muted-foreground">{e.type}</span>
                                            </div>
                                          </CommandItem>
                                        ))}
                                      </CommandGroup>
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>

                              {/* Reverse Direction Button */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleReverseDirection}
                                className="h-auto px-2 py-1"
                                title="Reverse direction"
                              >
                                <ArrowLeftRight className="h-4 w-4" />
                              </Button>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveRelationship(rel.id, true)}
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
                          <div className="flex items-center gap-2 flex-wrap group">
                            {/* Sentence: [Entity] [relationship] [Entity] */}
                            <Badge 
                              variant="outline" 
                              className="text-sm px-3 py-1"
                              style={{ 
                                borderColor: getColorForType(entity.type),
                                color: getColorForType(entity.type)
                              }}
                            >
                              {entity.name}
                            </Badge>
                            <Badge variant="secondary" className="text-sm px-3 py-1">
                              {rel.relationship_type}
                            </Badge>
                            <Badge 
                              variant="outline" 
                              className="text-sm px-3 py-1 cursor-pointer hover:underline"
                              style={{ 
                                borderColor: rel.target ? getColorForType(rel.target.type) : undefined,
                                color: rel.target ? getColorForType(rel.target.type) : undefined
                              }}
                              onClick={() => rel.target && router.push(`/graph/${rel.target.id}`)}
                            >
                              {rel.target?.name}
                            </Badge>

                            {/* Edit/Delete buttons */}
                            <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditRelationship(rel, true)}
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
                          <p className="text-xs text-muted-foreground ml-2">{rel.description}</p>
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
                  <div className="mt-3 space-y-3">
                    {incomingRelationships.map((rel) => (
                      <div key={rel.id} className="space-y-2">
                        {editingRelationshipId === rel.id ? (
                          <div className="flex flex-col gap-3 p-3 border rounded bg-muted/30">
                            {/* Source → Target with Reverse Button */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <Label className="text-xs text-muted-foreground">Source</Label>
                                <div className="text-sm font-medium p-2 bg-background rounded border">
                                  {allEntities.find((e) => e.id === editSourceEntityId)?.name || entity.name}
                                </div>
                              </div>
                              
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleReverseDirection}
                                className="mt-5"
                                title="Reverse direction"
                              >
                                <ArrowLeftRight className="h-4 w-4" />
                              </Button>

                              <div className="flex-1">
                                <Label className="text-xs text-muted-foreground">Target</Label>
                                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      aria-expanded={openCombobox}
                                      className="w-full justify-between text-sm"
                                    >
                                      {editTargetEntityId
                                        ? allEntities.find((e) => e.id === editTargetEntityId)?.name
                                        : "Select entity..."}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[300px] p-0">
                                    <Command>
                                      <CommandInput placeholder="Search entities..." />
                                      <CommandList>
                                        <CommandEmpty>No entity found.</CommandEmpty>
                                        <CommandGroup>
                                          {allEntities.map((e) => (
                                            <CommandItem
                                              key={e.id}
                                              value={e.name}
                                              onSelect={() => {
                                                setEditTargetEntityId(e.id);
                                                setOpenCombobox(false);
                                              }}
                                            >
                                              <Check
                                                className={cn(
                                                  "mr-2 h-4 w-4",
                                                  editTargetEntityId === e.id ? "opacity-100" : "opacity-0"
                                                )}
                                              />
                                              <div className="flex flex-col">
                                                <span>{e.name}</span>
                                                <span className="text-xs text-muted-foreground">{e.type}</span>
                                              </div>
                                            </CommandItem>
                                          ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </div>

                            {/* Relationship Type */}
                            <div>
                              <Label className="text-xs text-muted-foreground">Relationship Type</Label>
                              <Select value={editRelType} onValueChange={setEditRelType}>
                                <SelectTrigger className="text-sm">
                                  <SelectValue placeholder="Select type" />
                                </SelectTrigger>
                                <SelectContent>
                                  {relationshipTypes.map((type) => (
                                    <SelectItem key={type} value={type}>
                                      {type}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            {/* Description */}
                            <div>
                              <Label className="text-xs text-muted-foreground">Description (optional)</Label>
                              <Input
                                value={editRelDesc}
                                onChange={(e) => setEditRelDesc(e.target.value)}
                                placeholder="Add description..."
                                className="text-sm"
                              />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveRelationship(rel.id, true)}
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
                              onClick={() => router.push(`/graph/${rel.target?.id}`)}
                              className="hover:underline"
                            >
                              {rel.target?.name}
                            </button>
                            <ArrowRight className="h-3 w-3 text-muted-foreground" />
                            <Badge variant="secondary" className="text-xs">
                              {rel.relationship_type}
                            </Badge>
                            <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditRelationship(rel, true)}
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
                          <div className="flex flex-col gap-3 p-3 border rounded">
                            <div className="grid grid-cols-2 gap-2">
                              {/* Source Entity Combobox */}
                              <div>
                                <Label className="text-xs text-muted-foreground">Source Entity</Label>
                                <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                  <PopoverTrigger asChild>
                                    <Button
                                      variant="outline"
                                      role="combobox"
                                      aria-expanded={openCombobox}
                                      className="w-full justify-between text-sm"
                                    >
                                      {editTargetEntityId
                                        ? allEntities.find((e) => e.id === editTargetEntityId)?.name
                                        : "Select entity..."}
                                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-[300px] p-0">
                                    <Command>
                                      <CommandInput placeholder="Search entities..." />
                                      <CommandList>
                                        <CommandEmpty>No entity found.</CommandEmpty>
                                        <CommandGroup>
                                          {allEntities
                                            .filter((e) => e.id !== entity.id)
                                            .map((e) => (
                                              <CommandItem
                                                key={e.id}
                                                value={e.name}
                                                onSelect={() => {
                                                  setEditTargetEntityId(e.id);
                                                  setOpenCombobox(false);
                                                }}
                                              >
                                                <Check
                                                  className={cn(
                                                    "mr-2 h-4 w-4",
                                                    editTargetEntityId === e.id ? "opacity-100" : "opacity-0"
                                                  )}
                                                />
                                                <div className="flex flex-col">
                                                  <span>{e.name}</span>
                                                  <span className="text-xs text-muted-foreground">{e.type}</span>
                                                </div>
                                              </CommandItem>
                                            ))}
                                        </CommandGroup>
                                      </CommandList>
                                    </Command>
                                  </PopoverContent>
                                </Popover>
                              </div>

                              {/* Relationship Type Select */}
                              <div>
                                <Label className="text-xs text-muted-foreground">Type</Label>
                                <Select value={editRelType} onValueChange={setEditRelType}>
                                  <SelectTrigger className="text-sm">
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {relationshipTypes.map((type) => (
                                      <SelectItem key={type} value={type}>
                                        {type}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            {/* Description */}
                            <div>
                              <Label className="text-xs text-muted-foreground">Description (optional)</Label>
                              <Input
                                value={editRelDesc}
                                onChange={(e) => setEditRelDesc(e.target.value)}
                                placeholder="Add description..."
                                className="text-sm"
                              />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleSaveRelationship(rel.id, false)}
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
                              onClick={() => router.push(`/graph/${rel.source?.id}`)}
                              className="hover:underline"
                            >
                              {rel.source?.name}
                            </button>
                            <div className="ml-auto opacity-0 group-hover:opacity-100 flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditRelationship(rel, false)}
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
