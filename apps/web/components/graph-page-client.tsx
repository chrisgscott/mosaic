"use client";

import { useState } from "react";
import { EntityList } from "./entity-list";
import type { Entity } from "@/app/(app)/graph/actions";

export function GraphPageClient({ initialEntities }: { initialEntities: Entity[] }) {
  const [entities, setEntities] = useState<Entity[]>(initialEntities);

  return <EntityList entities={entities} onEntitiesChange={setEntities} />;
}
