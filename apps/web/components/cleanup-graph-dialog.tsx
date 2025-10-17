"use client";

import { useState, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, Check, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { type Entity } from "@/app/(app)/graph/actions";
import { mergeEntities } from "@/app/(app)/graph/actions";

interface DuplicateGroup {
  entities: Entity[];
  similarityScore: number;
}

export function CleanupGraphDialog({
  open,
  onOpenChange,
  allEntityTypes,
  onCleanupComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allEntityTypes: string[];
  onCleanupComplete: () => void;
}) {
  const [isDetecting, setIsDetecting] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [isMerging, setIsMerging] = useState(false);
  const [processedGroups, setProcessedGroups] = useState<Set<number>>(new Set());
  
  // Editable fields for current group
  const [editedName, setEditedName] = useState("");
  const [editedType, setEditedType] = useState("");
  const [editedDescription, setEditedDescription] = useState("");
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(new Set());

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

  const handleEnhanceWithAI = async () => {
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

      toast.success(`Successfully merged ${group.entities.length} entities!`);
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
        onCleanupComplete();
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
      onOpenChange(false);
    }
  };


  const currentGroup = duplicateGroups[currentGroupIndex];
  const remainingGroups = duplicateGroups.length - processedGroups.size;

  // Don't render if no current group
  if (duplicateGroups.length > 0 && !currentGroup) {
    return null;
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" key={currentGroupIndex}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Clean Up Knowledge Graph
            </DialogTitle>
            <DialogDescription>
              AI-powered duplicate detection to keep your graph clean and accurate
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {duplicateGroups.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto" />
                    <div>
                      <h3 className="font-semibold mb-2">Ready to Clean Your Graph?</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        AI will analyze your entities to find potential duplicates based on name
                        similarity, abbreviations, and semantic meaning.
                      </p>
                      <Button onClick={detectDuplicates} disabled={isDetecting}>
                        {isDetecting ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Analyzing Entities...
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
                        {currentGroup.entities.map((entity) => (
                          <div
                            key={entity.id}
                            className="flex items-center gap-3 p-3 rounded-lg border bg-muted/50"
                          >
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
                            />
                            <div className="flex-1 flex items-center justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{entity.name}</span>
                                <Badge variant="outline" className="text-xs">
                                  {entity.type}
                                </Badge>
                              </div>
                              {entity.description && (
                                <p className="text-sm text-muted-foreground line-clamp-1 mt-1">
                                  {entity.description}
                                </p>
                              )}
                              {entity.aliases && entity.aliases.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  Aliases: {entity.aliases.join(", ")}
                                </p>
                              )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {entity.document_ids?.length || 0} docs •{" "}
                                {entity.chunk_ids?.length || 0} chunks
                              </div>
                            </div>
                          </div>
                        ))}
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
                      <div className="flex gap-2 justify-end">
                        <Button variant="outline" onClick={handleSkip} disabled={isMerging}>
                          <X className="mr-2 h-4 w-4" />
                          Skip
                        </Button>
                        <Button onClick={() => handleMerge(currentGroup)} disabled={isMerging}>
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
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                setDuplicateGroups([]);
                setCurrentGroupIndex(0);
                setProcessedGroups(new Set());
              }}
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
