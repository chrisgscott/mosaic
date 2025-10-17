import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { EntityDetailsClient } from "@/components/entity-details-client";

async function getEntityDetails(entityId: string, userId: string) {
  const supabase = await createClient();

  // Get entity
  const { data: entity, error: entityError } = await supabase
    .from("entities")
    .select("*")
    .eq("id", entityId)
    .eq("user_id", userId)
    .single();

  if (entityError || !entity) {
    return null;
  }

  // Get outgoing relationships
  const { data: outgoingRels } = await supabase
    .from("relationships")
    .select(`
      *,
      target:entities!relationships_target_entity_id_fkey(id, name, type)
    `)
    .eq("source_entity_id", entityId)
    .eq("user_id", userId);

  // Get incoming relationships
  const { data: incomingRels } = await supabase
    .from("relationships")
    .select(`
      *,
      source:entities!relationships_source_entity_id_fkey(id, name, type)
    `)
    .eq("target_entity_id", entityId)
    .eq("user_id", userId);

  // Get related documents
  const { data: documents } = await supabase
    .from("documents")
    .select("id, file_name, created_at")
    .in("id", entity.document_ids || []);

  // Get related chunks with content
  const { data: chunks } = await supabase
    .from("chunks")
    .select("id, content, document_id, chunk_index")
    .in("id", entity.chunk_ids || [])
    .order("document_id")
    .order("chunk_index");

  return {
    entity,
    outgoingRelationships: outgoingRels || [],
    incomingRelationships: incomingRels || [],
    documents: documents || [],
    chunks: chunks || [],
  };
}

export default async function EntityDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  const userId = data.claims.sub;
  const { id } = await params;
  const entityDetails = await getEntityDetails(id, userId);

  if (!entityDetails) {
    notFound();
  }

  // Get all unique entity types for the dropdown
  const { data: allEntities } = await supabase
    .from("entities")
    .select("type")
    .eq("user_id", userId);

  const allEntityTypes = Array.from(
    new Set(allEntities?.map((e) => e.type) || [])
  ).sort();

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/graph">Knowledge Graph</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{entityDetails.entity.name}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className="flex-1 space-y-4 p-4">
        <EntityDetailsClient {...entityDetails} allEntityTypes={allEntityTypes} />
      </div>
    </>
  );
}
