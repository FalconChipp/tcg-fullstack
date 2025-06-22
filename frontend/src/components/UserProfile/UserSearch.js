"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";

const WP_GRAPHQL_URL = "http://tcg.local/graphql";

export default function UserSearchDropdown() {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Ref for the container to check if focus left the entire component.
  const containerRef = useRef(null);

  // Debounce search & fetch matching users when searchTerm changes.
  useEffect(() => {
    if (searchTerm.trim().length < 2) {
      setResults([]);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      async function fetchUsers() {
        setLoading(true);
        setError(null);
        const query = `
          query SearchCustomUsers($searchTerm: String!) {
            searchCustomUsers(searchTerm: $searchTerm) {
              id
              username
              userProfile {
                avatarUrl
              }
            }
          }
        `;
        const variables = { searchTerm };
        try {
          const response = await fetch(WP_GRAPHQL_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, variables }),
          });
          const json = await response.json();
          if (json.errors) {
            setError(json.errors[0].message);
            setResults([]);
          } else {
            setResults(json.data.searchCustomUsers || []);
          }
        } catch (err) {
          setError(err.message);
          setResults([]);
        } finally {
          setLoading(false);
        }
      }
      fetchUsers();
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  // onBlur handler for the container. It clears the dropdown if the entire component loses focus.
  const handleBlur = (e) => {
    setTimeout(() => {
      if (containerRef.current && !containerRef.current.contains(document.activeElement)) {
        setResults([]);
      }
    }, 100);
  };

  return (
    <div
      ref={containerRef}
      onBlur={handleBlur}
      className="relative w-full max-w-md mx-auto"
    >
      <input
        type="text"
        placeholder="Search users..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="
          w-full px-4 py-2
          border border-light-border dark:border-dark-border
          bg-light-surface dark:bg-dark-surface
          rounded-xl shadow-sm
          text-light-text dark:text-dark-text
          placeholder-light-textMuted dark:placeholder-dark-textMuted
          focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent
          transition
        "
      />
      {loading && <p className="text-xs text-light-textMuted dark:text-dark-textMuted mt-1">Loading...</p>}
      {error && <p className="text-xs text-light-error dark:text-dark-error mt-1">{error}</p>}
      {results.length > 0 && (
        <ul className="
          absolute left-0 right-0 bg-light-surface dark:bg-dark-surface
          border border-light-border dark:border-dark-border
          rounded-xl mt-1 shadow-lg z-10
          divide-y divide-light-border dark:divide-dark-border
          ">
          {results.map((user) => (
            <li key={user.id}>
              <Link
                href={`/profile/${user.username}`}
                className="
                  flex items-center p-2 gap-2
                  hover:bg-light-alt dark:hover:bg-dark-alt
                  rounded-xl transition-colors
                "
              >
                <Image
                  src={
                    user.userProfile?.avatarUrl ||
                    "https://placehold.co/40/webp?text=No+Avatar"
                  }
                  alt={user.username}
                  width={40}
                  height={40}
                  className="rounded-full object-cover border border-light-border dark:border-dark-border"
                />
                <span className="text-light-text dark:text-dark-text font-semibold">
                  {user.username}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
