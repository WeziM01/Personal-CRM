import { Alert, Platform } from "react-native";
import * as Calendar from "expo-calendar"; // if you prefer dynamic import you can change this

export type CalendarFollowUpInput = {
  name: string;
  company?: string | null;
  nextFollowUpAt: string;      // e.g. "2026-05-01"
  whatMatters?: string | null;
  nextStep?: string | null;
  linkedinUrl?: string | null;
};

/**
 * "2026-05-01" -> Date(2026, 4, 1, 10:00)
 * (adjust time to whatever default makes sense for you)
 */
function parseFollowUpDate(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split("-").map(v => Number(v));

  if (!year || !month || !day) {
    throw new Error("The saved follow-up date is invalid.");
  }

  // month - 1 because JS months are 0-based
  return new Date(year, month - 1, day, 10, 0, 0, 0);
}

function toGoogleCalendarDate(date: Date): string {
  // 20260501T100000Z style — remove punctuation
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function buildTitle(input: CalendarFollowUpInput): string {
  const companySuffix =
    input.company && input.company.trim().length > 0
      ? ` (${input.company.trim()})`
      : "";

  return `Follow up with ${input.name}${companySuffix} – Blackbook`;
}

function buildNotes(input: CalendarFollowUpInput): string {
  const lines = [
    input.whatMatters?.trim()
      ? `Context: ${input.whatMatters.trim()}`
      : null,
    input.nextStep?.trim()
      ? `Next step: ${input.nextStep.trim()}`
      : null,
    input.linkedinUrl?.trim()
      ? `LinkedIn: ${input.linkedinUrl.trim()}`
      : null,
  ].filter(Boolean) as string[];

  return lines.join("\n\n");
}

function buildGoogleCalendarUrl(input: CalendarFollowUpInput): string {
  const start = parseFollowUpDate(input.nextFollowUpAt);
  const end = new Date(start.getTime() + 15 * 60 * 1000); // 15 minutes

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: buildTitle(input),
    dates: `${toGoogleCalendarDate(start)}/${toGoogleCalendarDate(end)}`,
    details: buildNotes(input),
  });

  if (input.linkedinUrl?.trim()) {
    params.set("location", input.linkedinUrl.trim());
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Native-only: make sure we have calendar permission before creating an event.
 * Expo recommends checking + requesting via their permission helpers.[web:104][web:114]
 */
async function ensureCalendarPermission(): Promise<boolean> {
  const { status } = await Calendar.getCalendarPermissionsAsync();

  if (status === "granted") return true;

  const { status: newStatus } =
    await Calendar.requestCalendarPermissionsAsync();

  if (newStatus !== "granted") {
    Alert.alert(
      "Calendar access needed",
      "To add follow-ups to your calendar, enable calendar permissions in Settings."
    );
    return false;
  }

  return true;
}

export async function openFollowUpInCalendar(
  input: CalendarFollowUpInput
): Promise<void> {
  if (!input.nextFollowUpAt?.trim()) {
    throw new Error("No follow-up date is set yet.");
  }

  // WEB / PWA: open Google Calendar in a **new tab** so your app tab stays alive.
  if (Platform.OS === "web") {
    const url = buildGoogleCalendarUrl(input);

    if (typeof window !== "undefined") {
      window.open(url, "_blank", "noopener,noreferrer");
    }

    return;
  }

  // NATIVE (iOS / Android): create an event via expo-calendar
  const ok = await ensureCalendarPermission();
  if (!ok) return;

  const startDate = parseFollowUpDate(input.nextFollowUpAt);
  const endDate = new Date(startDate.getTime() + 15 * 60 * 1000);

  await Calendar.createEventAsync(
    // pick a default calendar or let the OS choose
    // you can use Calendar.getDefaultCalendarAsync() if you want to be explicit
    (await Calendar.getDefaultCalendarAsync()).id,
    {
      title: buildTitle(input),
      startDate,
      endDate,
      notes: buildNotes(input),
      location: input.linkedinUrl?.trim() || undefined,
    }
  );
}