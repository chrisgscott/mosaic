import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chunkIds } = await request.json();

    if (!chunkIds || !Array.isArray(chunkIds) || chunkIds.length === 0) {
      return NextResponse.json(
        { error: "chunkIds array required" },
        { status: 400 }
      );
    }

    // Fetch chunks
    const { data: chunks, error: fetchError } = await supabase
      .from("chunks")
      .select("id, content, document_id")
      .in("id", chunkIds)
      .eq("user_id", user.id);

    if (fetchError) {
      console.error("Error fetching chunks:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch chunks" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      chunks: chunks || [],
    });
  } catch (error) {
    console.error("Chunks API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
