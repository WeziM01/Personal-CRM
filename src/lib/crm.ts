import { PostgrestError } from "@supabase/supabase-js";

import { missingSupabaseEnvMessage, supabase } from "./supabase";

export type PersonRow = {
  company: string | null;
  id: string;
  is_vip: boolean;
  linkedin_url: string | null;
  name: string | null;
  phone_number: string | null;
  priority: PersonPriority;
  tags: string[];
  created_at: string;
};

export type EventRow = {
  category: EventCategory | null;
  id: string;
  name: string;
  created_at: string;
};

export type InteractionRow = {
  id: string;
  raw_note: string;
  created_at: string;
  person_id: string;
  event_id: string | null;
  persons?: { name: string | null; company?: string | null } | null;
  events?: { name: string; category?: EventCategory | null } | null;
};

export type EventCategory =
  | "networking"
  | "conference"
  | "coffee"
  | "zoom"
  | "investor"
  | "social"
  | "workshop"
  | "community"
  | "other";

export type PersonPriority = "high" | "medium" | "low";

export type PersonInsight = {
  id: string;
  name: string;
  priority: PersonPriority;
  company: string;
  linkedinUrl: string;
  phoneNumber: string;
  tags: string[];
  createdAt: string;
  interactionCount: number;
  lastInteractionId: string | null;
  lastInteractionAt: string | null;
  lastInteractionNote: string;
  lastEventName: string | null;
  lastEventCategory: EventCategory;
  followUp: string;
  daysSinceLastContact: number | null;
  statusLabel: string;
  bannerLabel: string;
};

export type EventInsight = {
  id: string;
  name: string;
  createdAt: string;
  category: EventCategory;
  interactionCount: number;
  peopleCount: number;
  lastInteractionAt: string | null;
  lastConnectedLabel: string;
  featuredPeople: string[];
};

// Demo toggle: set to false to return to day-based reminder timing.
export const FAST_REMINDER_DEMO_MODE = true;
export const STALE_CONTACT_THRESHOLD = FAST_REMINDER_DEMO_MODE ? 45 : 14;
export const RECENT_CONTACT_THRESHOLD = FAST_REMINDER_DEMO_MODE ? 20 : 7;
export const JUST_CONNECTED_THRESHOLD = FAST_REMINDER_DEMO_MODE ? 10 : 0;
export const HIGH_PRIORITY_STALE_THRESHOLD = JUST_CONNECTED_THRESHOLD;

export const PERSON_TAG_SUGGESTIONS = [
  "investor",
  "founder",
  "corporate",
  "charity",
  "operator",
  "advisor",
  "creator",
  "community",
] as const;

export const EVENT_CATEGORY_OPTIONS: Array<{ label: string; value: EventCategory | "all" }> = [
  { label: "All", value: "all" },
  { label: "🤝 Networking", value: "networking" },
  { label: "🎤 Conference", value: "conference" },
  { label: "☕ Coffee", value: "coffee" },
  { label: "💻 Zoom", value: "zoom" },
  { label: "🍻 Drinks", value: "social" },
  { label: "Investor", value: "investor" },
  { label: "Workshop", value: "workshop" },
  { label: "Community", value: "community" },
  { label: "Other", value: "other" },
];

const eventCategoryMatchers: Array<{ category: EventCategory; patterns: RegExp[] }> = [
  {
    category: "networking",
    patterns: [/network/i, /mixer/i, /meetup/i, /founder/i, /operator/i],
  },
  {
    category: "conference",
    patterns: [/conference/i, /summit/i, /expo/i, /forum/i, /congress/i],
  },
  {
    category: "coffee",
    patterns: [/coffee/i, /breakfast/i, /lunch/i, /brunch/i, /tea/i],
  },
  {
    category: "zoom",
    patterns: [/zoom/i, /meet/i, /virtual/i, /video call/i, /remote/i],
  },
  {
    category: "investor",
    patterns: [/investor/i, /fund/i, /vc/i, /pitch/i, /demo day/i],
  },
  {
    category: "workshop",
    patterns: [/workshop/i, /masterclass/i, /bootcamp/i, /training/i],
  },
  {
    category: "community",
    patterns: [/community/i, /alumni/i, /guild/i, /club/i],
  },
  {
    category: "social",
    patterns: [/dinner/i, /drinks/i, /party/i, /social/i, /hangout/i],
  },
];

function assertClient() {
  if (!supabase) {
    throw new Error(missingSupabaseEnvMessage);
  }

  return supabase;
}

function assertNoError(error: PostgrestError | null) {
  if (error) {
    throw new Error(error.message);
  }
}

export function normalizePriority(priority?: string | null, isVip?: boolean) {
  if (priority === "high" || priority === "medium" || priority === "low") {
    return priority;
  }

  return isVip ? "high" : "medium";
}

export function normalizeTags(tags?: string[] | null) {
  if (!tags?.length) {
    return [];
  }

  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
    )
  );
}

export async function ensureSessionUserId() {
  const client = assertClient();

  const { data: sessionData } = await client.auth.getSession();
  if (sessionData.session?.user?.id) {
    return sessionData.session.user.id;
  }

  const { data, error } = await client.auth.signInAnonymously();
  if (error || !data.user?.id) {
    throw new Error(error?.message || "Unable to authenticate with Supabase.");
  }

  return data.user.id;
}

export async function getOrCreateEvent(userId: string, name: string, category?: EventCategory | null) {
  const client = assertClient();
  const normalizedName = name.trim();
  const normalizedCategory = category || inferEventCategory(normalizedName, "");

  const { data: existing, error: findError } = await client
    .from("events")
    .select("id,name,category,created_at")
    .eq("user_id", userId)
    .ilike("name", normalizedName)
    .maybeSingle();

  assertNoError(findError);
  if (existing) {
    if (normalizedCategory && existing.category !== normalizedCategory) {
      const { data: updated, error: updateError } = await client
        .from("events")
        .update({ category: normalizedCategory })
        .eq("user_id", userId)
        .eq("id", existing.id)
        .select("id,name,category,created_at")
        .single();

      assertNoError(updateError);
      return updated as EventRow;
    }

    return existing as EventRow;
  }

  const { data: inserted, error: insertError } = await client
    .from("events")
    .insert({ user_id: userId, name: normalizedName, category: normalizedCategory })
    .select("id,name,category,created_at")
    .single();

  assertNoError(insertError);
  return inserted as EventRow;
}

export async function createPerson(
  userId: string,
  name: string,
  company?: string,
  linkedinUrl?: string,
  phoneNumber?: string,
  priority: PersonPriority = "medium",
  tags: string[] = []
) {
  const client = assertClient();
  const normalizedTags = normalizeTags(tags);

  const { data, error } = await client
    .from("persons")
    .insert({
      user_id: userId,
      name: name.trim() || null,
      company: company?.trim() || null,
      is_vip: priority === "high",
      linkedin_url: normalizeLinkedInUrl(linkedinUrl),
      phone_number: normalizePhoneNumber(phoneNumber),
      priority,
      tags: normalizedTags,
    })
    .select("id,name,company,is_vip,linkedin_url,phone_number,priority,tags,created_at")
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
  const client = assertClient();

  const { error } = await client.from("interactions").insert({
    user_id: input.userId,
    person_id: input.personId,
    event_id: input.eventId ?? null,
    raw_note: input.rawNote,
  });

  assertNoError(error);
}

export async function updatePersonDetails(input: {
  userId: string;
  personId: string;
  name: string;
  company?: string;
  linkedinUrl?: string;
  phoneNumber?: string;
  priority?: PersonPriority;
  tags?: string[];
}) {
  const client = assertClient();
  const normalizedPriority = input.priority || "medium";
  const normalizedTags = normalizeTags(input.tags);

  const { error } = await client
    .from("persons")
    .update({
      name: input.name.trim() || null,
      company: input.company?.trim() || null,
      is_vip: normalizedPriority === "high",
      linkedin_url: normalizeLinkedInUrl(input.linkedinUrl),
      phone_number: normalizePhoneNumber(input.phoneNumber),
      priority: normalizedPriority,
      tags: normalizedTags,
    })
    .eq("user_id", input.userId)
    .eq("id", input.personId);

  assertNoError(error);
}

export async function updateInteraction(input: {
  userId: string;
  interactionId: string;
  eventId?: string | null;
  rawNote: string;
}) {
  const client = assertClient();

  const { error } = await client
    .from("interactions")
    .update({
      event_id: input.eventId ?? null,
      raw_note: input.rawNote,
    })
    .eq("user_id", input.userId)
    .eq("id", input.interactionId);

  assertNoError(error);
}

export async function updateEventDetails(input: {
  userId: string;
  eventId: string;
  name: string;
  category?: EventCategory | null;
}) {
  const client = assertClient();
  const normalizedName = input.name.trim();

  if (!normalizedName) {
    throw new Error("Event name is required.");
  }

  const { error } = await client
    .from("events")
    .update({
      name: normalizedName,
      category: input.category || inferEventCategory(normalizedName, ""),
    })
    .eq("user_id", input.userId)
    .eq("id", input.eventId);

  assertNoError(error);
}

export async function deleteEvent(userId: string, eventId: string) {
  const client = assertClient();

  const { error } = await client
    .from("events")
    .delete()
    .eq("user_id", userId)
    .eq("id", eventId);

  assertNoError(error);
}

export async function deletePerson(userId: string, personId: string) {
  const client = assertClient();

  const { error } = await client
    .from("persons")
    .delete()
    .eq("user_id", userId)
    .eq("id", personId);

  assertNoError(error);
}

export async function markPersonContactedToday(userId: string, personId: string) {
  await createInteraction({
    userId,
    personId,
    rawNote: "Contacted today.",
  });
}

export async function listRecentPeople(userId: string, limit = 8) {
  const client = assertClient();

  const { data, error } = await client
    .from("persons")
    .select("id,name,company,is_vip,linkedin_url,phone_number,priority,tags,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  assertNoError(error);
  return (data || []) as PersonRow[];
}

export async function listRecentEvents(userId: string, limit = 5) {
  const client = assertClient();

  const { data, error } = await client
    .from("events")
    .select("id,name,category,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  assertNoError(error);
  return (data || []) as EventRow[];
}

export async function listRecentInteractions(userId: string, limit = 24) {
  const client = assertClient();

  const { data, error } = await client
    .from("interactions")
    .select(
      "id,raw_note,created_at,person_id,event_id,persons(name,company),events(name,category)"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  assertNoError(error);
  return (data || []) as InteractionRow[];
}

export async function listAllInteractions(userId: string, limit = 500) {
  return listRecentInteractions(userId, limit);
}

export async function listEventInteractions(userId: string, eventId: string) {
  const client = assertClient();

  const { data, error } = await client
    .from("interactions")
    .select("id,raw_note,created_at,person_id,event_id,persons(name,company),events(name,category)")
    .eq("user_id", userId)
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  assertNoError(error);
  return (data || []) as InteractionRow[];
}

export async function listPersonInteractions(userId: string, personId: string) {
  const client = assertClient();

  const { data, error } = await client
    .from("interactions")
    .select("id,raw_note,created_at,person_id,event_id,events(name,category)")
    .eq("user_id", userId)
    .eq("person_id", personId)
    .order("created_at", { ascending: false });

  assertNoError(error);
  return (data || []) as InteractionRow[];
}

export async function getFirstPerson(userId: string) {
  const client = assertClient();

  const { data, error } = await client
    .from("persons")
    .select("id,name,company,is_vip,linkedin_url,phone_number,priority,tags,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  assertNoError(error);
  return (data as PersonRow | null) || null;
}

export async function listPeopleInsights(userId: string) {
  const [people, interactions] = await Promise.all([
    listRecentPeople(userId, 200),
    listAllInteractions(userId, 500),
  ]);

  const interactionsByPerson = new Map<string, InteractionRow[]>();
  interactions.forEach((interaction) => {
    const current = interactionsByPerson.get(interaction.person_id) || [];
    current.push(interaction);
    interactionsByPerson.set(interaction.person_id, current);
  });

  return people.map((person) => {
    const personInteractions = interactionsByPerson.get(person.id) || [];
    const lastInteraction = personInteractions[0] || null;
    const daysSinceLastContact = lastInteraction
      ? getDaysSince(lastInteraction.created_at)
      : null;
    const priority = normalizePriority(person.priority, person.is_vip);
    const tags = normalizeTags(person.tags);

    return {
      id: person.id,
      name: person.name || "Unknown contact",
      priority,
      company: person.company || extractCompany(lastInteraction?.raw_note || ""),
      linkedinUrl: person.linkedin_url || "",
      phoneNumber: person.phone_number || "",
      tags,
      createdAt: person.created_at,
      interactionCount: personInteractions.length,
      lastInteractionId: lastInteraction?.id || null,
      lastInteractionAt: lastInteraction?.created_at || null,
      lastInteractionNote: extractPrimaryNote(lastInteraction?.raw_note || "") || "No interactions yet.",
      lastEventName: lastInteraction?.events?.name || null,
      lastEventCategory: inferEventCategory(
        lastInteraction?.events?.name,
        lastInteraction?.raw_note,
        lastInteraction?.events?.category || null
      ),
      followUp: extractFollowUp(lastInteraction?.raw_note || ""),
      daysSinceLastContact,
      statusLabel: buildContactStatus(daysSinceLastContact, priority),
      bannerLabel: buildContactBanner(daysSinceLastContact, priority),
    } as PersonInsight;
  });
}

export async function listEventInsights(userId: string) {
  const [events, interactions] = await Promise.all([
    listRecentEvents(userId, 100),
    listAllInteractions(userId, 500),
  ]);

  const interactionsByEvent = new Map<string, InteractionRow[]>();
  interactions.forEach((interaction) => {
    if (!interaction.event_id) {
      return;
    }

    const current = interactionsByEvent.get(interaction.event_id) || [];
    current.push(interaction);
    interactionsByEvent.set(interaction.event_id, current);
  });

  return events.map((event) => {
    const eventInteractions = interactionsByEvent.get(event.id) || [];
    const lastInteraction = eventInteractions[0] || null;
    const peopleNames = Array.from(
      new Set(
        eventInteractions
          .map((interaction) => interaction.persons?.name || "Unknown contact")
          .filter(Boolean)
      )
    );

    return {
      id: event.id,
      name: event.name,
      createdAt: event.created_at,
      category: inferEventCategory(event.name, lastInteraction?.raw_note, event.category),
      interactionCount: eventInteractions.length,
      peopleCount: peopleNames.length,
      lastInteractionAt: lastInteraction?.created_at || null,
      lastConnectedLabel: buildContactBanner(
        lastInteraction ? getDaysSince(lastInteraction.created_at) : null
      ),
      featuredPeople: peopleNames.slice(0, 3),
    } as EventInsight;
  });
}

export async function countInteractionsByEvent(userId: string, eventId: string) {
  const client = assertClient();

  const { count, error } = await client
    .from("interactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_id", eventId);

  assertNoError(error);
  return count || 0;
}

export function buildInteractionNote(notes: string, followUp: string) {
  const base = notes.trim();
  const hasFollowUp = followUp.trim() && followUp.trim().toLowerCase() !== "none yet";
  return hasFollowUp ? `${base}\nFollow up: ${followUp.trim()}` : base;
}

export function normalizeLinkedInUrl(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }

  if (trimmed.includes("linkedin.com")) {
    return `https://${trimmed.replace(/^\/+/, "")}`;
  }

  return `https://www.linkedin.com/in/${trimmed.replace(/^@/, "")}`;
}

export function normalizePhoneNumber(value?: string | null) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed;
}

export function toWhatsAppUrl(phoneNumber: string) {
  const digits = phoneNumber.replace(/[^\d+]/g, "").replace(/^00/, "+");
  const normalized = digits.startsWith("+") ? digits.slice(1) : digits;
  return normalized ? `https://wa.me/${normalized}` : null;
}

export function buildInteractionRecord(notes: string, followUp: string, company?: string) {
  const lines: string[] = [];

  if (notes.trim()) {
    lines.push(notes.trim());
  }

  if (followUp.trim() && followUp.trim().toLowerCase() !== "none yet") {
    lines.push(`Follow up: ${followUp.trim()}`);
  }

  return lines.join("\n");
}

export function extractCompany(rawNote: string) {
  const match = rawNote.match(/^Company:\s*(.+)$/im);
  return match?.[1]?.trim() || "";
}

export function extractPrimaryNote(rawNote: string) {
  return rawNote
    .replace(/^Company:\s*.+$/im, "")
    .replace(/^Follow up:\s*.+$/im, "")
    .trim();
}

export function extractFollowUp(rawNote: string) {
  const match = rawNote.match(/follow\s*up\s*[:.-]\s*(.+)$/im);
  if (!match?.[1]) {
    return "None yet";
  }

  return match[1].trim();
}

export function inferEventCategory(
  eventName?: string | null,
  rawNote?: string | null,
  explicitCategory?: EventCategory | string | null
) {
  if (explicitCategory && explicitCategory !== "all") {
    return explicitCategory as EventCategory;
  }

  const haystack = `${eventName || ""} ${rawNote || ""}`.trim();

  for (const matcher of eventCategoryMatchers) {
    if (matcher.patterns.some((pattern) => pattern.test(haystack))) {
      return matcher.category;
    }
  }

  return "other";
}

export function formatCategoryLabel(category: EventCategory) {
  if (category === "social") {
    return "Drinks";
  }

  if (category === "zoom") {
    return "Zoom";
  }

  if (category === "other") {
    return "Other";
  }

  return category.charAt(0).toUpperCase() + category.slice(1);
}

export function getDaysSince(value: string) {
  const diff = Date.now() - new Date(value).getTime();
  if (FAST_REMINDER_DEMO_MODE) {
    return Math.max(0, Math.floor(diff / 1000));
  }

  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

export function buildContactStatus(daysSinceLastContact: number | null, priority: PersonPriority = "medium") {
  if (daysSinceLastContact === null) {
    return "No contact yet";
  }

  if (priority === "low") {
    return "Low priority";
  }

  if (daysSinceLastContact <= JUST_CONNECTED_THRESHOLD) {
    return FAST_REMINDER_DEMO_MODE ? "Connected just now" : "Connected today";
  }

  if (daysSinceLastContact <= RECENT_CONTACT_THRESHOLD) {
    return priority === "high" ? "High priority" : "Recently connected";
  }

  if (!isContactStale(daysSinceLastContact, priority)) {
    return "Cooling";
  }

  return priority === "high" ? "Needs same-day follow-up" : "Needs follow-up";
}

export function buildContactBanner(daysSinceLastContact: number | null, priority: PersonPriority = "medium") {
  if (daysSinceLastContact === null) {
    return "No contact on record yet";
  }

  if (priority === "low") {
    return "Low priority: no nudge scheduled";
  }

  if (daysSinceLastContact <= JUST_CONNECTED_THRESHOLD) {
    return FAST_REMINDER_DEMO_MODE ? "Last connected just now" : "Last connected today";
  }

  if (FAST_REMINDER_DEMO_MODE) {
    if (daysSinceLastContact === 1) {
      return "Last connected 1 second ago";
    }

    if (isContactStale(daysSinceLastContact, priority)) {
      return priority === "high"
        ? `Same-day nudge: ${daysSinceLastContact}s since contact`
        : `Priority nudge: ${daysSinceLastContact}s since contact`;
    }

    return `Haven't connected in ${daysSinceLastContact} seconds`;
  }

  if (daysSinceLastContact === 1) {
    return "Last connected 1 day ago";
  }

  if (isContactStale(daysSinceLastContact, priority)) {
    return priority === "high"
      ? `Same-day nudge: ${daysSinceLastContact} days since contact`
      : `Priority nudge: ${daysSinceLastContact} days since contact`;
  }

  return `Haven't connected in ${daysSinceLastContact} days`;
}

export function getStaleThreshold(priority: PersonPriority) {
  if (priority === "high") {
    return HIGH_PRIORITY_STALE_THRESHOLD;
  }

  if (priority === "low") {
    return null;
  }

  return STALE_CONTACT_THRESHOLD;
}

export function isContactStale(daysSinceLastContact: number | null, priority: PersonPriority) {
  if (daysSinceLastContact === null) {
    return false;
  }

  const threshold = getStaleThreshold(priority);
  if (threshold === null) {
    return false;
  }

  return daysSinceLastContact >= threshold;
}

export function formatPriorityLabel(priority: PersonPriority) {
  if (priority === "high") {
    return "High priority";
  }

  if (priority === "low") {
    return "Low priority";
  }

  return "Medium priority";
}

export function buildReconnectDraft(input: {
  name: string;
  eventName?: string | null;
  lastInteractionNote?: string;
  followUp?: string;
}) {
  const event = input.eventName || "the event";
  const note = input.lastInteractionNote?.trim() || "our chat";
  const followUp = input.followUp?.trim() && input.followUp.trim().toLowerCase() !== "none yet"
    ? input.followUp.trim()
    : "catch up properly";

  return `Hey ${input.name}, great meeting you at ${event}. Picking up from ${note}. Wanted to follow up on ${followUp}.`;
}

export function formatDateTime(value: string) {
  const date = new Date(value);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
