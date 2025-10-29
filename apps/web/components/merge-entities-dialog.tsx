"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, GitMerge, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { mergeEntities, type Entity } from "@/app/(app)/admin/graph/actions";

export function MergeEntitiesDialog({
  open,
  onOpenChange,
  entities,
  allEntityTypes,
  onMergeComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entities: Entity[];
  allEntityTypes: string[];
  onMergeComplete: () => void;
}) {
  const [primaryEntityId, setPrimaryEntityId] = useState<string>(entities[0]?.id || "");
  const [mergedName, setMergedName] = useState(entities[0]?.name || "");
  const [mergedType, setMergedType] = useState(entities[0]?.type || "");
  const [mergedDescription, setMergedDescription] = useState("");
  const [mergedAliases, setMergedAliases] = useState("");
  const [isMerging, setIsMerging] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);

  // Calculate combined stats
  const totalDocs = new Set(entities.flatMap((e) => e.document_ids || [])).size;
  const totalChunks = new Set(entities.flatMap((e) => e.chunk_ids || [])).size;
  const totalRelationships = entities.reduce((sum, e) => sum + (e.relationship_count || 0), 0);

  const synthesizeDescription = async () => {
    setIsSynthesizing(true);

    try {
      const descriptions = entities
        .map((e) => e.description)
        .filter((d) => d && d.trim().length > 0);

      if (descriptions.length === 0) {
        toast.info("No descriptions available to synthesize");
        setIsSynthesizing(false);
        return;
      }

      const response = await fetch("/api/ai/synthesize-description", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityName: mergedName,
          entityType: mergedType,
          descriptions,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to synthesize description");
      }

      const data = await response.json();
      setMergedDescription(data.description);
      toast.success("Description synthesized!");
    } catch (error) {
      console.error("Synthesis error:", error);
      toast.error("Failed to synthesize description");
    } finally {
      setIsSynthesizing(false);
    }
  };

  const handleMerge = async () => {
    if (!primaryEntityId) {
      toast.error("Please select a primary entity");
      return;
    }

    setIsMerging(true);

    const entityIdsToMerge = entities
      .filter((e) => e.id !== primaryEntityId)
      .map((e) => e.id);

    const result = await mergeEntities(primaryEntityId, entityIdsToMerge, {
      name: mergedName,
      type: mergedType,
      description: mergedDescription || null,
      aliases: mergedAliases
        .split(",")
        .map((a) => a.trim())
        .filter((a) => a.length > 0),
    });

    setIsMerging(false);

    if (result.error) {
      toast.error(`Failed to merge entities: ${result.error}`);
      return;
    }

    toast.success(`Successfully merged ${entities.length} entities`);
    onOpenChange(false);
    onMergeComplete();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Merge Entities</DialogTitle>
          <DialogDescription>
            Combine {entities.length} entities into one. All documents, chunks, and relationships
            will be preserved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Entities to Merge */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Entities to Merge</CardTitle>
              <CardDescription>
                {totalDocs} documents • {totalChunks} chunks • {totalRelationships} relationships
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {entities.map((entity) => (
                  <div
                    key={entity.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="primary"
                        checked={primaryEntityId === entity.id}
                        onChange={() => {
                          setPrimaryEntityId(entity.id);
                          setMergedName(entity.name);
                          setMergedType(entity.type);
                          setMergedDescription(entity.description || "");
                        }}
                        className="cursor-pointer"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{entity.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {entity.type}
                          </Badge>
                        </div>
                        {entity.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {entity.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {entity.document_ids?.length || 0} docs • {entity.chunk_ids?.length || 0}{" "}
                      chunks
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                Select the primary entity (its ID will be kept, others will be deleted)
              </p>
            </CardContent>
          </Card>

          {/* Merged Entity Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Merged Entity Details</CardTitle>
              <CardDescription>Configure the final entity properties</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="merge-name">Name</Label>
                  <Input
                    id="merge-name"
                    value={mergedName}
                    onChange={(e) => setMergedName(e.target.value)}
                    placeholder="Entity name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="merge-type">Type</Label>
                  <Select value={mergedType} onValueChange={setMergedType}>
                    <SelectTrigger id="merge-type">
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="merge-description">Description</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={synthesizeDescription}
                    disabled={isSynthesizing || isMerging}
                    className="h-8"
                  >
                    {isSynthesizing ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        Synthesizing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-3 w-3" />
                        AI Synthesize
                      </>
                    )}
                  </Button>
                </div>
                <Textarea
                  id="merge-description"
                  value={mergedDescription}
                  onChange={(e) => setMergedDescription(e.target.value)}
                  placeholder="Combined description"
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="merge-aliases">Aliases (comma-separated)</Label>
                <Input
                  id="merge-aliases"
                  value={mergedAliases}
                  onChange={(e) => setMergedAliases(e.target.value)}
                  placeholder="Alternative names"
                />
                <p className="text-xs text-muted-foreground">
                  Original entity names will be automatically added as aliases
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isMerging}>
            Cancel
          </Button>
          <Button onClick={handleMerge} disabled={isMerging}>
            {isMerging ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Merging...
              </>
            ) : (
              <>
                <GitMerge className="mr-2 h-4 w-4" />
                Merge Entities
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
