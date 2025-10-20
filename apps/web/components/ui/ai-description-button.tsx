"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AIDescriptionButtonProps {
  type: "entity" | "relationship";
  name: string;
  entityType?: string;
  sourceEntityName?: string;
  targetEntityName?: string;
  relationshipType?: string;
  onDescriptionGenerated: (description: string) => void;
  size?: "default" | "sm" | "lg" | "icon";
  variant?: "default" | "outline" | "ghost" | "secondary";
  className?: string;
}

export function AIDescriptionButton({
  type,
  name,
  entityType,
  sourceEntityName,
  targetEntityName,
  relationshipType,
  onDescriptionGenerated,
  size = "sm",
  variant = "outline",
  className,
}: AIDescriptionButtonProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);

    try {
      const response = await fetch("/api/ai/generate-description", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type,
          name,
          entityType,
          sourceEntityName,
          targetEntityName,
          relationshipType,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate description");
      }

      const { description } = await response.json();
      onDescriptionGenerated(description);
      toast.success("Description generated successfully");
    } catch (error) {
      console.error("Error generating description:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to generate description"
      );
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      onClick={handleGenerate}
      disabled={isGenerating}
      className={className}
    >
      {isGenerating ? (
        <>
          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          Generating...
        </>
      ) : (
        <>
          <Sparkles className="h-3 w-3 mr-1" />
          Generate with AI
        </>
      )}
    </Button>
  );
}
