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
import { PromptsForm } from "./prompts-form";

export default async function PromptsSettingsPage() {
  // Check admin access
  await requireAdmin();

  // Check admin access
  await requireAdmin();

  const supabase = await createClient();

  // Fetch all prompt settings
  const { data: prompts, error } = await supabase
    .from("system_settings")
    .select("*")
    .eq("category", "prompts")
    .order("key");

  if (error) {
    console.error("Error fetching prompt settings:", error);
  }

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
              <BreadcrumbPage>Prompts</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className="flex-1 space-y-4 p-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Prompt Settings</h1>
          <p className="text-muted-foreground mt-2">
            Customize the system prompts used throughout the application. Changes take effect immediately.
          </p>
        </div>
        <PromptsForm prompts={prompts || []} />
      </div>
    </>
  );
}
