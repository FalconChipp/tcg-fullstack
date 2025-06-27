"use client";
import React, { useState } from "react";
import Head from "next/head";

const WP_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:4000/graphql";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    const query = `
      mutation RequestPasswordReset($email: String!) {
        requestPasswordReset(email: $email)
      }
    `;
    const variables = { email };

    try {
      const res = await fetch(WP_GRAPHQL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });
      const json = await res.json();

      if (json?.data?.requestPasswordReset) {
        setStatus({
          type: "success",
          msg: "If an account with that email exists, a reset email has been sent. Please check your inbox and spam folder.",
        });
      } else {
        setStatus({
          type: "info",
          msg: "If an account with that email exists, a reset email has been sent. Please check your inbox and spam folder.",
        });
      }
    } catch (err) {
      setStatus({
        type: "error",
        msg: "A network error occurred. Please try again.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Forgot Password – SixByFive TCG</title>
        <meta
          name="description"
          content="Request a password reset link for your SixByFive TCG account."
        />
        <link rel="canonical" href="https://tcg.sixbyfive.com/forgot-password" />
        <meta property="og:title" content="Forgot Password – SixByFive TCG" />
        <meta
          property="og:description"
          content="Request a password reset link for your SixByFive TCG account."
        />
        <meta property="og:url" content="https://tcg.sixbyfive.com/forgot-password" />
        <meta property="og:image" content="https://tcg.sixbyfive.com/og-image.png" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Forgot Password – SixByFive TCG" />
        <meta
          name="twitter:description"
          content="Request a password reset link for your SixByFive TCG account."
        />
        <meta name="twitter:image" content="https://tcg.sixbyfive.com/og-image.png" />
      </Head>
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-light-background dark:bg-dark-background pt-20">
      <div className="w-full max-w-md mx-auto p-7 rounded-2xl bg-white dark:bg-[#181822] border border-light-border dark:border-dark-border shadow-xl">
        <h1 className="text-2xl font-bold mb-4 text-light-primary dark:text-dark-primary text-center">
          Forgot Password
        </h1>
        <p className="text-base mb-8 text-light-textSecondary dark:text-dark-textSecondary text-center">
          Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
        <form className="flex flex-col gap-5" onSubmit={handleSubmit} autoComplete="off">
          <div>
            <label htmlFor="email" className="block mb-1 text-sm font-medium text-light-text dark:text-dark-text">
              Email address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              autoComplete="username"
              onChange={e => setEmail(e.target.value)}
              required
              className="
                w-full rounded-lg px-4 py-3 text-base border
                border-light-border dark:border-dark-border
                bg-light-alt dark:bg-dark-alt
                text-light-text dark:text-dark-text
                focus:border-light-accent dark:focus:border-dark-accent
                focus:outline-none
                transition
              "
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="
              w-full py-3 rounded-xl text-white font-bold
              bg-light-primary hover:bg-light-accent
              dark:bg-dark-primary dark:hover:bg-dark-accent
              shadow transition disabled:opacity-70
            "
          >
            {loading ? "Sending..." : "Send Reset Email"}
          </button>
        </form>
        {status && (
          <div
            className={`
              mt-6 px-4 py-3 rounded-lg text-center font-medium border
              ${status.type === "success"
                ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/70 dark:text-green-100 dark:border-green-700"
                : status.type === "error"
                ? "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/70 dark:text-red-100 dark:border-red-700"
                : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/60 dark:text-blue-100 dark:border-blue-600"
              }
            `}
            role="alert"
          >
            {status.msg}
          </div>
        )}
        <div className="mt-8 text-center">
          <a
            href="/login"
            className="text-sm text-light-accent dark:text-dark-accent underline font-semibold hover:text-light-primary dark:hover:text-dark-primary transition"
          >
            Back to Login
          </a>
        </div>
      </div>
    </div>
    </>
  );
}
