import { Linking, Platform } from "react-native";

export type CalendarFollowUpInput = {
  name: string;
  company?: string | null;
  nextFollowUpAt: string;
  whatMatters?: string | null;
  nextStep?: string | null;
  linkedinUrl?: string | null;
};

function parseFollowUpDate(dateOnly: string) {
  const [year, month, day] = dateOnly.split("-").map((value) => Number(value));
  if (!year || !month || !day) {
    throw new Error("The saved follow-up date is invalid.");
  }

  return new Date(year, month - 1, day, 10, 0, 0, 0);
}

function toGoogleCalendarDate(date: Date) {
  return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function buildTitle(input: CalendarFollowUpInput) {
  const companySuffix = input.company?.trim() ? ` (${input.company.trim()})` : "";
  return `Follow up with ${input.name}${companySuffix} — Blackbook`;
}

function buildNotes(input: CalendarFollowUpInput) {
  const lines = [
    input.whatMatters?.trim() ? `Context: ${input.whatMatters.trim()}` : null,
    input.nextStep?.trim() ? `Next step: ${input.nextStep.trim()}` : null,
    input.linkedinUrl?.trim() ? `LinkedIn: ${input.linkedinUrl.trim()}` : null,
  ].filter(Boolean);

  return lines.join("\n\n");
}

function buildGoogleCalendarUrl(input: CalendarFollowUpInput) {
  const start = parseFollowUpDate(input.nextFollowUpAt);
  const end = new Date(start.getTime() + 15 * 60 * 1000);

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

export async function openFollowUpInCalendar(input: CalendarFollowUpInput) {
  if (!input.nextFollowUpAt?.trim()) {
    throw new Error("No follow-up date is set yet.");
  }

  if (Platform.OS === "web") {
    const url = buildGoogleCalendarUrl(input);
    await Linking.openURL(url);
    return;
  }

  const Calendar = await import("expo-calendar");
  const startDate = parseFollowUpDate(input.nextFollowUpAt);
  const endDate = new Date(startDate.getTime() + 15 * 60 * 1000);

  await Calendar.createEventInCalendarAsync({
    title: buildTitle(input),
    startDate,
    endDate,
    notes: buildNotes(input),
    location: input.linkedinUrl?.trim() || undefined,
  });
}
