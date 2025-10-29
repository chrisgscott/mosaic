"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EntityList } from "./entity-list";
import { Button } from "./ui/button";
import { Sparkles, Network } from "lucide-react";
import type { Entity } from "@/app/(app)/admin/graph/actions";

export function GraphPageClient({
  initialEntities,
  allEntityTypes,
}: {
  initialEntities: Entity[];
  allEntityTypes: string[];
}) {
  const router = useRouter();
  const [entities, setEntities] = useState<Entity[]>(initialEntities);

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex justify-end gap-2">
        <Button
          variant="outline"
          onClick={() => router.push("/graph/relationships")}
          className="gap-2"
        >
          <Network className="h-4 w-4" />
          View Relationships
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/graph/cleanup")}
          className="gap-2"
        >
          <Sparkles className="h-4 w-4" />
          Clean Up Graph
        </Button>
      </div>

      <EntityList
        entities={entities}
        onEntitiesChange={setEntities}
        allEntityTypes={allEntityTypes}
      />
    </div>
  );
}
