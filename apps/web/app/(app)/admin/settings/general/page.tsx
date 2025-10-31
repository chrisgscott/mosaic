import { redirect } from "next/navigation";
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
import { SettingsForm } from "./settings-form";

export default async function GeneralSettingsPage() {
  // Check admin access
  await requireAdmin();

  // Check admin access
  await requireAdmin();

  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/sign-in");
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/");
  }

  // Fetch current settings (exclude prompts and schema categories)
  const { data: settings } = await supabase
    .from("system_settings")
    .select("*")
    .not("category", "in", "(prompts,schema)")
    .order("category", { ascending: true })
    .order("key", { ascending: true });

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
              <BreadcrumbPage>General</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </header>
      <div className="flex-1 space-y-4 p-4">
        <div>
          <h1 className="text-3xl font-bold">General Settings</h1>
          <p className="text-muted-foreground mt-2">
            Configure system-wide settings. These settings affect all users. 
            <br />
            <span className="text-sm">
              See also: <a href="/admin/settings/prompts" className="text-blue-600 hover:underline">Prompts</a> | <a href="/admin/settings/schema" className="text-blue-600 hover:underline">Schema</a>
            </span>
          </p>
        </div>

        <SettingsForm settings={settings || []} />
      </div>
    </>
  );
}
