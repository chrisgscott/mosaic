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

interface NoiseGroup {
  entities: Entity[];
  noiseType: string;
  severity: number;
  reason: string;
}

export function NoiseCleanupPage() {
  const router = useRouter();
  const [isDetecting, setIsDetecting] = useState(false);
  const [noiseGroups, setNoiseGroups] = useState<NoiseGroup[]>([]);
  const [currentGroupIndex, setCurrentGroupIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [processedGroups, setProcessedGroups] = useState<Set<number>>(new Set());

  const detectNoise = async () => {
    setIsDetecting(true);
    setNoiseGroups([]);
    setCurrentGroupIndex(0);
    setProcessedGroups(new Set());

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
        setNoiseGroups(data.noiseGroups);
        toast.success(
          `Found ${data.totalGroups} noise groups (${data.totalEntities} entities)`
        );
      }
    } catch (error) {
      console.error("Detection error:", error);
      toast.error("Failed to detect noise");
    } finally {
      setIsDetecting(false);
    }
  };

  const handleDeleteGroup = async (group: NoiseGroup) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete all ${group.entities.length} entities in this noise group? This action cannot be undone.`
    );

    if (!confirmed) return;

    setIsDeleting(true);

    try {
      // Delete all entities in the group
      const deletePromises = group.entities.map((entity) => deleteEntity(entity.id));
      const results = await Promise.allSettled(deletePromises);

      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      if (failed === 0) {
        toast.success(`Deleted ${successful} noise entities`);
      } else {
        toast.error(`Failed to delete ${failed} entities`);
      }

      // Mark this group as processed and move to next
      setProcessedGroups((prev) => new Set(prev).add(currentGroupIndex));
      
      if (currentGroupIndex < noiseGroups.length - 1) {
        const nextIndex = currentGroupIndex + 1;
        setCurrentGroupIndex(nextIndex);
      } else {
        toast.success("All noise groups processed!");
        router.push("/admin/graph");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Failed to delete entities");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSkipGroup = () => {
    setProcessedGroups((prev) => new Set(prev).add(currentGroupIndex));
    if (currentGroupIndex < noiseGroups.length - 1) {
      const nextIndex = currentGroupIndex + 1;
      setCurrentGroupIndex(nextIndex);
    } else {
      toast.info("All groups reviewed!");
      router.push("/admin/graph");
    }
  };

  const handleDeleteAllNoise = async () => {
    const totalEntities = noiseGroups.reduce((sum, g) => sum + g.entities.length, 0);
    const confirmed = window.confirm(
      `Are you sure you want to delete ALL ${totalEntities} noise entities? This is a destructive action that cannot be undone.`
    );

    if (!confirmed) return;

    setIsDeleting(true);

    try {
      // Delete all entities in all groups
      const allEntities = noiseGroups.flatMap(g => g.entities);
      const deletePromises = allEntities.map((entity) => deleteEntity(entity.id));
      const results = await Promise.allSettled(deletePromises);

      const successful = results.filter((r) => r.status === "fulfilled").length;
      const failed = results.filter((r) => r.status === "rejected").length;

      if (failed === 0) {
        toast.success(`Deleted all ${successful} noise entities`);
      } else {
        toast.error(`Failed to delete ${failed} entities`);
      }

      router.push("/admin/graph");
    } catch (error) {
      console.error("Delete all error:", error);
      toast.error("Failed to delete entities");
    } finally {
      setIsDeleting(false);
    }
  };

  const currentGroup = noiseGroups[currentGroupIndex];
  const remainingGroups = noiseGroups.length - processedGroups.size;

  // Don't render if no current group
  if (noiseGroups.length > 0 && !currentGroup) {
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
          {noiseGroups.length > 0 && (
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
                  Delete All Noise
                </>
              )}
            </Button>
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
      {noiseGroups.length === 0 ? (
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
          {/* Progress */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold">Noise Groups Remaining</h3>
                  <p className="text-sm text-muted-foreground">
                    {remainingGroups} of {noiseGroups.length} groups to review
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-orange-500" />
                  <span className="text-sm font-medium">
                    {noiseGroups.reduce((sum, g) => sum + g.entities.length, 0)} total noise entities
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Current Group */}
          {currentGroup && (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-orange-500" />
                      {getNoiseTypeLabel(currentGroup.noiseType)}
                    </CardTitle>
                    <CardDescription className="mt-2">
                      {currentGroup.reason}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge 
                      variant="secondary" 
                      className={`${getNoiseTypeColor(currentGroup.noiseType)} text-white`}
                    >
                      Severity: {(currentGroup.severity * 100).toFixed(0)}%
                    </Badge>
                    <Badge variant="outline">
                      {currentGroup.entities.length} entities
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Entity List */}
                  <div className="max-h-96 overflow-y-auto space-y-2">
                    {currentGroup.entities.map((entity) => (
                      <div
                        key={entity.id}
                        className="p-3 border rounded-lg bg-muted/20"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{entity.name}</span>
                              <Badge variant="outline" className="text-xs">
                                {entity.type}
                              </Badge>
                              {entity.extraction_confidence && (
                                <Badge 
                                  variant="secondary" 
                                  className="text-xs"
                                >
                                  {(entity.extraction_confidence * 100).toFixed(0)}% conf.
                                </Badge>
                              )}
                            </div>
                            {entity.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {entity.description}
                              </p>
                            )}
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

                  <p className="text-xs text-muted-foreground">
                    ⚠️ These entities will be permanently deleted along with all their relationships
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-4 border-t">
                  <Button
                    variant="destructive"
                    onClick={() => handleDeleteGroup(currentGroup)}
                    disabled={isDeleting}
                    className="flex-1"
                  >
                    {isDeleting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      <>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Group
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleSkipGroup}
                    disabled={isDeleting}
                  >
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
