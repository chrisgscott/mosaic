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
import { CleanupGraphPage } from "@/components/cleanup-graph-page";

export default async function GraphCleanupPage() {
  // Check admin access
  await requireAdmin();

  const supabase = await createClient();

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
              <BreadcrumbLink href="/admin/graph">Knowledge Graph</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Clean Up Duplicates</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className="flex-1 space-y-4 p-4">
        <CleanupGraphPage allEntityTypes={allEntityTypes} />
      </div>
    </>
  );
}
