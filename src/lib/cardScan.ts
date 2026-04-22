import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from "@supabase/supabase-js";
import { Platform } from "react-native";

import { missingSupabaseEnvMessage, supabase } from "./supabase";

export type CardScanResult = {
  rawText?: string;
  draft: {
    name?: string;
    company?: string;
    email?: string;
    phoneNumber?: string;
    linkedinUrl?: string;
    whatMatters?: string;
  };
};

type ScanCardImageInput = {
  uri: string;
  mimeType?: string;
  fileName?: string;
};

function extensionFromMimeType(mimeType: string) {
  if (mimeType.includes("png")) return "png";
  if (mimeType.includes("webp")) return "webp";
  if (mimeType.includes("heic")) return "heic";
  if (mimeType.includes("heif")) return "heif";
  return "jpg";
}

export async function scanContactCardImage({
  uri,
  mimeType = "image/jpeg",
  fileName = "contact-card.jpg",
}: ScanCardImageInput): Promise<CardScanResult> {
  if (!supabase) {
    throw new Error(missingSupabaseEnvMessage);
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(sessionError.message || "Could not read auth session.");
  }

  if (!session?.access_token) {
    throw new Error("No active session found. Please sign in again, then retry card scan.");
  }

  const formData = new FormData();

  if (Platform.OS === "web") {
    const response = await fetch(uri);
    if (!response.ok) {
      throw new Error("Could not read selected image.");
    }

    const blob = await response.blob();
    const actualMimeType = blob.type || mimeType || "image/jpeg";
    const actualFileName = `contact-card.${extensionFromMimeType(actualMimeType)}`;
    const file = new File([blob], actualFileName, { type: actualMimeType });
    formData.append("file", file);
  } else {
    formData.append(
      "file",
      {
        uri,
        name: fileName,
        type: mimeType,
      } as any,
    );
  }

  const { data, error } = await supabase.functions.invoke("scan-contact-card", {
    body: formData,
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (error instanceof FunctionsHttpError) {
    let details = "Function returned an HTTP error.";
    try {
      const body = await error.context.json();
      details = body?.details || body?.error || JSON.stringify(body);
    } catch {
      try {
        details = await error.context.text();
      } catch {
        details = error.message;
      }
    }
    throw new Error(details);
  }

  if (error instanceof FunctionsRelayError) {
    throw new Error(`Relay error: ${error.message}`);
  }

  if (error instanceof FunctionsFetchError) {
    throw new Error(`Fetch error: ${error.message}`);
  }

  if (error) {
    throw new Error(error.message || "Card scan failed.");
  }

  return {
    rawText: data?.rawText || "",
    draft: data?.draft || {},
  };
}
