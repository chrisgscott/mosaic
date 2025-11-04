"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, Check, X, ArrowLeft, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { type Entity } from "@/app/(app)/admin/graph/actions";
import { mergeEntities, deleteEntity } from "@/app/(app)/admin/graph/actions";

interface DuplicateGroup {
  entities: Entity[];
  similarityScore: number;
}

export function CleanupGraphPage({
  allEntityTypes,
}: {
  allEntityTypes: string[];
}) {
  const router = useRouter();
  const [isDetecting, setIsDetecting] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [isMerging, setIsMerging] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [processedGroups, setProcessedGroups] = useState<Set<number>>(new Set());
  
  // Editable fields for current group
  const [editedName, setEditedName] = useState("");
  const [editedType, setEditedType] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(new Set());
  const [expandedEntityId, setExpandedEntityId] = useState<string | null>(null);
  const [entityChunks, setEntityChunks] = useState<Record<string, Array<{ content: string; document_id: string }>>>({});

  // Simple heuristics for initial values
  const getSimpleName = (entities: Entity[]) => {
    const longest = entities.reduce((a, b) => (a.name.length > b.name.length ? a : b));
    const shortest = entities.reduce((a, b) => (a.name.length < b.name.length ? a : b));
    if (longest.name.length > shortest.name.length * 1.5) {
      return `${longest.name} (${shortest.name})`;
    }
    return longest.name;
  };

  const getSimpleType = (entities: Entity[]) => {
    const typeCounts = entities.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    return Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0];
  };

  // Sync editable fields when current group changes
  useEffect(() => {
    const currentGroup = duplicateGroups[currentGroupIndex];
    if (currentGroup) {
      setEditedName(getSimpleName(currentGroup.entities));
      setEditedType(getSimpleType(currentGroup.entities));
      setEditedDescription("");
      // Select all entities by default
      setSelectedEntityIds(new Set(currentGroup.entities.map((e) => e.id)));
    }
  }, [currentGroupIndex, duplicateGroups]);

  const fetchEntityChunks = async (entityId: string, chunkIds: string[]) => {
    // Only fetch if we don't already have them
    if (entityChunks[entityId] || chunkIds.length === 0) return;

    try {
      // Fetch up to 3 sample chunks
      const response = await fetch("/api/chunks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chunkIds: chunkIds.slice(0, 3) }),
      });

      if (response.ok) {
        const data = await response.json();
        setEntityChunks((prev) => ({ ...prev, [entityId]: data.chunks }));
      }
    } catch (error) {
      console.error("Failed to fetch chunks:", error);
    }
  };

  const handleEnhanceWithAI = async () => {
    const currentGroup = duplicateGroups[currentGroupIndex];
    const selectedEntities = currentGroup.entities.filter((e) =>
      selectedEntityIds.has(e.id)
    );

    if (selectedEntities.length < 2) {
      toast.error("Select at least 2 entities to enhance");
      return;
    }

    setIsEnhancing(true);

    try {
      const response = await fetch("/api/ai/generate-merge-suggestion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityIds: selectedEntities.map((e) => e.id),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate suggestions");
      }

      const data = await response.json();
      setEditedName(data.suggestedName);
      setEditedType(data.suggestedType);
      setEditedDescription(data.suggestedDescription);
      toast.success("AI suggestions generated!");
    } catch (error) {
      console.error("Enhancement error:", error);
      toast.error("Failed to generate AI suggestions");
    } finally {
      setIsEnhancing(false);
    }
  };

  const detectDuplicates = async () => {
    setIsDetecting(true);
    setDuplicateGroups([]);
    setCurrentGroupIndex(0);
    setProcessedGroups(new Set());

    try {
      const response = await fetch("/api/ai/detect-duplicates", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to detect duplicates");
      }

      const data = await response.json();

      if (data.duplicateGroups.length === 0) {
        toast.success("No duplicates found! Your graph is clean. 🎉");
      } else {
        setDuplicateGroups(data.duplicateGroups);
        // Initialize editable fields with first group's simple defaults
        if (data.duplicateGroups[0]) {
          setEditedName(getSimpleName(data.duplicateGroups[0].entities));
          setEditedType(getSimpleType(data.duplicateGroups[0].entities));
          setEditedDescription("");
        }
        toast.success(
          `Found ${data.totalGroups} duplicate groups (${data.totalEntities} entities)`
        );
      }
    } catch (error) {
      console.error("Detection error:", error);
      toast.error("Failed to detect duplicates");
    } finally {
      setIsDetecting(false);
    }
  };

  const handleMerge = async (group: DuplicateGroup) => {
    // Get only selected entities
    const selectedEntities = group.entities.filter((e) => selectedEntityIds.has(e.id));

    console.log("=== MERGE DEBUG ===");
    console.log("Selected entities:", selectedEntities.map(e => ({ id: e.id, name: e.name })));
    console.log("Edited name:", editedName);
    console.log("Edited type:", editedType);
    console.log("Edited description:", editedDescription);

    if (selectedEntities.length < 2) {
      toast.error("Select at least 2 entities to merge");
      return;
    }

    setIsMerging(true);

    try {
      // Use first selected entity as primary
      const primaryEntityId = selectedEntities[0].id;
      const entityIdsToMerge = selectedEntities.slice(1).map((e) => e.id);

      console.log("Primary entity ID:", primaryEntityId);
      console.log("Entity IDs to merge:", entityIdsToMerge);

      // Collect all aliases from selected entities
      const allAliases = new Set<string>();
      selectedEntities.forEach((entity) => {
        entity.aliases?.forEach((alias) => allAliases.add(alias));
        // Add original entity names as aliases if different from merged name
        if (entity.name !== editedName) {
          allAliases.add(entity.name);
        }
      });

      const mergeData = {
        name: editedName,
        type: editedType,
        description: editedDescription || null,
        aliases: Array.from(allAliases),
      };

      console.log("Merge data:", mergeData);

      const result = await mergeEntities(primaryEntityId, entityIdsToMerge, mergeData);

      console.log("Merge result:", result);

      if (result.error) {
        console.error("Merge error:", result.error);
        toast.error(`Failed to merge: ${result.error}`);
        setIsMerging(false);
        return;
      }

      toast.success(`Successfully merged ${selectedEntities.length} entities!`);
      setProcessedGroups((prev) => new Set(prev).add(currentGroupIndex));

      // Move to next group or complete
      if (currentGroupIndex < duplicateGroups.length - 1) {
        const nextIndex = currentGroupIndex + 1;
        setCurrentGroupIndex(nextIndex);
        // Initialize fields for next group with simple defaults
        const nextGroup = duplicateGroups[nextIndex];
        setEditedName(getSimpleName(nextGroup.entities));
        setEditedType(getSimpleType(nextGroup.entities));
        setEditedDescription("");
      } else {
        toast.success("All duplicates processed!");
        router.push("/admin/graph");
      }
    } catch (error) {
      console.error("Merge error:", error);
      toast.error("Failed to merge entities");
    } finally {
      setIsMerging(false);
    }
  };

  const handleSkip = () => {
    setProcessedGroups((prev) => new Set(prev).add(currentGroupIndex));
    if (currentGroupIndex < duplicateGroups.length - 1) {
      const nextIndex = currentGroupIndex + 1;
      setCurrentGroupIndex(nextIndex);
      // Initialize fields for next group with simple defaults
      const nextGroup = duplicateGroups[nextIndex];
      setEditedName(getSimpleName(nextGroup.entities));
      setEditedType(getSimpleType(nextGroup.entities));
      setEditedDescription("");
    } else {
      toast.info("All groups reviewed!");
      router.push("/admin/graph");
    }
  };

  const handleDelete = async () => {
    const currentGroup = duplicateGroups[currentGroupIndex];
    if (!currentGroup) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete all ${currentGroup.entities.length} entities in this group? This action cannot be undone.`
    );

    if (!confirmed) return;

    setIsDeleting(true);

    try {
      // Delete all entities in the group
      const deletePromises = currentGroup.entities.map((entity) => deleteEntity(entity.id));
      const results = await Promise.allSettled(deletePromises);

      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      if (failed === 0) {
        toast.success(`Deleted ${successful} entities`);
      } else {
        toast.error(`Failed to delete ${failed} entities`);
      }

      // Mark this group as processed and move to next
      setProcessedGroups((prev) => new Set(prev).add(currentGroupIndex));
      
      if (currentGroupIndex < duplicateGroups.length - 1) {
        const nextIndex = currentGroupIndex + 1;
        setCurrentGroupIndex(nextIndex);
        // Initialize fields for next group with simple defaults
        const nextGroup = duplicateGroups[nextIndex];
        setEditedName(getSimpleName(nextGroup.entities));
        setEditedType(getSimpleType(nextGroup.entities));
        setEditedDescription("");
      } else {
        toast.info("All groups reviewed!");
        router.push("/admin/graph");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete entities");
    } finally {
      setIsDeleting(false);
    }
  };


  const currentGroup = duplicateGroups[currentGroupIndex];
  const remainingGroups = duplicateGroups.length - processedGroups.size;

  // Don't render if no current group
  if (duplicateGroups.length > 0 && !currentGroup) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clean Up Knowledge Graph</h1>
          <p className="text-muted-foreground mt-1">
            AI-powered duplicate detection to keep your graph clean and accurate
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/admin/graph")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Graph
        </Button>
      </div>

      {/* Detection or Results */}
      {duplicateGroups.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Find Duplicate Entities</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Scan your knowledge graph for potential duplicates using AI-powered name similarity
                </p>
              </div>
              <div className="flex justify-center">
                <Button
                  onClick={detectDuplicates}
                  disabled={isDetecting}
                  size="lg"
                >
                  {isDetecting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Detecting...
                    </>
                  ) : (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Detect Duplicates
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Progress */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <p className="text-sm font-medium">
                Group {currentGroupIndex + 1} of {duplicateGroups.length}
              </p>
              <p className="text-xs text-muted-foreground">
                {remainingGroups} remaining
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline">
                {Math.round(currentGroup.similarityScore * 100)}% similar
              </Badge>
            </div>
          </div>

          {/* Current Duplicate Group */}
          {currentGroup && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Potential Duplicates</CardTitle>
                <CardDescription>
                  These entities have similar names and may be duplicates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Entities */}
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground mb-2">
                    Select entities to merge (uncheck to exclude):
                  </p>
                  {currentGroup.entities.map((entity) => {
                    const isExpanded = expandedEntityId === entity.id;
                    return (
                      <div
                        key={entity.id}
                        className="rounded-lg border bg-muted/50"
                      >
                        {/* Card Header - Always Visible */}
                        <div className="flex items-center gap-3 p-3">
                          <input
                            type="checkbox"
                            checked={selectedEntityIds.has(entity.id)}
                            onChange={(e) => {
                              const newSelected = new Set(selectedEntityIds);
                              if (e.target.checked) {
                                newSelected.add(entity.id);
                              } else {
                                newSelected.delete(entity.id);
                              }
                              setSelectedEntityIds(newSelected);
                            }}
                            className="cursor-pointer h-4 w-4"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div 
                            className="flex-1 flex items-center justify-between cursor-pointer"
                            onClick={() => {
                              const newExpandedId = isExpanded ? null : entity.id;
                              setExpandedEntityId(newExpandedId);
                              // Fetch chunks when expanding
                              if (newExpandedId && entity.chunk_ids) {
                                fetchEntityChunks(entity.id, entity.chunk_ids);
                              }
                            }}
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{entity.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {entity.type}
                                </Badge>
                              </div>
                              {!isExpanded && entity.description && (
                                <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                                  {entity.description}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="text-xs text-muted-foreground">
                                {entity.document_ids?.length || 0} docs •{" "}
                                {entity.chunk_ids?.length || 0} chunks
                              </div>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="px-3 pb-3 pt-0 space-y-3 border-t mt-3">
                            {entity.description && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                                <p className="text-sm">{entity.description}</p>
                              </div>
                            )}
                            
                            {entity.aliases && entity.aliases.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-1">Aliases</p>
                                <div className="flex flex-wrap gap-1">
                                  {entity.aliases.map((alias, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {alias}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            <div className="grid grid-cols-2 gap-3 text-xs">
                              <div>
                                <p className="font-medium text-muted-foreground mb-1">Documents</p>
                                <p>{entity.document_ids?.length || 0}</p>
                              </div>
                              <div>
                                <p className="font-medium text-muted-foreground mb-1">Chunks</p>
                                <p>{entity.chunk_ids?.length || 0}</p>
                              </div>
                              {entity.extraction_confidence && (
                                <div>
                                  <p className="font-medium text-muted-foreground mb-1">Confidence</p>
                                  <p>{Math.round(entity.extraction_confidence * 100)}%</p>
                                </div>
                              )}
                              <div>
                                <p className="font-medium text-muted-foreground mb-1">Created</p>
                                <p>{new Date(entity.created_at).toLocaleDateString()}</p>
                              </div>
                            </div>

                            {/* Sample Chunks */}
                            {entityChunks[entity.id] && entityChunks[entity.id].length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                  Sample Context (showing {entityChunks[entity.id].length} of {entity.chunk_ids?.length || 0} chunks)
                                </p>
                                <div className="space-y-2">
                                  {entityChunks[entity.id].map((chunk, idx) => (
                                    <div key={idx} className="p-2 bg-background rounded border text-xs">
                                      <p className="text-muted-foreground line-clamp-3">{chunk.content}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Editable Merged Entity */}
                <div className="space-y-4">
                  <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
                    <p className="text-sm font-medium mb-3">Merged Entity (editable):</p>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Name</label>
                          <Input
                            value={editedName}
                            onChange={(e) => setEditedName(e.target.value)}
                            placeholder="Entity name"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-medium">Type</label>
                          <Select value={editedType} onValueChange={setEditedType}>
                            <SelectTrigger>
                              <SelectValue />
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
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium">Description</label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleEnhanceWithAI}
                            disabled={isEnhancing || isMerging || selectedEntityIds.size < 2}
                            className="h-7 text-xs"
                          >
                            {isEnhancing ? (
                              <>
                                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                Enhancing...
                              </>
                            ) : (
                              <>
                                <Sparkles className="mr-1 h-3 w-3" />
                                Enhance with AI
                              </>
                            )}
                          </Button>
                        </div>
                        <Textarea
                          value={editedDescription}
                          onChange={(e) => setEditedDescription(e.target.value)}
                          placeholder="Entity description (or click 'Enhance with AI')"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    💡 All relationships, documents, and chunks will be preserved and point to the merged entity
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={() => handleMerge(currentGroup)}
                    disabled={isMerging || isEnhancing || selectedEntityIds.size < 2}
                    className="flex-1"
                  >
                    {isMerging ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Merging...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Merge These
                      </>
                    )}
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isMerging || isEnhancing || isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete All
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSkip}
                    disabled={isMerging || isEnhancing || isDeleting}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Skip
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
