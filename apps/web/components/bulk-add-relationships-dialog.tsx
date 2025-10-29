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
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { bulkCreateRelationships, type Entity } from "@/app/(app)/admin/graph/actions";
import { toast } from "sonner";

// Relationship types from backend
const RELATIONSHIP_TYPES = [
  "uses",
  "requires",
  "relates_to",
  "part_of",
  "implements",
  "extends",
  "depends_on",
  "collaborates_with",
  "manages",
  "creates",
  "analyzes",
  "evaluates",
  "other",
];

// Convert snake_case to plain language
function formatRelationshipType(type: string): string {
  return type.replace(/_/g, " ");
}

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

interface BulkAddRelationshipsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceEntities: Entity[];
  allEntities: Entity[];
  onComplete: () => void;
}

export function BulkAddRelationshipsDialog({
  open,
  onOpenChange,
  sourceEntities,
  allEntities,
  onComplete,
}: BulkAddRelationshipsDialogProps) {
  const [relationshipType, setRelationshipType] = useState<string>("");
  const [targetEntityId, setTargetEntityId] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [openTargetCombobox, setOpenTargetCombobox] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const targetEntity = allEntities.find((e) => e.id === targetEntityId);

  // Filter out source entities from target selection
  const sourceEntityIds = new Set(sourceEntities.map((e) => e.id));
  const availableTargets = allEntities.filter((e) => !sourceEntityIds.has(e.id));

  const handleCreate = async () => {
    if (!relationshipType || !targetEntityId) {
      toast.error("Please select a relationship type and target entity");
      return;
    }

    setIsCreating(true);

    const result = await bulkCreateRelationships({
      sourceEntityIds: sourceEntities.map((e) => e.id),
      targetEntityId,
      relationshipType,
      description: description || null,
    });

    if (result.error) {
      toast.error(result.error);
    } else {
      const message = result.skipped
        ? `Created ${result.count} relationship${result.count! > 1 ? "s" : ""} (${result.skipped} skipped - already exist)`
        : `Created ${result.count} relationship${result.count! > 1 ? "s" : ""}`;
      toast.success(message);
      onComplete();
      onOpenChange(false);
      // Reset form
      setRelationshipType("");
      setTargetEntityId("");
      setDescription("");
    }

    setIsCreating(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Relationships</DialogTitle>
          <DialogDescription>
            Create relationships between {sourceEntities.length} selected entit
            {sourceEntities.length > 1 ? "ies" : "y"} and a common target entity.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Source Entities Preview */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Source Entities ({sourceEntities.length})</label>
            <div className="flex flex-wrap gap-2 p-3 border rounded bg-muted/30 max-h-32 overflow-y-auto">
              {sourceEntities.map((entity) => (
                <Badge
                  key={entity.id}
                  variant="outline"
                  style={{
                    borderColor: getColorForType(entity.type),
                    color: getColorForType(entity.type),
                  }}
                >
                  {entity.name}
                </Badge>
              ))}
            </div>
          </div>

          {/* Relationship Type */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Relationship Type</label>
            <Select value={relationshipType} onValueChange={setRelationshipType}>
              <SelectTrigger>
                <SelectValue placeholder="Select relationship type..." />
              </SelectTrigger>
              <SelectContent>
                {RELATIONSHIP_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {formatRelationshipType(type)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Target Entity */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Target Entity</label>
            <Popover open={openTargetCombobox} onOpenChange={setOpenTargetCombobox}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  className="w-full justify-between"
                  style={{
                    borderColor: targetEntity ? getColorForType(targetEntity.type) : undefined,
                    color: targetEntity ? getColorForType(targetEntity.type) : undefined,
                  }}
                >
                  {targetEntity ? (
                    <div className="flex items-center gap-2">
                      <span>{targetEntity.name}</span>
                      <span className="text-xs text-muted-foreground">({targetEntity.type})</span>
                    </div>
                  ) : (
                    "Select target entity..."
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[500px] p-0">
                <Command>
                  <CommandInput placeholder="Search entities..." />
                  <CommandList>
                    <CommandEmpty>No entity found.</CommandEmpty>
                    <CommandGroup>
                      {availableTargets.map((entity) => (
                        <CommandItem
                          key={entity.id}
                          value={entity.name}
                          onSelect={() => {
                            setTargetEntityId(entity.id);
                            setOpenTargetCombobox(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              targetEntityId === entity.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="flex flex-col">
                            <span>{entity.name}</span>
                            <span className="text-xs text-muted-foreground">{entity.type}</span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Description (optional)</label>
            <Textarea
              placeholder="Describe these relationships... (used by AI for graph search)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px]"
            />
            <p className="text-xs text-muted-foreground">
              This description will be applied to all {sourceEntities.length} relationships.
            </p>
          </div>

          {/* Preview */}
          {relationshipType && targetEntity && (
            <div className="p-3 border rounded bg-muted/30 space-y-1">
              <p className="text-sm font-medium">Preview:</p>
              <p className="text-sm text-muted-foreground">
                Each of the {sourceEntities.length} selected entities will{" "}
                <span className="font-medium text-foreground">
                  {formatRelationshipType(relationshipType)}
                </span>{" "}
                <span
                  className="font-medium"
                  style={{ color: getColorForType(targetEntity.type) }}
                >
                  {targetEntity.name}
                </span>
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!relationshipType || !targetEntityId || isCreating}
          >
            {isCreating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              `Create ${sourceEntities.length} Relationship${sourceEntities.length > 1 ? "s" : ""}`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
