"use client";
import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import StatusMessage from "@/components/UI/StatusMessage";
import { setCookie } from "@/utils/cookieUtils";
import { useTheme } from "@/hooks/ThemeProvider";

const WP_GRAPHQL_URL =
  process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:4000/graphql";

// --- Countdown utility ---
function getCountdown(targetDate) {
  const now = new Date();
  const diff = targetDate - now;
  if (diff <= 0)
    return { days: 0, hours: 0, minutes: 0, seconds: 0, ended: true };
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds, ended: false };
}

export default function Landing() {
  const { dark } = useTheme?.() || {};
  const [statusMessage, setStatusMessage] = useState(null);
  const [registerPassword, setRegisterPassword] = useState("");
  const [showPasswordRules, setShowPasswordRules] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // --- Countdown state ---
  const targetDate = new Date("2025-07-25T00:00:00+01:00"); // BST/UK
  const [countdown, setCountdown] = useState(getCountdown(targetDate));

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(getCountdown(targetDate));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm();

  const showStatusMessage = (type, message) => {
    setStatusMessage({ type, message });
    setTimeout(() => setStatusMessage(null), 4500);
  };

  const onSubmit = async (formData) => {
    const { username, email, password, terms } = formData;
    if (!terms) {
      showStatusMessage(
        "error",
        "You must agree to the Terms and Privacy Policy."
      );
      return;
    }

    const pwErrors = getPasswordValidationErrors(password);
    if (pwErrors.length > 0) {
      setShowPasswordRules(true);
      showStatusMessage(
        "error",
        `Password requirements not met: ${pwErrors.join(", ")}`
      );
      return;
    }

    const query = `
      mutation Register($username: String!, $email: String!, $password: String!) {
        registerCustomUser(input: { username: $username, email: $email, password: $password }) {
          user {
            id
            username
            email
          }
        }
      }
    `;
    const variables = { username, email, password };

    try {
      const response = await fetch(WP_GRAPHQL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, variables }),
      });
      const json = await response.json();

      const registeredUser = json?.data?.registerCustomUser?.user;
      if (registeredUser) {
        setSubmitted(true);
        reset();
        setRegisterPassword("");
      } else {
        showStatusMessage(
          "error",
          json?.errors?.[0]?.message || "Registration failed"
        );
      }
    } catch (err) {
      showStatusMessage(
        "error",
        "Something went wrong. Please try again later."
      );
    }
  };

  const pwErrors = getPasswordValidationErrors(registerPassword);

  // --- Format countdown text ---
  const countdownText = countdown.ended
    ? "We're live!"
    : `${countdown.days}d ${String(countdown.hours).padStart(2, "0")}h ${String(countdown.minutes).padStart(2, "0")}m ${String(countdown.seconds).padStart(2, "0")}s`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-light-accent/5 via-light-background to-light-surface dark:from-dark-surface dark:via-dark-background dark:to-dark-alt flex flex-col">
      {/* HERO */}
      <header className="w-full py-12 px-4 text-center flex flex-col items-center">
        <div className="max-w-2xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-heading font-extrabold mb-4 text-light-accent dark:text-dark-accent">
            Sign Up Now — Get Notified When We Go Live
          </h1>
          {/* Countdown */}
          <div className="mb-4">
            <span className="inline-block text-lg md:text-xl font-bold px-4 py-2 rounded-lg bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border shadow-sm text-light-accent dark:text-dark-accent">
              {countdown.ended
                ? "We're live!"
                : `Time left until launch: ${countdownText}`}
            </span>
          </div>
          <p className="text-lg md:text-xl text-light-textSecondary dark:text-dark-textSecondary font-medium mb-8">
            Manage your collection, trade cards, and connect <br />with the UK’s next-gen TCG community.<br />
            Sign up below to be first to know when SixByFive TCG launches!
          </p>
        </div>
        {!submitted ? (
          <div className="w-full max-w-md mx-auto bg-light-surface dark:bg-dark-surface rounded-2xl shadow-lg px-8 py-7 mb-6 border border-light-border dark:border-dark-border">
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3" autoComplete="on">
              <div>
                <label htmlFor="username" className="font-semibold text-light-accent dark:text-dark-accent">
                  Username
                </label>
                <input
                  {...register("username", { required: true })}
                  id="username"
                  placeholder="Username"
                  autoComplete="username"
                  className="w-full rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt px-4 py-2 text-base text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent focus:outline-none transition"
                />
                {errors.username && (
                  <p className="text-xs text-light-error dark:text-dark-error">
                    Username is required
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="email" className="font-semibold text-light-accent dark:text-dark-accent">
                  Email
                </label>
                <input
                  {...register("email", { required: true })}
                  id="email"
                  placeholder="Email"
                  type="email"
                  autoComplete="email"
                  className="w-full rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt px-4 py-2 text-base text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent focus:outline-none transition"
                />
                {errors.email && (
                  <p className="text-xs text-light-error dark:text-dark-error">
                    Email is required
                  </p>
                )}
              </div>
              <div>
                <label htmlFor="password" className="font-semibold text-light-accent dark:text-dark-accent">
                  Password
                </label>
                <input
                  {...register("password", { required: true })}
                  id="password"
                  type="password"
                  placeholder="Password"
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt px-4 py-2 text-base text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent focus:outline-none transition"
                  onFocus={() => setShowPasswordRules(true)}
                  onBlur={() => setShowPasswordRules(true)}
                  onChange={e => {
                    setRegisterPassword(e.target.value);
                    register("password").onChange(e);
                  }}
                />
                {errors.password && (
                  <p className="text-xs text-light-error dark:text-dark-error">
                    Password is required
                  </p>
                )}
                {showPasswordRules && (
                  <ul className="pl-5 pt-1 pb-1 text-sm">
                    {[
                      "At least 8 characters",
                      "At least one uppercase letter",
                      "At least one lowercase letter",
                      "At least one number",
                      "At least one special character"
                    ].map((rule, i) => {
                      const isFail = pwErrors.includes(rule);
                      return (
                        <li key={rule} className={`mb-0.5 ${isFail ? "text-light-error dark:text-dark-error" : "text-green-600 dark:text-green-400"} flex items-center gap-1`}>
                          {isFail ? "✗" : "✓"} {rule}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="terms"
                  {...register("terms", { required: true })}
                  className="accent-light-accent dark:accent-dark-accent rounded focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition"
                />
                <label htmlFor="terms" className="text-sm text-light-textSecondary dark:text-dark-textSecondary">
                  I agree to the{" "}
                  <Link href="/terms" className="text-light-accent dark:text-dark-accent underline" target="_blank">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/privacy" className="text-light-accent dark:text-dark-accent underline" target="_blank">
                    Privacy Policy
                  </Link>
                  .
                </label>
              </div>
              {errors.terms && (
                <p className="text-xs text-light-error dark:text-dark-error mb-1">
                  You must agree to the Terms of Service and Privacy Policy.
                </p>
              )}
              <button
                type="submit"
                className="mt-2 w-full rounded-lg bg-light-accent dark:bg-dark-accent text-white font-bold text-lg py-2 px-4 transition-colors hover:bg-light-accentLight dark:hover:bg-dark-accentLight focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
                disabled={statusMessage?.type === "loading" || countdown.ended}
              >
                Sign Up for Launch Notification
              </button>
              {statusMessage && (
                <StatusMessage
                  type={statusMessage.type}
                  message={statusMessage.message}
                  onClose={() => setStatusMessage(null)}
                />
              )}
            </form>
            <p className="mt-4 text-xs text-light-textMuted dark:text-dark-textMuted">
              No spam — you’ll only get notified when we go live and for major updates.
            </p>
          </div>
        ) : (
          <div className="w-full max-w-md mx-auto bg-light-surface dark:bg-dark-surface rounded-2xl shadow-lg px-8 py-10 mb-6 border border-light-border dark:border-dark-border flex flex-col items-center">
            <span className="text-2xl text-green-600 dark:text-green-400 font-bold mb-3">🎉</span>
            <h2 className="text-2xl font-heading font-semibold mb-2 text-light-accent dark:text-dark-accent">
              Thanks for Signing Up!
            </h2>
            <p className="text-base text-light-text dark:text-dark-text mb-2 text-center">
              You’ll be first to know when SixByFive TCG goes live.<br />
              Check your inbox for a confirmation email soon!
            </p>
            <Link
              href="/"
              className="mt-2 inline-block text-light-accent dark:text-dark-accent underline text-sm"
            >
              Back to home
            </Link>
          </div>
        )}
      </header>
      {/* Why sign up */}
      <section className="max-w-2xl mx-auto mb-12 px-4">
        <h3 className="text-xl font-heading font-bold mb-3 text-light-text dark:text-dark-text">
          Why sign up before launch?
        </h3>
        <ul className="list-disc pl-6 text-base text-light-text dark:text-dark-text font-sans space-y-1">
          <li>Be notified the moment the platform goes live</li>
          <li>Secure your username before public registration opens</li>
          <li>Receive launch-day tips and walkthroughs</li>
          <li>Get news about new features and upcoming events</li>
          <li>No spam — just the essentials, and you can unsubscribe anytime</li>
        </ul>
      </section>
      {/* FAQ */}
      <section className="max-w-2xl mx-auto mb-8 px-4">
        <h3 className="text-xl font-heading font-bold mb-3 text-light-text dark:text-dark-text">
          Frequently Asked Questions
        </h3>
        <div className="mb-4">
          <span className="font-semibold text-light-accent dark:text-dark-accent">
            When does SixByFive TCG launch?
          </span>
          <p className="text-light-text dark:text-dark-text">
            Soon! Sign up and you’ll be first to know — we’ll send a notification as soon as registration opens.
          </p>
        </div>
        <div className="mb-4">
          <span className="font-semibold text-light-accent dark:text-dark-accent">
            Is there a cost?
          </span>
          <p className="text-light-text dark:text-dark-text">
            No — signing up is free and there’s no commitment required.
          </p>
        </div>
        <div>
          <span className="font-semibold text-light-accent dark:text-dark-accent">
            Will you send me marketing or spam?
          </span>
          <p className="text-light-text dark:text-dark-text">
            No spam — only a handful of important launch-related updates. You can unsubscribe at any time.
          </p>
        </div>
      </section>
      {/* Footer */}
      <footer className="mt-auto py-6 text-center text-xs text-light-textMuted dark:text-dark-textMuted">
        &copy; {new Date().getFullYear()} SixByFive Ltd &mdash;{" "}
        <Link href="/privacy" className="underline text-light-accent dark:text-dark-accent">Privacy</Link>{" "}
        &middot;{" "}
        <Link href="/terms" className="underline text-light-accent dark:text-dark-accent">Terms</Link>
      </footer>
    </div>
  );
}

// --- Password validation utility ---
function getPasswordValidationErrors(pw = "") {
  const errors = [];
  if (pw.length < 8) errors.push("At least 8 characters");
  if (!/[A-Z]/.test(pw)) errors.push("At least one uppercase letter");
  if (!/[a-z]/.test(pw)) errors.push("At least one lowercase letter");
  if (!/[0-9]/.test(pw)) errors.push("At least one number");
  if (!/[\W_]/.test(pw)) errors.push("At least one special character");
  return errors;
}
