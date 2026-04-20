import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";

import { completeAuthRedirect } from "../lib/auth";
import { supabase } from "../lib/supabase";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      if (!supabase) {
        if (isMounted) {
          setLoading(false);
        }
        return;
      }

      const redirectResult = await completeAuthRedirect();
      if (isMounted && redirectResult.error) {
        setAuthError(redirectResult.error);
      }

      const { data } = await supabase.auth.getSession();
      if (isMounted) {
        setSession(data.session);
        setLoading(false);
      }
    }

    void bootstrap();

    if (!supabase) {
      return () => {
        isMounted = false;
      };
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (isMounted) {
        setSession(nextSession);
        setAuthError(null);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return {
    session,
    user: session?.user ?? null,
    isLoading,
    authError,
    clearAuthError: () => setAuthError(null),
  };
}