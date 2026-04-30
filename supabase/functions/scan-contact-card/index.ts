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

type ExtractedDraft = {
  name?: string;
  company?: string;
  email?: string;
  phoneNumber?: string;
  linkedinUrl?: string;
  whatMatters?: string;
};

function cleanOptional(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function extractCardDraft(openaiApiKey: string, imageDataUrl: string): Promise<{ rawText: string; draft: ExtractedDraft }> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You extract structured contact fields from a photo of a business card, badge, or networking credential. " +
                "Only use information that is explicitly visible. Do not guess or hallucinate missing details. " +
                "If a value is missing or unclear, return null. " +
                "Put a short role, title, or memorable descriptor into whatMatters if present.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Extract the person's visible contact details. If there is LinkedIn, website, title, or org info, use it carefully. " +
                "Return structured output only.",
            },
            {
              type: "input_image",
              image_url: imageDataUrl,
            },
          ],
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "card_contact_draft",
          strict: true,
          schema: {
            type: "object",
            properties: {
              rawText: {
                type: ["string", "null"],
                description: "A concise plain-text transcription or summary of the visible card/badge text.",
              },
              name: {
                type: ["string", "null"],
                description: "The visible full name if present.",
              },
              company: {
                type: ["string", "null"],
                description: "The visible company or organization if present.",
              },
              email: {
                type: ["string", "null"],
                description: "The visible email address if present.",
              },
              phoneNumber: {
                type: ["string", "null"],
                description: "The visible phone number if present.",
              },
              linkedinUrl: {
                type: ["string", "null"],
                description: "A visible LinkedIn URL if present.",
              },
              whatMatters: {
                type: ["string", "null"],
                description: "A concise role, title, or memorable descriptor from the card/badge.",
              },
            },
            required: ["rawText", "name", "company", "email", "phoneNumber", "linkedinUrl", "whatMatters"],
            additionalProperties: false,
          },
        },
      },
    }),
  });

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(`OpenAI vision extraction failed: ${raw}`);
  }

  const payload = JSON.parse(raw);
  const outputText =
    payload.output_text ||
    payload.output?.find?.((item: any) => item.type === "message")?.content?.find?.((c: any) => c.type === "output_text")?.text ||
    "";

  if (!outputText) {
    throw new Error("OpenAI vision extraction returned no structured output.");
  }

  const parsed = JSON.parse(outputText);

  return {
    rawText: cleanOptional(parsed.rawText) || "",
    draft: {
      name: cleanOptional(parsed.name),
      company: cleanOptional(parsed.company),
      email: cleanOptional(parsed.email),
      phoneNumber: cleanOptional(parsed.phoneNumber),
      linkedinUrl: cleanOptional(parsed.linkedinUrl),
      whatMatters: cleanOptional(parsed.whatMatters),
    },
  };
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

    const mimeType = file.type || "image/jpeg";
    const bytes = new Uint8Array(await file.arrayBuffer());
    const base64 = bytesToBase64(bytes);
    const dataUrl = `data:${mimeType};base64,${base64}`;

    const result = await extractCardDraft(openaiApiKey, dataUrl);

    return json({
      rawText: result.rawText,
      draft: result.draft,
    });
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
      },
      500,
    );
  }
});
