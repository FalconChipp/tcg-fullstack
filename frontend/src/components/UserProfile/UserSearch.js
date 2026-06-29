"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { getGraphqlUrl } from "@/utils/apiClient";

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
          query SearchUsers($q: String!) {
            searchUsers(q: $q) {
              id
              username
              avatar
            }
          }
        `;
        const variables = { q: searchTerm };
        try {
          const response = await fetch(getGraphqlUrl(), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query, variables }),
          });
          const json = await response.json();
          if (json.errors) {
            setError(json.errors[0].message);
            setResults([]);
          } else {
            setResults(json.data.searchUsers || []);
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
          border border-vault-border
          bg-vault-surface
          rounded-[10px] 
          text-vault-text
          placeholder-vault-textTertiary dark:placeholder-vault-textTertiary
          focus:outline-none focus:ring-2 focus:ring-vault-accent dark:focus:ring-vault-accent
          transition
        "
      />
      {loading && <p className="text-xs text-vault-textTertiary mt-1">Loading...</p>}
      {error && <p className="text-xs text-vault-danger dark:text-vault-danger mt-1">{error}</p>}
      {results.length > 0 && (
        <ul className="
          absolute left-0 right-0 bg-vault-surface
          border border-vault-border
          rounded-[10px] mt-1  z-10
          divide-y divide-vault-border dark:divide-vault-border
          ">
          {results.map((profile) => (
            <li key={profile.id}>
              <Link
                href={`/profile/${profile.username || profile.id || ""}`}
                className="
                  flex items-center p-2 gap-2
                  hover:bg-vault-raised dark:hover:bg-vault-raised
                  rounded-[10px] transition-colors
                "
              >
                <Image
                  src={profile.avatar || "https://placehold.co/40/webp?text=No+Avatar"}
                  alt={profile.username || "User"}
                  width={40}
                  height={40}
                  className="rounded-[6px] object-cover border border-vault-border"
                />
                <span className="text-vault-text font-semibold">
                  {profile.username || "(unknown)"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
