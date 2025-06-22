"use client"
import React, { useState, useEffect } from "react"
import Head from "next/head"
import { useSearchParams } from "next/navigation"

const WP_GRAPHQL_URL = 'http://tcg.local/graphql';

export default function ResetPasswordPage() {
  const searchParams = useSearchParams()

  const [resetToken, setResetToken] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const head = (
    <Head>
      <title>Reset Password – SixByFive TCG</title>
      <meta
        name="description"
        content="Choose a new password for your SixByFive TCG account."
      />
      <link rel="canonical" href="https://tcg.sixbyfive.com/reset-password" />
      <meta property="og:title" content="Reset Password – SixByFive TCG" />
      <meta
        property="og:description"
        content="Choose a new password for your SixByFive TCG account."
      />
      <meta property="og:url" content="https://tcg.sixbyfive.com/reset-password" />
      <meta property="og:image" content="https://tcg.sixbyfive.com/og-image.png" />
      <meta property="og:type" content="website" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Reset Password – SixByFive TCG" />
      <meta
        name="twitter:description"
        content="Choose a new password for your SixByFive TCG account."
      />
      <meta name="twitter:image" content="https://tcg.sixbyfive.com/og-image.png" />
    </Head>
  )

  // Extract token from URL: ?token=xxxx
  useEffect(() => {
    const token = searchParams.get("token")
    setResetToken(token || "")
    if (!token) {
      setStatus("Invalid or missing reset token.")
    }
  }, [searchParams])

  // Password validation (same as backend rules)
  function validatePassword(password) {
    if (password.length < 8) return "Password must be at least 8 characters."
    if (!/[A-Z]/.test(password)) return "Password must contain an uppercase letter."
    if (!/[a-z]/.test(password)) return "Password must contain a lowercase letter."
    if (!/[0-9]/.test(password)) return "Password must contain a number."
    if (!/[\W_]/.test(password)) return "Password must contain a special character."
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setStatus(null)

    const pwError = validatePassword(newPassword)
    if (pwError) {
      setStatus(pwError)
      setLoading(false)
      return
    }
    if (newPassword !== confirmPassword) {
      setStatus("Passwords do not match.")
      setLoading(false)
      return
    }

    // Correct GraphQL mutation and variables
    const query = `
      mutation ResetPassword($input: ResetPasswordInput!) {
        resetPassword(input: $input) {
          ok
        }
      }
    `
    const variables = {
      input: {
        token: resetToken,
        newPassword: newPassword,
      },
    }

    try {
      const res = await fetch(WP_GRAPHQL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
      })
      const json = await res.json()

      if (json?.data?.resetPassword?.ok) {
        setStatus("Password has been reset! You can now log in with your new password.")
      } else {
        setStatus("Error resetting password. Token may be invalid or expired.")
      }
    } catch (err) {
      setStatus("A network error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  if (!resetToken) {
    return (
      <>
        {head}
        <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-light-background dark:bg-dark-background pt-20">
          <div className="w-full max-w-md mx-auto p-7 rounded-2xl bg-white dark:bg-[#181822] border border-light-border dark:border-dark-border shadow-xl">
            <h1 className="text-2xl font-bold mb-4 text-light-primary dark:text-dark-primary text-center">
              Reset Password
            </h1>
          <p className="text-base mb-8 text-light-textSecondary dark:text-dark-textSecondary text-center">
            {status || "Missing or invalid reset token."}
          </p>
        </div>
        </div>
      </>
    )
  }

  return (
    <>
      {head}
      <div className="min-h-[calc(100vh-80px)] flex items-center justify-center bg-light-background dark:bg-dark-background pt-20">
      <div className="w-full max-w-md mx-auto p-7 rounded-2xl bg-white dark:bg-[#181822] border border-light-border dark:border-dark-border shadow-xl">
        <h1 className="text-2xl font-bold mb-4 text-light-primary dark:text-dark-primary text-center">
          Reset Your Password
        </h1>
        <p className="text-base mb-8 text-light-textSecondary dark:text-dark-textSecondary text-center">
          Enter your new password below.
        </p>
        <form className="flex flex-col gap-5" onSubmit={handleSubmit} autoComplete="off">
          <div>
            <label htmlFor="new-password" className="block mb-1 text-sm font-medium text-light-text dark:text-dark-text">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoComplete="new-password"
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
          <div>
            <label htmlFor="confirm-password" className="block mb-1 text-sm font-medium text-light-text dark:text-dark-text">
              Confirm New Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
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
            {loading ? "Resetting..." : "Reset Password"}
          </button>
        </form>
        <ul className="text-xs mt-6 mb-4 text-light-textMuted dark:text-dark-textMuted">
          <li>• At least 8 characters</li>
          <li>• At least one uppercase letter</li>
          <li>• At least one lowercase letter</li>
          <li>• At least one number</li>
          <li>• At least one special character</li>
        </ul>
        {status && (
          <div
            className={`
              mt-2 px-4 py-3 rounded-lg text-center font-medium border
              ${status.startsWith("Password has been reset")
                ? "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/70 dark:text-green-100 dark:border-green-700"
                : status.startsWith("A network error") || status.startsWith("Error resetting")
                ? "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/70 dark:text-red-100 dark:border-red-700"
                : "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/60 dark:text-blue-100 dark:border-blue-600"
              }
            `}
            role="alert"
          >
            {status}
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
  )
}
