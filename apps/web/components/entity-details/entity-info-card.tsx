"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

interface EntityInfoCardProps {
  description?: string;
  extractionConfidence: number;
  documentCount: number;
  chunkCount: number;
  createdAt: string;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function getQualityColor(confidence: number): string {
  if (confidence >= 0.8) return "text-green-500";
  if (confidence >= 0.5) return "text-yellow-500";
  return "text-red-500";
}

function getQualityLabel(confidence: number): string {
  if (confidence >= 0.8) return "High";
  if (confidence >= 0.5) return "Medium";
  return "Low";
}

export function EntityInfoCard({
  description,
  extractionConfidence,
  documentCount,
  chunkCount,
  createdAt,
}: EntityInfoCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Information</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {description && (
          <div>
            <Label className="text-muted-foreground">Description</Label>
            <p className="mt-1">{description}</p>
          </div>
        )}
        <div>
          <Label className="text-muted-foreground">Confidence</Label>
          <div className="mt-1 flex items-center gap-2">
            <div className="flex-1 bg-secondary rounded-full h-2">
              <div
                className={`${getQualityColor(extractionConfidence)} bg-current rounded-full h-2`}
                style={{ width: `${extractionConfidence * 100}%` }}
              />
            </div>
            <Badge variant="outline" className={getQualityColor(extractionConfidence)}>
              {getQualityLabel(extractionConfidence)}
            </Badge>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground">Documents</Label>
            <p className="mt-1 font-medium">{documentCount}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Chunks</Label>
            <p className="mt-1 font-medium">{chunkCount}</p>
          </div>
        </div>
        <div>
          <Label className="text-muted-foreground">Created</Label>
          <p className="mt-1">{formatDate(createdAt)}</p>
        </div>
      </CardContent>
    </Card>
  );
}
