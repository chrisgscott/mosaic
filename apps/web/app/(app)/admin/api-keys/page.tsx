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
import { ApiKeysTable } from "./api-keys-table";
import { CreateApiKeyButton } from "./create-api-key-button";

export default async function ApiKeysPage() {
  await requireAdmin();

  const supabase = await createClient();

  // Fetch all API keys (without the actual key, just metadata)
  const { data: apiKeys } = await supabase
    .from("api_keys")
    .select("id, name, key_prefix, tenant_id, created_at, last_used_at, is_active, description")
    .order("created_at", { ascending: false });

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/admin/settings/general">Settings</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>API Keys</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className="flex-1 space-y-4 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">API Keys</h1>
            <p className="text-muted-foreground mt-2">
              Manage API keys for external applications. Each key is scoped to a tenant for data isolation.
            </p>
          </div>
          <CreateApiKeyButton />
        </div>

        <ApiKeysTable apiKeys={apiKeys || []} />
      </div>
    </>
  );
}
