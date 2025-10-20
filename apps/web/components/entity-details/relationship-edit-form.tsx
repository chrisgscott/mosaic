"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, Save, X, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Entity } from "@/app/(app)/graph/actions";

interface RelationshipEditFormProps {
  sourceEntityId: string;
  targetEntityId: string;
  relationshipType: string;
  allEntities: Entity[];
  relationshipTypes: string[];
  onSave: (sourceId: string, targetId: string, type: string) => void;
  onCancel: () => void;
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

export function RelationshipEditForm({
  sourceEntityId: initialSourceId,
  targetEntityId: initialTargetId,
  relationshipType: initialType,
  allEntities,
  relationshipTypes,
  onSave,
  onCancel,
}: RelationshipEditFormProps) {
  const [sourceId, setSourceId] = useState(initialSourceId);
  const [targetId, setTargetId] = useState(initialTargetId);
  const [relType, setRelType] = useState(initialType);
  const [openCombobox, setOpenCombobox] = useState(false);

  const sourceEntity = allEntities.find((e) => e.id === sourceId);
  const targetEntity = allEntities.find((e) => e.id === targetId);

  const handleReverse = () => {
    const temp = sourceId;
    setSourceId(targetId);
    setTargetId(temp);
  };

  const handleSave = () => {
    onSave(sourceId, targetId, relType);
  };

  return (
    <div className="flex flex-col gap-3 p-3 border rounded bg-muted/30">
      <div className="flex items-center gap-2 flex-wrap">
        {/* Source Entity Chip */}
        <Badge
          variant="outline"
          className="text-sm px-3 py-1"
          style={{
            borderColor: sourceEntity ? getColorForType(sourceEntity.type) : undefined,
            color: sourceEntity ? getColorForType(sourceEntity.type) : undefined,
          }}
        >
          {sourceEntity?.name || "Unknown"}
        </Badge>

        {/* Relationship Type Dropdown */}
        <Select value={relType} onValueChange={setRelType}>
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

        {/* Target Entity Combobox */}
        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
          <PopoverTrigger asChild>
            <Badge
              variant="outline"
              className="text-sm px-3 py-1 cursor-pointer hover:bg-muted border-dashed"
              style={{
                borderColor: targetEntity ? getColorForType(targetEntity.type) : undefined,
                color: targetEntity ? getColorForType(targetEntity.type) : undefined,
              }}
            >
              {targetEntity?.name || "Select entity..."}
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
                        setTargetId(e.id);
                        setOpenCombobox(false);
                      }}
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          targetId === e.id ? "opacity-100" : "opacity-0"
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
          onClick={handleReverse}
          className="h-auto px-2 py-1"
          title="Reverse direction"
        >
          <ArrowLeftRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave}>
          <Save className="h-3 w-3 mr-1" />
          Save
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel}>
          <X className="h-3 w-3 mr-1" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
