import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getDocuments } from "./actions";
import { DocumentsPageClient } from "@/components/documents-page-client";
import { requireAdmin } from "@/lib/auth/admin-check";

export default async function DocumentsPage() {
  // Check admin access
  await requireAdmin();

  // Fetch documents
  const { documents = [] } = await getDocuments();

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>Documents</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className="flex-1 space-y-4 p-4">
        <DocumentsPageClient initialDocuments={documents} />
      </div>
    </>
  );
}
