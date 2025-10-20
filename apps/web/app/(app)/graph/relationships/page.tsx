import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getRelationships } from "../actions";
import { RelationshipsPageClient } from "@/components/relationships-page-client";

export default async function RelationshipsPage() {
  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  // Fetch all relationships
  const { relationships = [] } = await getRelationships();

  // Get unique relationship types for filtering
  const relationshipTypes = Array.from(
    new Set(relationships.map((r) => r.relationship_type))
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
              <BreadcrumbPage>Relationships</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className="flex-1 space-y-4 p-4">
        <RelationshipsPageClient
          initialRelationships={relationships}
          relationshipTypes={relationshipTypes}
        />
      </div>
    </>
  );
}
