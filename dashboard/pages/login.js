// pages/login.js
import React, { useState } from "react";
import { useRouter } from "next/router";

// Backend GraphQL endpoint
const GRAPHQL_URL = "https://backendtcg.sixbyfive.com/graphql";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch(GRAPHQL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `
            mutation Login($email: String!, $password: String!) {
              login(email: $email, password: $password) {
                token
              }
            }
          `,
          variables: { email, password }
        })
      });
      const json = await res.json();

      if (json.errors || !json.data?.login?.token) {
        setError(json.errors?.[0]?.message || "Login failed");
        setLoading(false);
        return;
      }
      const token = json.data.login.token;
      localStorage.setItem("tcg_admin_token", token);
      router.push("/");
    } catch (err) {
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  }

  // --- Dark mode only classes applied throughout (bg, border, text, etc.) ---
  // No light mode fallback.

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#121212]">
      <form
        onSubmit={handleLogin}
        className="bg-[#181a20] p-8 rounded-xl shadow-xl w-full max-w-md space-y-6 border border-[#23242a]"
      >
        <h2 className="text-2xl font-bold mb-2 text-white">Admin Login</h2>
        {error && <div className="text-red-400">{error}</div>}
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="Email"
          required
          className="block w-full p-3 border border-[#23242a] bg-[#23242a] text-white rounded focus:ring-2 focus:ring-indigo-500"
        />
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password"
          required
          className="block w-full p-3 border border-[#23242a] bg-[#23242a] text-white rounded focus:ring-2 focus:ring-indigo-500"
        />
        <button
          type="submit"
          className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded transition disabled:bg-indigo-900"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}
