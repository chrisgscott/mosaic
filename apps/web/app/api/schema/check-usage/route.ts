import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const category = searchParams.get("category");

  if (!type || !category) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    let count = 0;

    if (category === "entity") {
      const { count: entityCount, error } = await supabase
        .from("entities")
        .select("*", { count: "exact", head: true })
        .eq("type", type);

      if (error) throw error;
      count = entityCount || 0;
    } else if (category === "relationship") {
      const { count: relCount, error } = await supabase
        .from("relationships")
        .select("*", { count: "exact", head: true })
        .eq("relationship_type", type);

      if (error) throw error;
      count = relCount || 0;
    }

    return NextResponse.json({ count });
  } catch (error) {
    console.error("Error checking usage:", error);
    return NextResponse.json(
      { error: "Failed to check usage" },
      { status: 500 }
    );
  }
}
