"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getModelsForCategory, getModelInfo, type ModelCategory } from "@/lib/ai/available-models";
import { Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ModelSelectProps {
  category: ModelCategory;
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}

export function ModelSelect({ category, value, onValueChange, disabled }: ModelSelectProps) {
  const models = getModelsForCategory(category);
  const selectedModel = getModelInfo(value);

  // Speed indicator
  const getSpeedIndicator = (speed: number) => {
    if (speed === 3) return "⚡⚡⚡";
    if (speed === 2) return "⚡⚡";
    return "⚡";
  };

  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue>
          {selectedModel ? (
            <div className="flex items-center justify-between w-full">
              <span>{selectedModel.label}</span>
              <span className="text-xs text-muted-foreground ml-2">
                {selectedModel.costDisplay} {getSpeedIndicator(selectedModel.speed)}
              </span>
            </div>
          ) : (
            "Select a model..."
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {models.map((model) => (
          <SelectItem key={model.value} value={model.value} className="cursor-pointer">
            <div className="flex flex-col gap-1 py-1">
              <div className="flex items-center justify-between gap-4">
                <span className="font-medium">{model.label}</span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{model.costDisplay}/100pg</span>
                  <span>{getSpeedIndicator(model.speed)}</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground line-clamp-2">
                {model.bestFor}
              </div>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface ModelSelectWithInfoProps extends ModelSelectProps {
  label: string;
  description: string;
}

export function ModelSelectWithInfo({
  label,
  description,
  category,
  value,
  onValueChange,
  disabled,
}: ModelSelectWithInfoProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium">{label}</label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">{description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <ModelSelect
        category={category}
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
      />
    </div>
  );
}
