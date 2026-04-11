import { AuthError } from "@supabase/supabase-js";

import { Database } from "../types/database";
import { missingSupabaseEnvMessage, supabase } from "./supabase";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type PersonRow = Database["public"]["Tables"]["persons"]["Row"];
type InteractionRow = Database["public"]["Tables"]["interactions"]["Row"];

type GuestSnapshot = {
  events: EventRow[];
  persons: PersonRow[];
  interactions: InteractionRow[];
};

const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;
const AUTH_DOMAIN = "blackbook.local";

function assertClient() {
  if (!supabase) {
    throw new Error(missingSupabaseEnvMessage);
  }

  return supabase;
}

function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

function usernameToEmail(username: string) {
  return `${normalizeUsername(username)}@${AUTH_DOMAIN}`;
}

function normalizeAuthError(error: AuthError | Error) {
  const message = error.message.toLowerCase();

  if (message.includes("invalid login")) {
    return "Invalid username or password.";
  }

  if (message.includes("password")) {
    return "Password must be at least 6 characters.";
  }

  if (message.includes("already") || message.includes("exists")) {
    return "Can't use that username because it's already used.";
  }

  return error.message;
}

export function validateUsername(username: string) {
  const normalized = normalizeUsername(username);

  if (!USERNAME_REGEX.test(normalized)) {
    throw new Error("Username must be 3-24 characters and use only lowercase letters, numbers, or _.");
  }

  return normalized;
}

async function readGuestSnapshot(userId: string): Promise<GuestSnapshot> {
  const client = assertClient();

  const [{ data: events, error: eventsError }, { data: persons, error: personsError }, { data: interactions, error: interactionsError }] =
    await Promise.all([
      client.from("events").select("*").eq("user_id", userId),
      client.from("persons").select("*").eq("user_id", userId),
      client.from("interactions").select("*").eq("user_id", userId),
    ]);

  if (eventsError || personsError || interactionsError) {
    throw new Error(eventsError?.message || personsError?.message || interactionsError?.message || "Failed to read guest data.");
  }

  return {
    events: events || [],
    persons: persons || [],
    interactions: interactions || [],
  };
}

async function importGuestSnapshot(targetUserId: string, snapshot: GuestSnapshot) {
  const client = assertClient();
  const eventIdMap = new Map<string, string>();
  const personIdMap = new Map<string, string>();

  for (const event of snapshot.events) {
    const { data, error } = await client
      .from("events")
      .insert({
        user_id: targetUserId,
        name: event.name,
        category: event.category,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      throw new Error(error?.message || "Failed to import events.");
    }

    eventIdMap.set(event.id, data.id);
  }

  for (const person of snapshot.persons) {
    const { data, error } = await client
      .from("persons")
      .insert({
        user_id: targetUserId,
        name: person.name,
        company: person.company,
        is_vip: person.is_vip,
        linkedin_url: person.linkedin_url,
        phone_number: person.phone_number,
        photo_url: person.photo_url,
        priority: person.priority,
        tags: person.tags,
      })
      .select("id")
      .single();

    if (error || !data?.id) {
      throw new Error(error?.message || "Failed to import contacts.");
    }

    personIdMap.set(person.id, data.id);
  }

  for (const interaction of snapshot.interactions) {
    const mappedPersonId = personIdMap.get(interaction.person_id);
    if (!mappedPersonId) {
      continue;
    }

    const mappedEventId = interaction.event_id ? eventIdMap.get(interaction.event_id) || null : null;
    const { error } = await client.from("interactions").insert({
      user_id: targetUserId,
      person_id: mappedPersonId,
      event_id: mappedEventId,
      raw_note: interaction.raw_note,
    });

    if (error) {
      throw new Error(error.message);
    }
  }
}

export async function signInAsGuest() {
  const client = assertClient();
  const { error } = await client.auth.signInAnonymously();

  if (error) {
    throw new Error(normalizeAuthError(error));
  }
}

export async function isUsernameAvailable(username: string) {
  const client = assertClient();
  const normalized = validateUsername(username);

  const { data, error } = await client
    .from("profiles")
    .select("user_id")
    .ilike("username", normalized)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return !data;
}

export async function signUpWithUsername(input: {
  username: string;
  password: string;
  guestUserId?: string | null;
  importGuestData?: boolean;
}) {
  const client = assertClient();
  const username = validateUsername(input.username);

  if (input.password.trim().length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const available = await isUsernameAvailable(username);
  if (!available) {
    throw new Error("Can't use that username because it's already used.");
  }

  const shouldImport = Boolean(input.importGuestData && input.guestUserId);
  const snapshot = shouldImport && input.guestUserId ? await readGuestSnapshot(input.guestUserId) : null;

  await client.auth.signOut();

  const email = usernameToEmail(username);
  const { error: signUpError } = await client.auth.signUp({
    email,
    password: input.password,
  });

  if (signUpError) {
    throw new Error(normalizeAuthError(signUpError));
  }

  const { data: signInData, error: signInError } = await client.auth.signInWithPassword({
    email,
    password: input.password,
  });

  if (signInError || !signInData.user?.id) {
    throw new Error(normalizeAuthError(signInError || new Error("Unable to complete sign in.")));
  }

  const userId = signInData.user.id;
  const { error: profileError } = await client.from("profiles").insert({ user_id: userId, username });

  if (profileError) {
    throw new Error(normalizeAuthError(profileError));
  }

  if (snapshot) {
    await importGuestSnapshot(userId, snapshot);
  }
}

export async function signInWithUsername(username: string, password: string) {
  const client = assertClient();
  const normalized = validateUsername(username);
  const email = usernameToEmail(normalized);

  await client.auth.signOut();

  const { error } = await client.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw new Error(normalizeAuthError(error));
  }
}

export async function signOutCurrentUser() {
  const client = assertClient();
  const { error } = await client.auth.signOut();
  if (error) {
    throw new Error(error.message);
  }
}

export async function getCurrentUsername(userId: string) {
  const client = assertClient();
  const { data, error } = await client
    .from("profiles")
    .select("username")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.username || null;
}