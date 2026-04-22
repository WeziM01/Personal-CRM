type LockedEventDraft = {
  name: string;
};

export type ScannedPersonDraft = {
  name?: string;
  company?: string;
  event?: string;
  linkedinUrl?: string;
  email?: string;
  phoneNumber?: string;
  whatMatters?: string;
};

function cleanValue(value: string) {
  return value.replace(/^[\s:,-]+|[\s:,-]+$/g, "").trim();
}

function titleCaseFromSlug(value: string) {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function parseVCard(text: string): ScannedPersonDraft {
  const normalized = text.replace(/\r/g, "");
  const find = (prefix: string) => {
    const match = normalized.match(new RegExp(`^${prefix}[:;](.+)$`, "im"));
    return match ? cleanValue(match[1]) : "";
  };

  const fullName = find("FN");
  const org = find("ORG");
  const email = find("EMAIL");
  const tel = find("TEL");
  const title = find("TITLE");

  return {
    name: fullName,
    company: org,
    email,
    phoneNumber: tel,
    whatMatters: title || "",
  };
}

function parseMeCard(text: string): ScannedPersonDraft {
  const body = text.replace(/^MECARD:/i, "");
  const parts = body.split(";").map((part) => part.trim()).filter(Boolean);
  const values = new Map<string, string>();

  for (const part of parts) {
    const [rawKey, ...rest] = part.split(":");
    if (!rawKey || rest.length === 0) continue;
    values.set(rawKey.toUpperCase(), cleanValue(rest.join(":")));
  }

  return {
    name: values.get("N") || "",
    company: values.get("ORG") || "",
    email: values.get("EMAIL") || "",
    phoneNumber: values.get("TEL") || "",
    whatMatters: values.get("NOTE") || "",
  };
}

export function parseScannedInput(rawValue: string, lockedEvent?: LockedEventDraft | null): ScannedPersonDraft {
  const raw = rawValue.trim();
  if (!raw) {
    return {};
  }

  if (/^BEGIN:VCARD/i.test(raw)) {
    return {
      ...parseVCard(raw),
      event: lockedEvent?.name || "",
      linkedinUrl: "",
    };
  }

  if (/^MECARD:/i.test(raw)) {
    return {
      ...parseMeCard(raw),
      event: lockedEvent?.name || "",
      linkedinUrl: "",
    };
  }

  const linkedinMatch = raw.match(/https?:\/\/(?:[\w-]+\.)?linkedin\.com\/[\S]+/i);
  const emailMatch = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const phoneMatch = raw.match(/(?:\+?\d[\d\s().-]{7,}\d)/);
  const lines = raw
    .split(/\r?\n/)
    .map((line) => cleanValue(line))
    .filter(Boolean);

  let name = "";
  let company = "";
  let linkedinUrl = linkedinMatch?.[0] || "";
  const email = emailMatch?.[0] || "";
  const phoneNumber = phoneMatch?.[0] || "";

  if (linkedinUrl) {
    const slugMatch = linkedinUrl.match(/linkedin\.com\/in\/([^/?#]+)/i);
    if (slugMatch) {
      name = titleCaseFromSlug(slugMatch[1]);
    }
  }

  if (!name && lines.length) {
    const candidate = lines[0];
    if (!candidate.includes("@") && !candidate.includes("http") && candidate.split(" ").length <= 4) {
      name = candidate;
    }
  }

  if (lines.length > 1) {
    const candidate = lines[1];
    if (!candidate.includes("@") && !candidate.includes("http") && candidate.length <= 60) {
      company = candidate;
    }
  }

  const textWithoutKnownBits = raw
    .replace(linkedinUrl, "")
    .replace(email, "")
    .replace(phoneNumber, "")
    .replace(name, "")
    .replace(company, "");

  const whatMatters = cleanValue(textWithoutKnownBits).slice(0, 220);

  return {
    name,
    company,
    event: lockedEvent?.name || "",
    linkedinUrl,
    email,
    phoneNumber,
    whatMatters,
  };
}
