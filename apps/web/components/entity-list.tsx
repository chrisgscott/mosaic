"use client";

import { Network, Trash2, MoreHorizontal, Loader2, FileText, ArrowUpDown, GitMerge, Tag, Link } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { deleteEntity, bulkUpdateEntityType, type Entity } from "@/app/(app)/graph/actions";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { MergeEntitiesDialog } from "@/components/merge-entities-dialog";
import { BulkAddRelationshipsDialog } from "@/components/bulk-add-relationships-dialog";

type SortColumn = "created_at" | "name" | "confidence" | "docs" | "type" | "relationships";
type SortDirection = "asc" | "desc";

const capitalizeFirst = (str: string) => {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

const getQualityIndicator = (entity: Entity) => {
  const confidence = entity.extraction_confidence || 0;
  const docCount = entity.document_ids?.length || 0;

  if (confidence >= 0.85 && docCount > 1) {
    return { label: "High", color: "bg-green-500" };
  } else if (confidence >= 0.7 || docCount === 1) {
    return { label: "Medium", color: "bg-yellow-500" };
  } else {
    return { label: "Low", color: "bg-red-500" };
  }
};

export function EntityList({
  entities: externalEntities,
  onEntitiesChange,
  allEntityTypes = [],
}: {
  entities: Entity[];
  onEntitiesChange?: (updater: (prev: Entity[]) => Entity[]) => void;
  allEntityTypes?: string[];
}) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [internalEntities, setInternalEntities] = useState<Entity[]>(externalEntities);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [showRelationshipsDialog, setShowRelationshipsDialog] = useState(false);
  const [isUpdatingType, setIsUpdatingType] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("");

  // Use external or internal entities
  const entities = onEntitiesChange ? externalEntities : internalEntities;
  const setEntities = onEntitiesChange || setInternalEntities;

  // Filter and sort entities
  const filteredAndSortedEntities = useMemo(() => {
    let filtered = entities;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (entity) =>
          entity.name.toLowerCase().includes(query) ||
          entity.description?.toLowerCase().includes(query) ||
          entity.type.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      let comparison = 0;
      
      switch (sortColumn) {
        case "created_at":
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "type":
          comparison = a.type.localeCompare(b.type);
          break;
        case "confidence":
          comparison = (a.extraction_confidence || 0) - (b.extraction_confidence || 0);
          break;
        case "docs":
          comparison = (a.document_ids?.length || 0) - (b.document_ids?.length || 0);
          break;
        case "relationships":
          comparison = (a.relationship_count || 0) - (b.relationship_count || 0);
          break;
      }
      
      return sortDirection === "asc" ? comparison : -comparison;
    });

    return sorted;
  }, [entities, searchQuery, sortColumn, sortDirection]);

  // Subscribe to real-time entity updates
  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("entities-changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "entities",
        },
        (payload) => {
          console.log("Entity updated:", payload);
          const newEntity = payload.new as Entity;

          if (onEntitiesChange) {
            onEntitiesChange((current) =>
              current.map((entity) => (entity.id === newEntity.id ? newEntity : entity))
            );
          } else {
            setInternalEntities((current) =>
              current.map((entity) => (entity.id === newEntity.id ? newEntity : entity))
            );
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "entities",
        },
        (payload) => {
          console.log("Entity inserted:", payload);
          const newEntity = payload.new as Entity;

          if (onEntitiesChange) {
            onEntitiesChange((current) => [newEntity, ...current]);
          } else {
            setInternalEntities((current) => [newEntity, ...current]);
          }
          toast.success(`New entity extracted: ${newEntity.name}`);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "entities",
        },
        (payload) => {
          console.log("Entity deleted:", payload);
          if (onEntitiesChange) {
            onEntitiesChange((current) => current.filter((entity) => entity.id !== payload.old.id));
          } else {
            setInternalEntities((current) => current.filter((entity) => entity.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update local state when external entities change
  useEffect(() => {
    if (!onEntitiesChange) {
      setInternalEntities(externalEntities);
    }
  }, [externalEntities, onEntitiesChange]);

  const handleDelete = async (id: string) => {
    setDeletingId(id);

    const result = await deleteEntity(id);

    if (result.error) {
      toast.error("Failed to delete entity");
      setDeletingId(null);
      return;
    }

    toast.success("Entity deleted");
    setDeletingId(null);

    // Update local state
    setEntities((current) => current.filter((entity) => entity.id !== id));

    // Refresh server data
    router.refresh();
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete ${selectedIds.size} entit${selectedIds.size > 1 ? "ies" : "y"}?`
    );

    if (!confirmed) return;

    setIsDeleting(true);

    const deletePromises = Array.from(selectedIds).map((id) => deleteEntity(id));
    const results = await Promise.allSettled(deletePromises);

    const successful = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    if (failed === 0) {
      toast.success(`Deleted ${successful} entit${successful > 1 ? "ies" : "y"}`);
    } else {
      toast.error(`Failed to delete ${failed} entit${failed > 1 ? "ies" : "y"}`);
    }

    // Update local state
    setEntities((current) => current.filter((entity) => !selectedIds.has(entity.id)));
    setSelectedIds(new Set());
    setIsDeleting(false);
    router.refresh();
  };

  const handleBulkUpdateType = async () => {
    if (selectedIds.size === 0 || !selectedType) return;

    setIsUpdatingType(true);

    const result = await bulkUpdateEntityType(Array.from(selectedIds), selectedType);

    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`Updated ${result.count} entit${result.count! > 1 ? "ies" : "y"} to type "${capitalizeFirst(selectedType)}"`);
      setSelectedIds(new Set());
      setSelectedType("");
      router.refresh();
    }

    setIsUpdatingType(false);
  };

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedEntities.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedEntities.map((entity) => entity.id)));
    }
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      // Toggle direction if clicking same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New column, default to ascending (or descending for dates)
      setSortColumn(column);
      setSortDirection(column === "created_at" ? "desc" : "asc");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (entities.length === 0) {
    return (
      <div className="rounded-lg border bg-card">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Knowledge Graph</h2>
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Network className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No entities yet</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-sm">
              Upload and process documents to automatically extract entities and relationships.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Knowledge Graph</h2>
          {selectedIds.size > 0 && (
            <div className="flex gap-2 items-center">
              {/* Bulk Type Update */}
              <div className="flex gap-2 items-center">
                <Select value={selectedType} onValueChange={setSelectedType}>
                  <SelectTrigger className="w-[180px] h-9">
                    <SelectValue placeholder="Change type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allEntityTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {capitalizeFirst(type)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkUpdateType}
                  disabled={!selectedType || isUpdatingType}
                >
                  {isUpdatingType ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Tag className="mr-2 h-4 w-4" />
                      Update Type
                    </>
                  )}
                </Button>
              </div>

              {/* Add Relationships Button */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRelationshipsDialog(true)}
              >
                <Link className="mr-2 h-4 w-4" />
                Add Relationships
              </Button>

              {/* Merge Button */}
              {selectedIds.size >= 2 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowMergeDialog(true)}
                >
                  <GitMerge className="mr-2 h-4 w-4" />
                  Merge {selectedIds.size}
                </Button>
              )}

              {/* Delete Button */}
              <Button
                variant="destructive"
                size="sm"
                onClick={handleBulkDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete {selectedIds.size}
                  </>
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Filters and Search */}
        <div className="flex gap-4 mb-4">
          <Input
            placeholder="Search entities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Results count */}
        <p className="text-sm text-muted-foreground mb-4">
          Showing {filteredAndSortedEntities.length} of {entities.length} entities
        </p>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">
                <Checkbox
                  checked={
                    filteredAndSortedEntities.length > 0 &&
                    selectedIds.size === filteredAndSortedEntities.length
                  }
                  onCheckedChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead className="w-[50px]">Quality</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort("name")}
                >
                  Name
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort("type")}
                >
                  Type
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="w-[100px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort("docs")}
                >
                  Documents
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="w-[120px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort("confidence")}
                >
                  Confidence
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="w-[120px]">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort("relationships")}
                >
                  Relationships
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-3 h-8 data-[state=open]:bg-accent"
                  onClick={() => handleSort("created_at")}
                >
                  Created
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="w-[70px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedEntities.map((entity) => {
              const quality = getQualityIndicator(entity);
              return (
                <TableRow key={entity.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(entity.id)}
                      onCheckedChange={() => toggleSelection(entity.id)}
                      aria-label={`Select ${entity.name}`}
                    />
                  </TableCell>
                  <TableCell>
                    <div 
                      title={`${quality.label} quality`} 
                      className={`w-3 h-3 rounded-full ${quality.color}`}
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => router.push(`/graph/${entity.id}`)}
                      className="flex items-center gap-2 hover:underline text-left w-full"
                    >
                      <span className="font-medium">{entity.name.charAt(0).toUpperCase() + entity.name.slice(1)}</span>
                    </button>
                    {entity.description && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        {entity.description}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{capitalizeFirst(entity.type)}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center gap-1">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <span className="text-sm">{entity.document_ids?.length || 0}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {entity.extraction_confidence ? (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-secondary rounded-full h-2">
                          <div
                            className="bg-primary rounded-full h-2"
                            style={{ width: `${entity.extraction_confidence * 100}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(entity.extraction_confidence * 100)}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">N/A</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm font-medium">{entity.relationship_count || 0}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatDate(entity.created_at)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={deletingId === entity.id}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => router.push(`/graph/${entity.id}`)}>
                          <Network className="mr-2 h-4 w-4" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => handleDelete(entity.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Merge Dialog */}
      <MergeEntitiesDialog
        open={showMergeDialog}
        onOpenChange={setShowMergeDialog}
        entities={entities.filter((e) => selectedIds.has(e.id))}
        allEntityTypes={allEntityTypes}
        onMergeComplete={() => {
          setSelectedIds(new Set());
          router.refresh();
        }}
      />

      {/* Bulk Add Relationships Dialog */}
      <BulkAddRelationshipsDialog
        open={showRelationshipsDialog}
        onOpenChange={setShowRelationshipsDialog}
        sourceEntities={entities.filter((e) => selectedIds.has(e.id))}
        allEntities={entities}
        onComplete={() => {
          setSelectedIds(new Set());
          router.refresh();
        }}
      />
    </div>
  );
}
