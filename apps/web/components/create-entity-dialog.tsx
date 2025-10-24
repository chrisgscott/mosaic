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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, Check, X } from "lucide-react";
import {
  createEntity,
  generateEntityDescription,
  suggestEntityRelationships,
  createRelationship,
  type Entity,
} from "@/app/(app)/graph/actions";
import { toast } from "sonner";

// Helper function to get color for entity type
function getColorForType(type: string): string {
  const colors: Record<string, string> = {
    methodology: "#3b82f6",
    framework: "#8b5cf6",
    tool: "#10b981",
    concept: "#f59e0b",
    organization: "#ef4444",
    person: "#ec4899",
    program: "#06b6d4",
    project: "#84cc16",
  };
  return colors[type.toLowerCase()] || "#6b7280";
}

// Convert snake_case to plain language
function formatRelationshipType(type: string): string {
  return type.replace(/_/g, " ");
}

interface RelationshipSuggestion {
  targetEntityId: string;
  targetEntityName: string;
  targetEntityType: string;
  relationshipType: string;
  confidence: number;
  reasoning: string;
  selected?: boolean;
}

interface CreateEntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allEntities: Entity[];
  allEntityTypes: string[];
  onComplete: () => void;
}

export function CreateEntityDialog({
  open,
  onOpenChange,
  allEntities,
  allEntityTypes,
  onComplete,
}: CreateEntityDialogProps) {
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [description, setDescription] = useState("");
  const [sourceChunkIds, setSourceChunkIds] = useState<string[]>([]);
  const [sourceDocumentIds, setSourceDocumentIds] = useState<string[]>([]);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isGeneratingRelationships, setIsGeneratingRelationships] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [relationshipSuggestions, setRelationshipSuggestions] = useState<RelationshipSuggestion[]>([]);

  const handleGenerateDescription = async () => {
    if (!name || !type) {
      toast.error("Please enter entity name and type first");
      return;
    }

    setIsGeneratingDescription(true);

    const result = await generateEntityDescription({
      entityName: name,
      entityType: type,
      existingEntities: allEntities.map((e) => ({ name: e.name, type: e.type })),
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      setDescription(result.description || "");
      setSourceChunkIds(result.chunkIds || []);
      setSourceDocumentIds(result.documentIds || []);
      const ragMessage = result.usedRag 
        ? `✅ Description generated from ${result.chunkIds?.length || 0} relevant chunks in your documents!`
        : "⚠️ Description generated using AI general knowledge (no relevant content found in your documents)";
      toast.success(ragMessage, { duration: 5000 });
    }

    setIsGeneratingDescription(false);
  };

  const handleSuggestRelationships = async () => {
    if (!name || !type) {
      toast.error("Please enter entity name and type first");
      return;
    }

    setIsGeneratingRelationships(true);

    const result = await suggestEntityRelationships({
      entityName: name,
      entityType: type,
      entityDescription: description || undefined,
      existingEntities: allEntities.map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        description: e.description,
      })),
    });

    if (result.error) {
      toast.error(result.error);
    } else if (result.suggestions && result.suggestions.length > 0) {
      setRelationshipSuggestions(
        result.suggestions.map((s: RelationshipSuggestion) => ({ ...s, selected: true }))
      );
      toast.success(`Found ${result.suggestions.length} relationship suggestion${result.suggestions.length > 1 ? "s" : ""}`);
    } else {
      toast.info("No relationship suggestions found");
      setRelationshipSuggestions([]);
    }

    setIsGeneratingRelationships(false);
  };

  const toggleRelationshipSelection = (index: number) => {
    setRelationshipSuggestions((prev) =>
      prev.map((s, i) => (i === index ? { ...s, selected: !s.selected } : s))
    );
  };

  const handleCreate = async () => {
    if (!name || !type) {
      toast.error("Please enter entity name and type");
      return;
    }

    setIsCreating(true);

    // Create the entity
    const result = await createEntity({
      name,
      type,
      description: description || null,
      chunkIds: sourceChunkIds,
      documentIds: sourceDocumentIds,
    });

    if (result.error) {
      toast.error(result.error);
      setIsCreating(false);
      return;
    }

    const newEntityId = result.entity?.id;

    // Create selected relationships
    const selectedRelationships = relationshipSuggestions.filter((s) => s.selected);
    
    if (selectedRelationships.length > 0 && newEntityId) {
      let successCount = 0;
      let failCount = 0;

      for (const rel of selectedRelationships) {
        const relResult = await createRelationship({
          source_entity_id: newEntityId,
          target_entity_id: rel.targetEntityId,
          relationship_type: rel.relationshipType,
          description: rel.reasoning || null,
        });

        if (relResult.success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      if (successCount > 0) {
        toast.success(
          `Created entity with ${successCount} relationship${successCount > 1 ? "s" : ""}` +
          (failCount > 0 ? ` (${failCount} failed)` : "")
        );
      }
    } else {
      toast.success("Entity created successfully!");
    }

    onComplete();
    onOpenChange(false);
    
    // Reset form
    setName("");
    setType("");
    setDescription("");
    setSourceChunkIds([]);
    setSourceDocumentIds([]);
    setRelationshipSuggestions([]);
    setIsCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Entity</DialogTitle>
          <DialogDescription>
            Add a new entity to your knowledge graph with AI-powered description and relationship suggestions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Entity Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Entity Name *</label>
            <Input
              placeholder="e.g., Design Thinking, Tesla, React"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Entity Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Entity Type *</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue placeholder="Select entity type..." />
              </SelectTrigger>
              <SelectContent>
                {allEntityTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Description</label>
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateDescription}
                disabled={!name || !type || isGeneratingDescription}
              >
                {isGeneratingDescription ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-3 w-3" />
                    Generate with AI
                  </>
                )}
              </Button>
            </div>
            <Textarea
              placeholder="Describe this entity... (or use AI to generate)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px]"
            />
          </div>

          {/* Relationship Suggestions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Relationships</label>
              <Button
                size="sm"
                variant="outline"
                onClick={handleSuggestRelationships}
                disabled={!name || !type || isGeneratingRelationships}
              >
                {isGeneratingRelationships ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Finding...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-3 w-3" />
                    Suggest with AI
                  </>
                )}
              </Button>
            </div>

            {relationshipSuggestions.length > 0 && (
              <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
                <p className="text-sm text-muted-foreground">
                  Select relationships to create (click to toggle):
                </p>
                {relationshipSuggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className={`flex items-start gap-3 p-3 border rounded cursor-pointer transition-colors ${
                      suggestion.selected
                        ? "bg-primary/10 border-primary"
                        : "bg-background hover:bg-muted/50"
                    }`}
                    onClick={() => toggleRelationshipSelection(index)}
                  >
                    <div className="pt-0.5">
                      {suggestion.selected ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{name}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelationshipType(suggestion.relationshipType)}
                        </span>
                        <Badge
                          variant="outline"
                          style={{
                            borderColor: getColorForType(suggestion.targetEntityType),
                            color: getColorForType(suggestion.targetEntityType),
                          }}
                        >
                          {suggestion.targetEntityName}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {Math.round(suggestion.confidence * 100)}% confidence
                        </Badge>
                      </div>
                      {suggestion.reasoning && (
                        <p className="text-xs text-muted-foreground">
                          {suggestion.reasoning}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              // Reset form
              setName("");
              setType("");
              setDescription("");
              setRelationshipSuggestions([]);
            }}
            disabled={isCreating}
          >
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name || !type || isCreating}>
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              `Create Entity${relationshipSuggestions.filter((s) => s.selected).length > 0 ? ` + ${relationshipSuggestions.filter((s) => s.selected).length} Relationship${relationshipSuggestions.filter((s) => s.selected).length > 1 ? "s" : ""}` : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
