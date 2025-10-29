"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { ArrowRight, Edit2, Trash2, Search, Save, X } from "lucide-react";
import { toast } from "sonner";
import {
  deleteRelationship,
  updateRelationship,
  type Relationship,
} from "@/app/(app)/admin/graph/actions";

export function RelationshipsPageClient({
  initialRelationships,
  relationshipTypes,
}: {
  initialRelationships: Relationship[];
  relationshipTypes: string[];
}) {
  const router = useRouter();
  const [relationships, setRelationships] = useState(initialRelationships);
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editType, setEditType] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Filter relationships
  const filteredRelationships = relationships.filter((rel) => {
    const matchesSearch =
      searchQuery === "" ||
      rel.relationship_type.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rel.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rel.source?.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      rel.target?.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesType = typeFilter === "all" || rel.relationship_type === typeFilter;

    return matchesSearch && matchesType;
  });

  const handleEdit = (rel: Relationship) => {
    setEditingId(rel.id);
    setEditType(rel.relationship_type);
    setEditDesc(rel.description || "");
  };

  const handleSave = async (relationshipId: string) => {
    const result = await updateRelationship(relationshipId, {
      relationship_type: editType,
      description: editDesc || null,
    });

    if (result.error) {
      toast.error("Failed to update relationship");
      return;
    }

    toast.success("Relationship updated");
    setEditingId(null);
    router.refresh();
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditType("");
    setEditDesc("");
  };

  const handleDelete = async (relationshipId: string, relType: string) => {
    const confirmed = window.confirm(
      `Delete relationship "${relType}"? This cannot be undone.`
    );

    if (!confirmed) return;

    const result = await deleteRelationship(relationshipId);

    if (result.error) {
      toast.error("Failed to delete relationship");
      return;
    }

    toast.success("Relationship deleted");
    setRelationships(relationships.filter((r) => r.id !== relationshipId));
  };

  const getConfidenceBadge = (confidence: number | null) => {
    if (confidence === null) {
      return <Badge variant="outline">Manual</Badge>;
    }
    if (confidence >= 0.85) {
      return <Badge className="bg-green-600">High</Badge>;
    }
    if (confidence >= 0.7) {
      return <Badge className="bg-yellow-600">Medium</Badge>;
    }
    return <Badge className="bg-red-600">Low</Badge>;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Relationships</CardTitle>
          <CardDescription>
            Manage connections between entities in your knowledge graph
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search relationships..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {relationshipTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Results count */}
          <div className="text-sm text-muted-foreground">
            Showing {filteredRelationships.length} of {relationships.length} relationships
          </div>

          {/* Relationships table */}
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Relationship</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRelationships.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No relationships found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRelationships.map((rel) => (
                    <TableRow key={rel.id}>
                      {editingId === rel.id ? (
                        <>
                          <TableCell colSpan={6}>
                            <div className="flex flex-col gap-2">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => router.push(`/graph/${rel.source?.id}`)}
                                  className="text-sm hover:underline"
                                >
                                  {rel.source?.name}
                                </button>
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                <Input
                                  value={editType}
                                  onChange={(e) => setEditType(e.target.value)}
                                  placeholder="Relationship type"
                                  className="max-w-[200px]"
                                />
                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                <button
                                  onClick={() => router.push(`/graph/${rel.target?.id}`)}
                                  className="text-sm hover:underline"
                                >
                                  {rel.target?.name}
                                </button>
                              </div>
                              <Input
                                value={editDesc}
                                onChange={(e) => setEditDesc(e.target.value)}
                                placeholder="Description (optional)"
                              />
                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => handleSave(rel.id)}>
                                  <Save className="h-3 w-3 mr-1" />
                                  Save
                                </Button>
                                <Button size="sm" variant="outline" onClick={handleCancel}>
                                  <X className="h-3 w-3 mr-1" />
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          </TableCell>
                        </>
                      ) : (
                        <>
                          <TableCell>
                            <button
                              onClick={() => router.push(`/graph/${rel.source?.id}`)}
                              className="hover:underline"
                            >
                              {rel.source?.name}
                            </button>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">{rel.relationship_type}</Badge>
                          </TableCell>
                          <TableCell>
                            <button
                              onClick={() => router.push(`/graph/${rel.target?.id}`)}
                              className="hover:underline"
                            >
                              {rel.target?.name}
                            </button>
                          </TableCell>
                          <TableCell className="max-w-[300px] truncate">
                            {rel.description || (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>{getConfidenceBadge(rel.extraction_confidence)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(rel)}
                                className="h-8 w-8 p-0"
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(rel.id, rel.relationship_type)}
                                className="h-8 w-8 p-0 text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
