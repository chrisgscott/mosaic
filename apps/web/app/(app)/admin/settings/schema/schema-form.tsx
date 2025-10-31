"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Edit2, Save, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

type EntityType = {
  name: string;
  description: string;
};

type RelationshipType = {
  name: string;
  description: string;
  direction: string;
};

type SchemaSettings = {
  entityTypes: string; // JSON string
  relationshipTypes: string; // JSON string
  enforceWhitelist: string; // "true" or "false"
  logUnknownTypes: string; // "true" or "false"
};

export function SchemaForm({ settings }: { settings: SchemaSettings }) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [entityTypes, setEntityTypes] = useState<EntityType[]>(
    JSON.parse(settings.entityTypes || "[]")
  );
  const [relationshipTypes, setRelationshipTypes] = useState<RelationshipType[]>(
    JSON.parse(settings.relationshipTypes || "[]")
  );
  const [enforceWhitelist, setEnforceWhitelist] = useState(
    settings.enforceWhitelist === "true"
  );
  const [logUnknownTypes, setLogUnknownTypes] = useState(
    settings.logUnknownTypes === "true"
  );

  // Editing states
  const [editingEntity, setEditingEntity] = useState<number | null>(null);
  const [editingRelationship, setEditingRelationship] = useState<number | null>(null);
  const [newEntity, setNewEntity] = useState<EntityType>({ name: "", description: "" });
  const [newRelationship, setNewRelationship] = useState<RelationshipType>({
    name: "",
    description: "",
    direction: "",
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          settings: {
            "schema.entityTypes": JSON.stringify(entityTypes, null, 2),
            "schema.relationshipTypes": JSON.stringify(relationshipTypes, null, 2),
            "schema.enforceWhitelist": enforceWhitelist.toString(),
            "schema.logUnknownTypes": logUnknownTypes.toString(),
          },
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to save settings");
      }

      toast.success("Schema settings saved successfully");
      router.refresh();
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSaving(false);
    }
  };

  const addEntityType = () => {
    if (newEntity.name && newEntity.description) {
      setEntityTypes([...entityTypes, { ...newEntity }]);
      setNewEntity({ name: "", description: "" });
    }
  };

  const addRelationshipType = () => {
    if (newRelationship.name && newRelationship.description) {
      setRelationshipTypes([...relationshipTypes, { ...newRelationship }]);
      setNewRelationship({ name: "", description: "", direction: "" });
    }
  };

  const updateEntityType = (index: number, field: keyof EntityType, value: string) => {
    const updated = [...entityTypes];
    updated[index] = { ...updated[index], [field]: value };
    setEntityTypes(updated);
  };

  const updateRelationshipType = (
    index: number,
    field: keyof RelationshipType,
    value: string
  ) => {
    const updated = [...relationshipTypes];
    updated[index] = { ...updated[index], [field]: value };
    setRelationshipTypes(updated);
  };

  const deleteEntityType = (index: number) => {
    setEntityTypes(entityTypes.filter((_, i) => i !== index));
  };

  const deleteRelationshipType = (index: number) => {
    setRelationshipTypes(relationshipTypes.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Extraction Settings</CardTitle>
          <CardDescription>
            Control how strictly the schema is enforced during graph extraction
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enforce-whitelist">Enforce Whitelist</Label>
              <p className="text-sm text-muted-foreground">
                Only allow whitelisted types during extraction
              </p>
            </div>
            <Switch
              id="enforce-whitelist"
              checked={enforceWhitelist}
              onCheckedChange={setEnforceWhitelist}
            />
          </div>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="log-unknown">Log Unknown Types</Label>
              <p className="text-sm text-muted-foreground">
                Record types not in whitelist for review
              </p>
            </div>
            <Switch
              id="log-unknown"
              checked={logUnknownTypes}
              onCheckedChange={setLogUnknownTypes}
            />
          </div>
        </CardContent>
      </Card>

      {/* Entity Types */}
      <Card>
        <CardHeader>
          <CardTitle>Entity Types</CardTitle>
          <CardDescription>
            Define the allowed entity types that can be extracted from documents
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {entityTypes.map((entity, index) => (
              <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                {editingEntity === index ? (
                  <div className="flex-1 grid grid-cols-2 gap-2">
                    <Input
                      value={entity.name}
                      onChange={(e) => updateEntityType(index, "name", e.target.value)}
                      placeholder="Type name"
                    />
                    <Input
                      value={entity.description}
                      onChange={(e) => updateEntityType(index, "description", e.target.value)}
                      placeholder="Description"
                    />
                  </div>
                ) : (
                  <div className="flex-1">
                    <Badge variant="secondary" className="mr-2">
                      {entity.name}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {entity.description}
                    </span>
                  </div>
                )}
                <div className="flex gap-1">
                  {editingEntity === index ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingEntity(null)}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingEntity(index)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteEntityType(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          {/* Add new entity type */}
          <div className="flex items-center gap-2 p-3 border-2 border-dashed rounded-lg">
            <div className="flex-1 grid grid-cols-2 gap-2">
              <Input
                value={newEntity.name}
                onChange={(e) => setNewEntity({ ...newEntity, name: e.target.value })}
                placeholder="New entity type name"
              />
              <Input
                value={newEntity.description}
                onChange={(e) => setNewEntity({ ...newEntity, description: e.target.value })}
                placeholder="Description"
              />
            </div>
            <Button
              size="sm"
              onClick={addEntityType}
              disabled={!newEntity.name || !newEntity.description}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Relationship Types */}
      <Card>
        <CardHeader>
          <CardTitle>Relationship Types</CardTitle>
          <CardDescription>
            Define the allowed relationship types with their typical direction
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {relationshipTypes.map((rel, index) => (
              <div key={index} className="flex items-center gap-2 p-3 border rounded-lg">
                {editingRelationship === index ? (
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <Input
                      value={rel.name}
                      onChange={(e) => updateRelationshipType(index, "name", e.target.value)}
                      placeholder="Relationship name"
                    />
                    <Input
                      value={rel.description}
                      onChange={(e) => updateRelationshipType(index, "description", e.target.value)}
                      placeholder="Description"
                    />
                    <Input
                      value={rel.direction}
                      onChange={(e) => updateRelationshipType(index, "direction", e.target.value)}
                      placeholder="Direction (e.g., Person → Organization)"
                    />
                  </div>
                ) : (
                  <div className="flex-1">
                    <Badge variant="secondary" className="mr-2">
                      {rel.name}
                    </Badge>
                    <span className="text-sm text-muted-foreground mr-2">
                      {rel.description}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {rel.direction}
                    </Badge>
                  </div>
                )}
                <div className="flex gap-1">
                  {editingRelationship === index ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingRelationship(null)}
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingRelationship(index)}
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => deleteRelationshipType(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          {/* Add new relationship type */}
          <div className="flex items-center gap-2 p-3 border-2 border-dashed rounded-lg">
            <div className="flex-1 grid grid-cols-3 gap-2">
              <Input
                value={newRelationship.name}
                onChange={(e) => setNewRelationship({ ...newRelationship, name: e.target.value })}
                placeholder="New relationship type"
              />
              <Input
                value={newRelationship.description}
                onChange={(e) => setNewRelationship({ ...newRelationship, description: e.target.value })}
                placeholder="Description"
              />
              <Input
                value={newRelationship.direction}
                onChange={(e) => setNewRelationship({ ...newRelationship, direction: e.target.value })}
                placeholder="Direction (e.g., Person → Organization)"
              />
            </div>
            <Button
              size="sm"
              onClick={addRelationshipType}
              disabled={!newRelationship.name || !newRelationship.description}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Schema Settings
        </Button>
      </div>
    </div>
  );
}
