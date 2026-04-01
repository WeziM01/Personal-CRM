import { PostgrestError } from "@supabase/supabase-js";

import { supabase } from "./supabase";

type EventRow = {
  id: string;
  name: string;
};

type PersonRow = {
  id: string;
  name: string | null;
};

function assertNoError(error: PostgrestError | null) {
  if (error) {
    throw new Error(error.message);
  }
}

export async function ensureSessionUserId() {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user?.id) {
    return sessionData.session.user.id;
  }

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user?.id) {
    throw new Error(error?.message || "Unable to authenticate with Supabase.");
  }

  return data.user.id;
}

export async function getOrCreateEvent(userId: string, name: string) {
  const normalizedName = name.trim();

  const { data: existing, error: findError } = await supabase
    .from("events")
    .select("id,name")
    .eq("user_id", userId)
    .ilike("name", normalizedName)
    .maybeSingle();

  assertNoError(findError);
  if (existing) {
    return existing as EventRow;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("events")
    .insert({ user_id: userId, name: normalizedName })
    .select("id,name")
    .single();

  assertNoError(insertError);
  return inserted as EventRow;
}

export async function createPerson(userId: string, name: string) {
  const { data, error } = await supabase
    .from("persons")
    .insert({ user_id: userId, name: name.trim() || null })
    .select("id,name")
    .single();

  assertNoError(error);
  return data as PersonRow;
}

export async function createInteraction(input: {
  userId: string;
  personId: string;
  eventId?: string | null;
  rawNote: string;
}) {
  const { error } = await supabase.from("interactions").insert({
    user_id: input.userId,
    person_id: input.personId,
    event_id: input.eventId ?? null,
    raw_note: input.rawNote,
  });

  assertNoError(error);
}

export function buildInteractionNote(notes: string, followUp: string) {
  const base = notes.trim();
  const follow = followUp.trim();
  if (!follow || follow.toLowerCase() === "none yet") {
    return base;
  }

  return `${base}\nFollow up: ${follow}`;
}
