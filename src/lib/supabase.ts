import { AppState, Platform } from "react-native";

import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock, SupabaseClient } from "@supabase/supabase-js";

import { Database } from "../types/database";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const configuredAuthRedirectUrl = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL;

function isValidHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getWindowOrigin() {
  if (typeof window === "undefined" || !window.location?.origin) {
    return null;
  }

  return window.location.origin;
}

export function getAuthRedirectUrl() {
  const candidate = configuredAuthRedirectUrl || getWindowOrigin();
  return candidate && isValidHttpUrl(candidate) ? candidate : null;
}

const authRedirectUrl = getAuthRedirectUrl();

const supabaseConfigError = !supabaseUrl
  ? "Missing EXPO_PUBLIC_SUPABASE_URL."
  : !isValidHttpUrl(supabaseUrl)
    ? "Invalid EXPO_PUBLIC_SUPABASE_URL. It must be a valid HTTP or HTTPS URL."
    : !supabaseAnonKey
      ? "Missing EXPO_PUBLIC_SUPABASE_ANON_KEY."
      : configuredAuthRedirectUrl && !isValidHttpUrl(configuredAuthRedirectUrl)
        ? "Invalid EXPO_PUBLIC_AUTH_REDIRECT_URL. It must be a valid HTTP or HTTPS URL."
        : null;

export const isSupabaseConfigured = supabaseConfigError === null;

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl as string, supabaseAnonKey as string, {
      auth: {
        ...(Platform.OS !== "web" ? { storage: AsyncStorage } : {}),
        flowType: "pkce",
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: Platform.OS === "web",
        lock: processLock,
      },
    })
  : null;

if (supabase && Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}

export const missingSupabaseEnvMessage =
  "Missing Supabase env vars. Set EXPO_PUBLIC_SUPABASE_URL plus EXPO_PUBLIC_SUPABASE_ANON_KEY.";

export const supabaseConfigMessage = supabaseConfigError
  ? `${missingSupabaseEnvMessage} ${supabaseConfigError}`
  : null;

export { authRedirectUrl };
