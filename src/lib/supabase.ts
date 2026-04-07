import "react-native-url-polyfill/auto";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { Database } from "../types/database";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function isValidHttpUrl(value: string) {
	try {
		const url = new URL(value);
		return url.protocol === "http:" || url.protocol === "https:";
	} catch {
		return false;
	}
}

const supabaseConfigError = !supabaseUrl
	? "Missing EXPO_PUBLIC_SUPABASE_URL."
	: !isValidHttpUrl(supabaseUrl)
		? "Invalid EXPO_PUBLIC_SUPABASE_URL. It must be a valid HTTP or HTTPS URL."
		: !supabaseAnonKey
			? "Missing EXPO_PUBLIC_SUPABASE_ANON_KEY."
			: null;

export const isSupabaseConfigured = supabaseConfigError === null;

export const supabase: SupabaseClient<Database> | null = isSupabaseConfigured
	? createClient<Database>(supabaseUrl as string, supabaseAnonKey as string, {
			auth: {
				persistSession: true,
				autoRefreshToken: true,
				detectSessionInUrl: false,
			},
		})
	: null;

export const missingSupabaseEnvMessage =
	"Missing Supabase env vars. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.";

export const supabaseConfigMessage = supabaseConfigError
	? `${missingSupabaseEnvMessage} ${supabaseConfigError}`
	: null;

