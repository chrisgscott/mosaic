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
import { createClient } from "@/lib/supabase/server";
import { SchemaForm } from "./schema-form";

export default async function SchemaSettingsPage() {
  // Check admin access
  await requireAdmin();

  const supabase = await createClient();

  // Fetch schema settings
  const { data: settings, error } = await supabase
    .from("system_settings")
    .select("*")
    .eq("category", "schema")
    .order("key");

  if (error) {
    console.error("Error fetching schema settings:", error);
  }

  // Convert to key-value object and stringify JSONB values
  const settingsObj = settings?.reduce((acc, setting) => {
    const key = setting.key.replace('schema.', '');
    // JSONB values come as objects, stringify them for the form
    // Boolean values come as booleans, convert to strings
    if (typeof setting.value === 'boolean') {
      acc[key] = setting.value.toString();
    } else if (typeof setting.value === 'object') {
      acc[key] = JSON.stringify(setting.value);
    } else {
      acc[key] = setting.value;
    }
    return acc;
  }, {} as Record<string, string>) || {};

  return (
    <>
      <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/settings/general">Settings</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>Schema</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className="flex-1 space-y-4 p-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schema Settings</h1>
          <p className="text-muted-foreground mt-2">
            Manage allowed entity and relationship types for knowledge graph extraction. 
            Changes take effect immediately for new document processing.
          </p>
        </div>
        <SchemaForm settings={settingsObj} />
      </div>
    </>
  );
}
