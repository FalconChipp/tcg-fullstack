import { useEffect, useState } from "react";
import { useRouter } from "next/router";

const GRAPHQL_URL = "https://backendtcg.sixbyfive.com/graphql";

/**
 * Custom hook to require admin authentication on dashboard pages.
 * - Checks for JWT in localStorage
 * - Queries `me` from backend and verifies `isAdmin === true`
 * - Redirects to login page if not authenticated or not an admin
 *
 * @param {Object} options - Config options
 * @param {string} options.redirectTo - Path to redirect if not authenticated/admin (default: /login)
 * @returns {Object} { user, loading, checked }
 */
export default function useAdminAuth({ redirectTo = "/login" } = {}) {
  const [user, setUser] = useState(null);
  const [checked, setChecked] = useState(false); // Has the auth check run at least once?
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function fetchMe() {
      const token = localStorage.getItem("tcg_admin_token");
      if (!token) {
        // No token present, not authenticated
        router.replace(redirectTo);
        return;
      }
      try {
        const res = await fetch(GRAPHQL_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
          },
          body: JSON.stringify({
            query: `
              query {
                me {
                  id
                  email
                  isAdmin  
                }
              }
            `,
          }),
        });
        const json = await res.json();
        const me = json.data?.me;

        // CHANGED: Only allow if isAdmin === true
        if (!me || me.isAdmin !== true) {
          localStorage.removeItem("tcg_admin_token");
          router.replace(redirectTo);
          return;
        }
        setUser(me);
      } catch (e) {
        // On error, clear token and redirect
        localStorage.removeItem("tcg_admin_token");
        router.replace(redirectTo);
      } finally {
        setChecked(true);
        setLoading(false);
      }
    }
    fetchMe();
    // Only run on mount
    // eslint-disable-next-line
  }, []);

  return { user, loading, checked };
}
