"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, RotateCcw, Info } from "lucide-react";
import type { PromptKey } from "@/lib/ai/prompts";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";

type Setting = {
  id: string;
  key: string;
  value: string;
  description: string | null;
  category: string;
};

// Prompt metadata (duplicated here to avoid server-only imports in client component)
const PROMPT_METADATA: Record<PromptKey, {
  title: string;
  description: string;
  placeholders: string[];
  usedIn: string[];
}> = {
  chat: {
    title: 'Chat System Prompt',
    description: 'Guides the AI when answering questions based on retrieved documents',
    placeholders: ['{context}'],
    usedIn: ['Chat interface', 'Q&A responses'],
  },
  entityExtraction: {
    title: 'Entity Extraction',
    description: 'Extracts entities and relationships from text for knowledge graph',
    placeholders: ['{text}'],
    usedIn: ['Document processing', 'Knowledge graph building'],
  },
  entityDescription: {
    title: 'Entity Description',
    description: 'Generates descriptions for entities using RAG context',
    placeholders: [],
    usedIn: ['Entity creation', 'Knowledge graph'],
  },
  relationshipDescription: {
    title: 'Relationship Description',
    description: 'Generates descriptions for relationships between entities',
    placeholders: [],
    usedIn: ['Relationship creation', 'Knowledge graph'],
  },
  entityMerge: {
    title: 'Entity Merge',
    description: 'Suggests how to merge duplicate entities',
    placeholders: [],
    usedIn: ['Entity deduplication', 'Knowledge graph cleanup'],
  },
  entitySynthesis: {
    title: 'Entity Synthesis',
    description: 'Combines multiple entity descriptions into one',
    placeholders: [],
    usedIn: ['Entity consolidation', 'Description merging'],
  },
  hyde: {
    title: 'HyDE Generation',
    description: 'Creates hypothetical documents for improved search',
    placeholders: ['{query}'],
    usedIn: ['Search enhancement', 'RAG pipeline'],
  },
  multiQuery: {
    title: 'Multi-Query Generation',
    description: 'Generates query variations for better search coverage',
    placeholders: ['{query}'],
    usedIn: ['Search enhancement', 'RAG pipeline'],
  },
};

export function PromptsForm({ prompts }: { prompts: Setting[] }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [values, setValues] = useState<{ [key: string]: string }>(
    prompts.reduce((acc, prompt) => {
      try {
        acc[prompt.key] = JSON.parse(prompt.value);
      } catch {
        acc[prompt.key] = prompt.value;
      }
      return acc;
    }, {} as { [key: string]: string })
  );

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updates = Object.entries(values).map(([key, value]) => ({
        key,
        value: JSON.stringify(value),
      }));

      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: updates }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      toast.success("Prompts saved successfully");
      router.refresh();
    } catch (error) {
      console.error("Error saving prompts:", error);
      toast.error("Failed to save prompts");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset all prompts to defaults? This cannot be undone.")) {
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch("/api/settings/reset-prompts", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to reset prompts");
      }

      toast.success("Prompts reset to defaults");
      router.refresh();
    } catch (error) {
      console.error("Error resetting prompts:", error);
      toast.error("Failed to reset prompts");
    } finally {
      setIsResetting(false);
    }
  };

  const getPromptKey = (fullKey: string): PromptKey => {
    return fullKey.replace('prompts.', '') as PromptKey;
  };

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Prompt Placeholders</AlertTitle>
        <AlertDescription>
          Use placeholders like <code className="bg-muted px-1 py-0.5 rounded">{"{context}"}</code>,{" "}
          <code className="bg-muted px-1 py-0.5 rounded">{"{text}"}</code>, or{" "}
          <code className="bg-muted px-1 py-0.5 rounded">{"{query}"}</code> in your prompts.
          They will be replaced with actual content at runtime.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 gap-6">
        {prompts.map((prompt) => {
          const promptKey = getPromptKey(prompt.key);
          const metadata = PROMPT_METADATA[promptKey];

          return (
            <Card key={prompt.key}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle>{metadata?.title || promptKey}</CardTitle>
                    {metadata && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm">
                            <div className="space-y-2">
                              <p className="font-medium">{metadata.description}</p>
                              {metadata.placeholders.length > 0 && (
                                <div>
                                  <p className="text-xs text-muted-foreground">Placeholders:</p>
                                  <p className="text-xs">{metadata.placeholders.join(', ')}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-xs text-muted-foreground">Used in:</p>
                                <p className="text-xs">{metadata.usedIn.join(', ')}</p>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
                <CardDescription>{prompt.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor={prompt.key}>Prompt Template</Label>
                  <Textarea
                    id={prompt.key}
                    value={values[prompt.key] || ''}
                    onChange={(e) => handleChange(prompt.key, e.target.value)}
                    className="min-h-[200px] font-mono text-sm"
                    placeholder="Enter prompt template..."
                  />
                  {metadata?.placeholders.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Available placeholders: {metadata.placeholders.join(', ')}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="flex items-center gap-4">
        <Button onClick={handleSave} disabled={isSaving || isResetting}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={isSaving || isResetting}
        >
          {isResetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset to Defaults
        </Button>
      </div>
    </div>
  );
}
