"use client";
import React, { useState } from "react";
import Link from "next/link";
import Layout from "@/components/Layout/Layout";
import StatusMessage from "@/components/UI/StatusMessage";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(null);
  const [submissionId, setSubmissionId] = useState(null);

  // --- SUBMIT HANDLER (updated for FormNest API) ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus(null);

    const payload = {
      form_id: "formnest_1375",
      ...form,
    };

    try {
      const response = await fetch(
        "https://tcg.sixbyfive.com/backend/wp-json/formnest/v1/submissions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const text = await response.text();
      // Optionally log the raw API response for debugging
      // console.log("Raw API Response:", text);

      if (!text) {
        throw new Error("Empty response from server.");
      }

      if (!text.startsWith("{")) {
        throw new Error(`Unexpected response format: ${text}`);
      }

      const result = JSON.parse(text);

      if (response.ok) {
        setSubmissionId(result.submission_id);
        setStatus({
          type: "success",
          message: (
            <>
              <div className="mb-1">Thank you for your submission!</div>
              <div>Your Submission ID: <b>{result.submission_id}</b></div>
              <div className="mt-2">Our team will get back to you within 48 hours.</div>
            </>
          ),
        });
        setForm({ name: "", email: "", message: "" });
      } else {
        setStatus({ type: "error", message: result.error || "Submission failed. Please try again." });
      }
    } catch (error) {
      setStatus({
        type: "error",
        message: "Failed to submit the form. Please try again or contact support.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <main className="max-w-3xl mx-auto py-12 px-4">
        {/* Header */}
        <h1 className="text-3xl font-heading font-extrabold mb-4 text-light-accent dark:text-white">
          Contact Us
        </h1>
        <p className="mb-8 text-base text-light-textSecondary dark:text-dark-textSecondary">
          Got a question, feedback, or want to get in touch with the SixByFive TCG team?
          Fill out the form below or reach us directly by email at{" "}
          <a href="mailto:support@sixbyfive.co.uk" className="text-light-accent dark:text-dark-accent underline">
            support@sixbyfive.co.uk
          </a>.
        </p>

        {/* Quick Links / Contact Methods */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          <ContactCard
            icon="💬"
            label="Discord"
            href="https://discord.gg/pAnGVBb2Dc"
            desc="Chat with our community & team"
            external
          />
          <ContactCard
            icon="📧"
            label="Email"
            href="mailto:support@sixbyfive.co.uk"
            desc="Email support team"
            external
          />
          <ContactCard
            icon="🚀"
            label="Roadmap"
            href="/roadmap"
            desc="See upcoming features & updates"
          />
        </div>

        {/* Contact Form */}
        <section className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl shadow px-8 py-7 mb-8">
          <h2 className="text-xl font-heading font-bold text-light-accent dark:text-white mb-3">
            Contact Form
          </h2>
          {/* Show thank you after successful submit */}
          {status?.type === "success" ? (
            <div className="py-10 flex flex-col items-center">
              <span className="text-2xl mb-3 text-green-500">🎉</span>
              <div className="text-base text-center">{status.message}</div>
            </div>
          ) : (
            <form className="space-y-4" onSubmit={handleSubmit} autoComplete="on">
              <div>
                <label htmlFor="name" className="block font-medium text-light-accent dark:text-dark-accent mb-1">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  className="w-full rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt px-4 py-2 text-base text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent focus:outline-none transition"
                  required
                  value={form.name}
                  onChange={e => setForm(s => ({ ...s, name: e.target.value }))}
                  autoComplete="name"
                />
              </div>
              <div>
                <label htmlFor="email" className="block font-medium text-light-accent dark:text-dark-accent mb-1">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className="w-full rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt px-4 py-2 text-base text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent focus:outline-none transition"
                  required
                  value={form.email}
                  onChange={e => setForm(s => ({ ...s, email: e.target.value }))}
                  autoComplete="email"
                />
              </div>
              <div>
                <label htmlFor="message" className="block font-medium text-light-accent dark:text-dark-accent mb-1">
                  Message
                </label>
                <textarea
                  id="message"
                  rows={5}
                  className="w-full rounded-lg border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt px-4 py-2 text-base text-light-text dark:text-dark-text focus:border-light-accent dark:focus:border-dark-accent focus:outline-none transition resize-none"
                  required
                  value={form.message}
                  onChange={e => setForm(s => ({ ...s, message: e.target.value }))}
                  autoComplete="off"
                />
              </div>
              <button
                type="submit"
                className="mt-2 w-full rounded-lg bg-light-accent dark:bg-dark-accent text-white font-bold text-lg py-2 px-4 transition-colors hover:bg-light-accentLight dark:hover:bg-dark-accentLight focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent"
                disabled={submitting}
              >
                {submitting ? "Sending..." : "Send Message"}
              </button>
              {status?.type === "error" && (
                <StatusMessage
                  type="error"
                  message={status.message}
                  onClose={() => setStatus(null)}
                />
              )}
            </form>
          )}
        </section>

        <div className="text-xs text-light-textMuted dark:text-dark-textMuted mt-6">
          For sensitive issues (like account security or payments), please email{" "}
          <a href="mailto:support@sixbyfive.co.uk" className="text-light-accent dark:text-dark-accent underline">
            support@sixbyfive.co.uk
          </a>{" "}
          directly.
        </div>
      </main>
    </Layout>
  );
}

// --- Contact Card Component ---
function ContactCard({ icon, label, desc, href, external }) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="flex flex-col items-center gap-2 rounded-2xl bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border px-6 py-5 shadow-sm transition hover:shadow-lg hover:border-light-accent dark:hover:border-dark-accent group"
    >
      <span className="text-3xl">{icon}</span>
      <span className="text-base font-semibold text-light-accent dark:text-dark-accent">{label}</span>
      <span className="text-sm text-light-textMuted dark:text-dark-textMuted text-center">{desc}</span>
    </a>
  );
}
