import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/admin-check";
import { createClient } from "@/lib/supabase/server";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getEntities } from "./actions";
import { GraphPageClient } from "@/components/graph-page-client";

export default async function GraphPage() {
  // Check admin access
  await requireAdmin();

  const supabase = await createClient();

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }

  // Fetch entities
  const { entities = [] } = await getEntities();

  // Get entity types from schema settings
  const { data: schemaSettings } = await supabase
    .from("system_settings")
    .select("value")
    .eq("key", "schema.entityTypes")
    .single();

  const allEntityTypes = schemaSettings?.value
    ? (schemaSettings.value as Array<{ name: string; description: string }>).map(t => t.name)
    : [];

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Knowledge Graph</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className="flex-1 space-y-4 p-4">
        <GraphPageClient initialEntities={entities} allEntityTypes={allEntityTypes} />
      </div>
    </>
  );
}
