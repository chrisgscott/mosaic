import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role key for admin access
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("Starting document processing worker...");

    // Pop a message from the queue
    const { data: messages, error: queueError } = await supabase
      .schema("pgmq_public")
      .rpc("pop", {
        queue_name: "document_processing",
      });

    if (queueError) {
      console.error("Queue error:", queueError);
      throw queueError;
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ message: "No documents to process" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const message = messages[0];
    const { document_id, user_id, file_path, file_name, file_type } =
      message.message;

    console.log(`Processing document: ${document_id} - ${file_name}`);

    // Update document status to processing
    const { error: updateError } = await supabase
      .from("documents")
      .update({
        status: "processing",
        updated_at: new Date().toISOString(),
      })
      .eq("id", document_id);

    if (updateError) {
      console.error("Failed to update document status:", updateError);
      throw updateError;
    }

    // TODO: This is where we'll add:
    // 1. Download file from storage
    // 2. Extract text (Docling/Unstructured)
    // 3. Chunk text
    // 4. Generate embeddings
    // 5. Extract entities/relationships
    // For now, we'll just simulate processing

    console.log("Simulating document processing...");
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Simulate 2s processing

    // Update document status to ready
    const { error: completeError } = await supabase
      .from("documents")
      .update({
        status: "ready",
        updated_at: new Date().toISOString(),
      })
      .eq("id", document_id);

    if (completeError) {
      console.error("Failed to mark document as ready:", completeError);
      throw completeError;
    }

    // Archive the message (mark as processed)
    await supabase.schema("pgmq_public").rpc("archive", {
      queue_name: "document_processing",
      msg_id: message.msg_id,
    });

    console.log(`Successfully processed document: ${document_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        document_id,
        file_name,
        status: "ready",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error processing document:", error);

    return new Response(
      JSON.stringify({
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
