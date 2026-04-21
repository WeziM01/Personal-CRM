const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiApiKey) {
    return json({ error: "Missing OPENAI_API_KEY secret" }, 500);
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return json({ error: "Expected a File under form key 'file'" }, 400);
    }

    const prompt =
      "This is a short voice note captured after meeting someone at an event. " +
      "Transcribe clearly, preserving names, company names, events, and promises or next steps if spoken.";

    const openAiForm = new FormData();
    openAiForm.append("file", file, file.name || "audio.webm");
    openAiForm.append("model", "gpt-4o-mini-transcribe");
    openAiForm.append("response_format", "json");
    openAiForm.append("prompt", prompt);

    const transcriptionRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: openAiForm,
    });

    const transcriptionText = await transcriptionRes.text();

    if (!transcriptionRes.ok) {
      return json(
        {
          error: "OpenAI transcription failed",
          details: transcriptionText,
        },
        500
      );
    }

    const transcriptionJson = JSON.parse(transcriptionText);
    const transcript =
      transcriptionJson.text ||
      transcriptionJson.transcript ||
      "";

    // Keep v1 simple: return transcript + a starter draft.
    // We'll wire smarter field extraction next.
    return json({
      transcript,
      draft: {
        whatMatters: transcript,
      },
    });
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500
    );
  }
});