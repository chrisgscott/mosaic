import { redirect, notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin-check";
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
  const { data: documents, error: docsError } = await supabase
    .from("documents")
    .select("id, file_name, created_at")
    .in("id", entity.document_ids && entity.document_ids.length > 0 ? entity.document_ids : ['00000000-0000-0000-0000-000000000000']);

  if (docsError) {
    console.error('Error fetching documents:', docsError);
  }

  // Get related chunks with content
  // Try to get chunks by ID first, but if that fails or returns empty,
  // fall back to searching chunks from the entity's documents
  let chunks = null;
  let chunksError = null;
  
  if (entity.chunk_ids && entity.chunk_ids.length > 0) {
    const result = await supabase
      .from("chunks")
      .select("id, content, document_id, chunk_index")
      .in("id", entity.chunk_ids)
      .order("document_id")
      .order("chunk_index");
    
    chunks = result.data;
    chunksError = result.error;
  }
  
  // If no chunks found by ID, try to find chunks from the entity's documents
  // that might mention this entity
  if ((!chunks || chunks.length === 0) && entity.document_ids && entity.document_ids.length > 0) {
    const result = await supabase
      .from("chunks")
      .select("id, content, document_id, chunk_index")
      .in("document_id", entity.document_ids)
      .ilike("content", `%${entity.name}%`)
      .order("document_id")
      .order("chunk_index")
      .limit(10); // Limit to first 10 matches
    
    chunks = result.data;
    if (result.error) {
      console.error('Error fetching chunks by content search:', result.error);
    }
  }

  if (chunksError) {
    console.error('Error fetching chunks:', chunksError);
  }

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
  // Check admin access
  await requireAdmin();

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

  // Get entity types from schema settings
  const { data: schemaSettings } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "schema.entityTypes")
    .single();

  let allEntityTypes: string[] = [];
  if (schemaSettings?.value) {
    try {
      const types = typeof schemaSettings.value === 'string' 
        ? JSON.parse(schemaSettings.value)
        : schemaSettings.value;
      if (Array.isArray(types)) {
        allEntityTypes = types.map((t: { name: string }) => t.name);
      }
    } catch (error) {
      console.error('Error parsing entity types:', error);
    }
  }

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
