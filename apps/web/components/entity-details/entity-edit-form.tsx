"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface EntityEditFormProps {
  name: string;
  type: string;
  description: string;
  aliases: string;
  allEntityTypes: string[];
  onNameChange: (value: string) => void;
  onTypeChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onAliasesChange: (value: string) => void;
}

export function EntityEditForm({
  name,
  type,
  description,
  aliases,
  allEntityTypes,
  onNameChange,
  onTypeChange,
  onDescriptionChange,
  onAliasesChange,
}: EntityEditFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit Entity</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="Entity name"
          />
        </div>
        <div>
          <Label htmlFor="type">Type</Label>
          <Select value={type} onValueChange={onTypeChange}>
            <SelectTrigger id="type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allEntityTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Entity description"
            rows={4}
          />
        </div>
        <div>
          <Label htmlFor="aliases">Aliases</Label>
          <Input
            id="aliases"
            value={aliases}
            onChange={(e) => onAliasesChange(e.target.value)}
            placeholder="Alternative names, separated by commas"
          />
        </div>
      </CardContent>
    </Card>
  );
}
