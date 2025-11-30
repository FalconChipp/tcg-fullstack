// frontend/src/hooks/useCurrentUser.js

"use client";

import { useQuery } from "@apollo/client";
import { CURRENT_USER_QUERY } from "@/graphql/currentUser";

export function useCurrentUser(options = {}) {
  const {
    data,
    loading,
    error,
    refetch,
    networkStatus,
  } = useQuery(CURRENT_USER_QUERY, {
    fetchPolicy: "cache-first",
    notifyOnNetworkStatusChange: true,
    ...options,
  });

  const user = data?.me ?? null;
  const isAdmin = !!user?.isAdmin;

  return {
    user,
    isAdmin,
    loading,
    error,
    refetch,
    networkStatus,
    authenticated: !!user,
  };
}
