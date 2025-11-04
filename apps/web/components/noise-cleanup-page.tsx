"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Sparkles, Trash2, AlertTriangle, ArrowLeft, Filter } from "lucide-react";
import { toast } from "sonner";
import { type Entity } from "@/app/(app)/admin/graph/actions";
import { deleteEntity } from "@/app/(app)/admin/graph/actions";

interface NoiseEntity extends Entity {
  noiseScore: number;
  noiseType: string;
  noiseReason: string;
}

export function NoiseCleanupPage() {
  const router = useRouter();
  const [isDetecting, setIsDetecting] = useState(false);
  const [noiseEntities, setNoiseEntities] = useState<NoiseEntity[]>([]);
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);

  const detectNoise = async () => {
    setIsDetecting(true);
    setNoiseEntities([]);
    setSelectedEntityIds(new Set());

    try {
      const response = await fetch("/api/ai/detect-noise", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to detect noise");
      }

      const data = await response.json();

      if (data.noiseGroups.length === 0) {
        toast.success("No noise entities found! Your graph is clean. 🎉");
      } else {
        // Flatten all noise entities into a single list
        const flattenedEntities: NoiseEntity[] = [];
        data.noiseGroups.forEach((group: any) => {
          group.entities.forEach((entity: Entity) => {
            flattenedEntities.push({
              ...entity,
              noiseScore: group.severity,
              noiseType: group.noiseType,
              noiseReason: group.reason,
            });
          });
        });

        // Sort by noise score (highest first)
        flattenedEntities.sort((a, b) => b.noiseScore - a.noiseScore);

        setNoiseEntities(flattenedEntities);
        toast.success(
          `Found ${flattenedEntities.length} noise entities to review`
        );
      }
    } catch (error) {
      console.error("Detection error:", error);
      toast.error("Failed to detect noise");
    } finally {
      setIsDetecting(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedEntityIds.size === 0) {
      toast.error("Please select entities to delete");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedEntityIds.size} selected noise entities? This action cannot be undone.`
    );

    if (!confirmed) return;

    setIsDeleting(true);

    try {
      // Delete selected entities
      const deletePromises = Array.from(selectedEntityIds).map((entityId) => 
        deleteEntity(entityId)
      );
      const results = await Promise.allSettled(deletePromises);

      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      if (failed === 0) {
        toast.success(`Deleted ${successful} noise entities`);
        // Remove deleted entities from the list
        setNoiseEntities(prev => prev.filter(entity => !selectedEntityIds.has(entity.id)));
      } else {
        toast.error(`Failed to delete ${failed} entities`);
      }

      // Clear selection
      setSelectedEntityIds(new Set());
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete entities");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSelectAll = () => {
    if (selectedEntityIds.size === noiseEntities.length) {
      // Deselect all
      setSelectedEntityIds(new Set());
    } else {
      // Select all
      setSelectedEntityIds(new Set(noiseEntities.map(entity => entity.id)));
    }
  };

  const handleDeleteAllNoise = async () => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ALL ${noiseEntities.length} noise entities? This is a destructive action that cannot be undone.`
    );

    if (!confirmed) return;

    setIsDeleting(true);

    try {
      // Delete all entities
      const deletePromises = noiseEntities.map((entity) => deleteEntity(entity.id));
      const results = await Promise.allSettled(deletePromises);

      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      if (failed === 0) {
        toast.success(`Deleted all ${successful} noise entities`);
        router.push("/admin/graph");
      } else {
        toast.error(`Failed to delete ${failed} entities`);
      }
    } catch (error) {
      console.error("Delete all error:", error);
      toast.error("Failed to delete entities");
    } finally {
      setIsDeleting(false);
    }
  };

  // Don't render if no entities
  if (noiseEntities.length === 0 && !isDetecting) {
    return null;
  }

  const getNoiseTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      generic: "bg-orange-500",
      short: "bg-red-500",
      abbreviation: "bg-yellow-500",
      numeric: "bg-purple-500",
      low_confidence: "bg-blue-500",
      no_description: "bg-gray-500",
      stop_word: "bg-pink-500",
      temporal: "bg-green-500",
      unknown: "bg-slate-500"
    };
    return colors[type] || colors.unknown;
  };

  const getNoiseTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      generic: "Generic Terms",
      short: "Short Names",
      abbreviation: "Abbreviations",
      numeric: "Numeric/Symbols",
      low_confidence: "Low Confidence",
      no_description: "No Description",
      stop_word: "Stop Words",
      temporal: "Temporal References",
      unknown: "Unknown Type"
    };
    return labels[type] || labels.unknown;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clean Up Noise</h1>
          <p className="text-muted-foreground mt-1">
            Remove low-quality entities that shouldn't exist in your knowledge graph
          </p>
        </div>
        <div className="flex gap-2">
          {noiseEntities.length > 0 && (
            <>
              <Button
                variant="destructive"
                onClick={handleDeleteAllNoise}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting All...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete All ({noiseEntities.length})
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={handleSelectAll}
                disabled={isDeleting}
              >
                {selectedEntityIds.size === noiseEntities.length ? "Deselect All" : "Select All"} ({selectedEntityIds.size})
              </Button>
              <Button
                onClick={handleDeleteSelected}
                disabled={isDeleting || selectedEntityIds.size === 0}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Selected ({selectedEntityIds.size})
                  </>
                )}
              </Button>
            </>
          )}
          <Button
            variant="outline"
            onClick={() => router.push("/admin/graph")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Graph
          </Button>
        </div>
      </div>

      {/* Detection or Results */}
      {noiseEntities.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4 text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full">
                <Filter className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Detect Noise Entities</h3>
                <p className="text-muted-foreground mt-2 max-w-md">
                  Find and remove low-quality entities like generic terms, abbreviations, 
                  numbers, and entities with poor descriptions that clutter your knowledge graph.
                </p>
              </div>
              <Button
                onClick={detectNoise}
                disabled={isDetecting}
                size="lg"
                className="mt-4"
              >
                {isDetecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Detecting Noise...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Detect Noise
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Results Summary */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Noise Entities Found</h3>
                  <p className="text-sm text-muted-foreground">
                    {selectedEntityIds.size} of {noiseEntities.length} selected for deletion
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">
                    {noiseEntities.length} total noise entities
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Entity List */}
          <Card>
            <CardContent className="pt-6">
              <div className="max-h-96 overflow-y-auto space-y-2">
                {noiseEntities.map((entity) => (
                  <div
                    key={entity.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedEntityIds.has(entity.id) 
                        ? "bg-red-50 border-red-200" 
                        : "bg-muted/20 hover:bg-muted/30"
                    }`}
                    onClick={() => {
                      const newSelected = new Set(selectedEntityIds);
                      if (newSelected.has(entity.id)) {
                        newSelected.delete(entity.id);
                      } else {
                        newSelected.add(entity.id);
                      }
                      setSelectedEntityIds(newSelected);
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selectedEntityIds.has(entity.id)}
                        onChange={() => {}}
                        className="cursor-pointer h-4 w-4 mt-1"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{entity.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {entity.type}
                          </Badge>
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${getNoiseTypeColor(entity.noiseType)} text-white`}
                          >
                            {getNoiseTypeLabel(entity.noiseType)}
                          </Badge>
                          {entity.extraction_confidence && (
                            <Badge 
                              variant="secondary" 
                              className="text-xs"
                            >
                              {(entity.extraction_confidence * 100).toFixed(0)}% conf.
                            </Badge>
                          )}
                          <Badge 
                            variant="outline" 
                            className="text-xs"
                          >
                            {(entity.noiseScore * 100).toFixed(0)}% noise
                          </Badge>
                        </div>
                        {entity.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {entity.description}
                          </p>
                        )}
                        <p className="text-xs text-orange-600 mt-1">
                          {entity.noiseReason}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{entity.chunk_ids.length} chunks</span>
                          <span>{entity.document_ids.length} documents</span>
                          {entity.aliases && entity.aliases.length > 0 && (
                            <span>{entity.aliases.length} aliases</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="text-xs text-muted-foreground mt-4">
                ⚠️ Selected entities will be permanently deleted along with all their relationships
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
