import { requireAdmin } from "@/lib/auth/admin-check";
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
import { getEntities } from "../actions";

export default async function GraphCleanupPage() {
  // Check admin access
  await requireAdmin();

  const { entities } = await getEntities();
  
  // Get unique entity types
  const entityTypes = entities 
    ? Array.from(new Set(entities.map((e) => e.type))).sort()
    : [];

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
        <CleanupGraphPage allEntityTypes={entityTypes} />
      </div>
    </>
  );
}
