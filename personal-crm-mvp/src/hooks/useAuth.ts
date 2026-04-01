import { useEffect, useState } from "react";

import { Session } from "@supabase/supabase-js";

import { supabase } from "../lib/supabase";

export function useAuth() {
	const [session, setSession] = useState<Session | null>(null);
	const [isLoading, setLoading] = useState(true);

	useEffect(() => {
		supabase.auth.getSession().then(({ data }) => {
			setSession(data.session);
			setLoading(false);
		});

		const {
			data: { subscription },
		} = supabase.auth.onAuthStateChange((_event, nextSession) => {
			setSession(nextSession);
		});

		return () => {
			subscription.unsubscribe();
		};
	}, []);

	return {
		session,
		user: session?.user ?? null,
		isLoading,
	};
}

