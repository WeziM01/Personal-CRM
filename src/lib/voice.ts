import { missingSupabaseEnvMessage, supabase } from "./supabase";

export type VoiceTranscriptionResult = {
  transcript: string;
  draft: {
    whatMatters?: string;
    name?: string;
    company?: string;
    event?: string;
    nextStep?: string;
  };
};

type TranscribeAudioInput = {
  uri: string;
  mimeType?: string;
  fileName?: string;
};

export async function transcribeContactAudio({
  uri,
  mimeType = "audio/m4a",
  fileName = "contact-note.m4a",
}: TranscribeAudioInput): Promise<VoiceTranscriptionResult> {
  if (!supabase) {
    throw new Error(missingSupabaseEnvMessage);
  }

  const formData = new FormData();
  formData.append(
    "file",
    {
      uri,
      name: fileName,
      type: mimeType,
    } as any
  );

  const { data, error } = await supabase.functions.invoke("transcribe-contact-route", {
    body: formData,
  });

  if (error) {
    throw new Error(error.message || "Voice transcription failed.");
  }

  return {
    transcript: data?.transcript || "",
    draft: data?.draft || {},
  };
}