import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./settings-form";

export default async function GeneralSettingsPage() {
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

  // Fetch current settings
  const { data: settings } = await supabase
    .from("system_settings")
    .select("*")
    .order("category", { ascending: true })
    .order("key", { ascending: true });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold">General Settings</h1>
        <p className="text-muted-foreground mt-2">
          Configure system-wide settings. These settings affect all users.
        </p>
      </div>

      <SettingsForm settings={settings || []} />
    </div>
  );
}
