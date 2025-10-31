import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const { category, fromType, toType } = await request.json();

    if (!category || !fromType || !toType) {
      return NextResponse.json(
        { error: "Missing parameters" },
        { status: 400 }
      );
    }

    let result;

    if (category === "entity") {
      result = await supabase
        .from("entities")
        .update({ type: toType })
        .eq("type", fromType);
    } else if (category === "relationship") {
      result = await supabase
        .from("relationships")
        .update({ relationship_type: toType })
        .eq("relationship_type", fromType);
    } else {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    if (result.error) throw result.error;

    return NextResponse.json({
      success: true,
      message: `Migrated ${category} types from "${fromType}" to "${toType}"`,
    });
  } catch (error) {
    console.error("Error migrating types:", error);
    return NextResponse.json(
      { error: "Failed to migrate types" },
      { status: 500 }
    );
  }
}
