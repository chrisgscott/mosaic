"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EntityList } from "./entity-list";
import { CleanupGraphDialog } from "./cleanup-graph-dialog";
import { Button } from "./ui/button";
import { Sparkles } from "lucide-react";
import type { Entity } from "@/app/(app)/graph/actions";

export function GraphPageClient({
  initialEntities,
  allEntityTypes,
}: {
  initialEntities: Entity[];
  allEntityTypes: string[];
}) {
  const router = useRouter();
  const [entities, setEntities] = useState<Entity[]>(initialEntities);
  const [showCleanupDialog, setShowCleanupDialog] = useState(false);

  return (
    <div className="space-y-4">
      {/* Clean Up Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => setShowCleanupDialog(true)}
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

      <CleanupGraphDialog
        open={showCleanupDialog}
        onOpenChange={setShowCleanupDialog}
        allEntityTypes={allEntityTypes}
        onCleanupComplete={() => {
          setShowCleanupDialog(false);
          router.refresh();
        }}
      />
    </div>
  );
}
