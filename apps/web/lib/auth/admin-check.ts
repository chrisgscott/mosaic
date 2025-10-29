import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Check if the current user is an admin
 * Redirects to home page if not authenticated or not an admin
 */
export async function requireAdmin() {
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    redirect("/auth/login");
  }

  // Check admin status
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    redirect("/");
  }

  return { user, profile };
}
