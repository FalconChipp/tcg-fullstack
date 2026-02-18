"use client";
import React from "react";
import Head from "next/head";
import Layout from "@/components/Layout/Layout";

export default function PrivacyPolicy() {
  return (
    <>
      <Head>
        <title>Privacy Policy – SixByFive TCG</title>
        <meta
          name="description"
          content="Read SixByFive TCG's privacy policy to understand how we handle your data."
        />
        <link rel="canonical" href="https://tcg.sixbyfive.com/privacy" />
        <meta property="og:title" content="Privacy Policy – SixByFive TCG" />
        <meta
          property="og:description"
          content="Read SixByFive TCG's privacy policy to understand how we handle your data."
        />
        <meta property="og:url" content="https://tcg.sixbyfive.com/privacy" />
        <meta
          property="og:image"
          content="https://tcg.sixbyfive.com/og-image.png"
        />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Privacy Policy – SixByFive TCG" />
        <meta
          name="twitter:description"
          content="Read SixByFive TCG's privacy policy to understand how we handle your data."
        />
        <meta
          name="twitter:image"
          content="https://tcg.sixbyfive.com/og-image.png"
        />
      </Head>

      <Layout>
        <main className="max-w-3xl mx-auto py-12 px-4 bg-light-background dark:bg-dark-background rounded-2xl shadow-sm">
          <h1 className="text-3xl font-heading font-extrabold mb-5 text-light-accent dark:text-dark-accent">
            Privacy Policy
          </h1>

          {/* CHANGED: updated date to reflect new safety/messaging features */}
          <p className="mb-8 text-light-textSecondary dark:text-dark-textSecondary font-medium">
            Last updated: 18 February 2026
          </p>

          {/* 1. Introduction */}
          <section className="mb-8">
            <h2 className="text-2xl font-heading font-bold mb-3 text-light-text dark:text-dark-text">
              1. Introduction
            </h2>
            <p className="text-base text-light-text dark:text-dark-text font-sans">
              <b>SixByFive TCG</b> (“we”, “our”, or “us”) is committed to protecting your privacy.
              This Privacy Policy explains how we collect, use, disclose, and safeguard your
              information when you use our website, mobile applications, and related services
              (the “Service”). By using our Service, you agree to this Privacy Policy. If you do
              not agree, please do not use the Service.
            </p>
          </section>

          {/* 2. Information We Collect */}
          <section className="mb-8">
            <h2 className="text-2xl font-heading font-bold mb-3 text-light-text dark:text-dark-text">
              2. Information We Collect
            </h2>

            <ul className="list-disc pl-6 space-y-2 text-base text-light-text dark:text-dark-text font-sans">
              <li>
                <b>Account Information:</b> When you register or use the Service, we collect
                information such as your username, email address, and password.
              </li>

              <li>
                <b>Profile & Collection Data:</b> Information about your profile, collection,
                binder contents, wishlist, achievements, trading activity, and preferences.
              </li>

              <li>
                <b>Messaging & Communications:</b> If you use direct messages or other
                communication features, we store message content, sender/recipient identifiers,
                timestamps, and delivery/read status. We may also store support requests and
                emails exchanged with us.
                {/* CHANGED: explicit mention of messaging fields and safety context */}
                <div className="mt-1 text-sm text-light-textSecondary dark:text-dark-textSecondary">
                  Note: Message “deletion” may hide content from your view but may not immediately
                  remove it from our systems if needed for security, moderation, or legal purposes.
                </div>
              </li>

              <li>
                <b>Safety & Age Verification Data:</b> To support safety features, we may collect
                and store your date of birth (or age verification status), chat safety settings,
                agreement/consent flags (e.g. chat rules acknowledgement), and account safety
                enforcement states (e.g. chat bans, blocks, mutes).
                {/* CHANGED: explicit DOB/safety disclosure */}
              </li>

              <li>
                <b>Moderation & Trust/Safety Data:</b> We may store reports, flagged content,
                report reasons/details, and administrative actions taken to enforce our rules and
                protect users.
                {/* CHANGED: explicit reports/admin actions */}
              </li>

              <li>
                <b>Marketplace & Transaction Data:</b> Data related to your listings, trades,
                purchases, sales, offers, and shipment/tracking information (where applicable).
              </li>

              <li>
                <b>Notification Data:</b> We store notification preferences and may create records
                of in-app notifications. Where enabled, we may send email notifications and/or push
                notifications (which may require storing push tokens).
                {/* CHANGED: explicit notif + push token disclosure */}
              </li>

              <li>
                <b>Usage Data:</b> Information about your device, browser, IP address, referral URLs,
                access times, and interaction with our Service (via logs and analytics).
              </li>

              <li>
                <b>Payment & Subscription Data:</b> When you make purchases or subscribe, we (or our
                payment processors) collect transaction information. Payment details are processed
                securely and are not stored on our servers.
              </li>

              <li>
                <b>Cookies & Tracking:</b> We use cookies, web beacons, and similar technologies to
                collect analytics and improve your experience.
              </li>
            </ul>
          </section>

          {/* 3. How We Use Your Information */}
          <section className="mb-8">
            <h2 className="text-2xl font-heading font-bold mb-3 text-light-text dark:text-dark-text">
              3. How We Use Your Information
            </h2>
            <ul className="list-disc pl-6 space-y-1 text-base text-light-text dark:text-dark-text font-sans">
              <li>To operate, maintain, and improve the Service and your user experience.</li>
              <li>To enable collection management, trading, marketplace transactions, and community features.</li>
              <li>To provide account support, customer service, and respond to inquiries.</li>
              <li>To communicate service updates, account notifications, or security alerts.</li>
              <li>To personalise features, content, and recommendations.</li>
              <li>To monitor and prevent fraud, abuse, harassment, or suspicious activity.</li>

              {/* CHANGED: explicit safety/messaging purposes */}
              <li>
                To provide messaging features, deliver messages, detect abuse, enforce our rules,
                and investigate reports.
              </li>
              <li>
                To support safety features including age gating, chat rules enforcement, and
                moderation workflows.
              </li>

              <li>To comply with legal obligations, regulatory requirements, or protect our rights.</li>
            </ul>
          </section>

          {/* NEW: lawful bases (UK GDPR friendly) */}
          <section className="mb-8">
            <h2 className="text-2xl font-heading font-bold mb-3 text-light-text dark:text-dark-text">
              4. Legal Bases for Processing (UK GDPR)
            </h2>
            <p className="text-base text-light-text dark:text-dark-text font-sans">
              We process personal data under one or more of the following legal bases, depending on
              the context:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-3 text-base text-light-text dark:text-dark-text font-sans">
              <li>
                <b>Contract:</b> to provide the Service you request (e.g. account features, messaging,
                marketplace tools).
              </li>
              <li>
                <b>Legitimate Interests:</b> to keep the Service safe and secure, prevent fraud/abuse,
                enforce rules, and improve our platform (balanced against your rights).
              </li>
              <li>
                <b>Legal Obligation:</b> where we must comply with applicable laws.
              </li>
              <li>
                <b>Consent:</b> where required (for example, certain optional communications or settings).
              </li>
            </ul>
          </section>

          {/* 5. Cookies and Tracking Technologies (renumbered from 4) */}
          <section className="mb-8">
            <h2 className="text-2xl font-heading font-bold mb-3 text-light-text dark:text-dark-text">
              5. Cookies & Tracking Technologies
            </h2>
            <p className="text-base text-light-text dark:text-dark-text font-sans">
              We use cookies and similar technologies to remember your preferences, keep you signed in,
              analyse site traffic, and tailor your experience. You can manage your preferences at any
              time in your <b>Cookie Settings</b>. Our analytics partners may use cookies as described in
              their own privacy policies.
            </p>
          </section>

          {/* 6. How We Share Your Information (renumbered from 5) */}
          <section className="mb-8">
            <h2 className="text-2xl font-heading font-bold mb-3 text-light-text dark:text-dark-text">
              6. How We Share Your Information
            </h2>

            <ul className="list-disc pl-6 space-y-1 text-base text-light-text dark:text-dark-text font-sans">
              <li>
                <b>Service Providers:</b> We may share information with trusted third parties (hosting,
                analytics, payment processors, shipping providers, email delivery, push notification
                providers) as needed to provide the Service.
                {/* CHANGED: explicitly include push providers */}
              </li>

              <li>
                <b>Marketplace & Trading:</b> When you engage in trades or sales, relevant information
                (e.g., shipping address, username) may be shared with the other party as required to
                fulfil the transaction.
              </li>

              <li>
                <b>Legal & Compliance:</b> We may disclose your information where required by law,
                regulation, or to protect our legal rights and the safety of users.
              </li>

              <li>
                <b>Business Transfers:</b> If we are involved in a merger, acquisition, or asset sale,
                your information may be transferred as part of that process. We will notify you of any
                such change.
              </li>
            </ul>

            <p className="mt-4 text-base text-light-text dark:text-dark-text font-sans">
              <b>We do not sell or rent your personal information to third parties for marketing purposes.</b>
            </p>
          </section>

          {/* 7. Data Security (renumbered from 6) */}
          <section className="mb-8">
            <h2 className="text-2xl font-heading font-bold mb-3 text-light-text dark:text-dark-text">
              7. Data Security
            </h2>
            <p className="text-base text-light-text dark:text-dark-text font-sans">
              We use appropriate technical and organisational measures to protect your information from
              unauthorised access, alteration, disclosure, or destruction. However, no internet
              transmission or electronic storage is 100% secure; use the Service at your own risk.
            </p>
          </section>

          {/* 8. International Data Transfers (renumbered from 7) */}
          <section className="mb-8">
            <h2 className="text-2xl font-heading font-bold mb-3 text-light-text dark:text-dark-text">
              8. International Data Transfers
            </h2>
            <p className="text-base text-light-text dark:text-dark-text font-sans">
              Your information may be processed and stored on servers outside your country, including in
              the UK and EEA. If we transfer data internationally, we will ensure appropriate safeguards
              are in place as required by law (such as Standard Contractual Clauses).
            </p>
          </section>

          {/* 9. Data Retention (renumbered from 8) */}
          <section className="mb-8">
            <h2 className="text-2xl font-heading font-bold mb-3 text-light-text dark:text-dark-text">
              9. Data Retention
            </h2>

            {/* CHANGED: more explicit retention notes */}
            <p className="text-base text-light-text dark:text-dark-text font-sans">
              We retain your personal data only as long as necessary to provide the Service, comply with
              legal obligations, resolve disputes, or enforce our agreements. Examples include:
            </p>

            <ul className="list-disc pl-6 space-y-1 mt-3 text-base text-light-text dark:text-dark-text font-sans">
              <li>
                <b>Account/profile data</b> is generally kept while your account remains active.
              </li>
              <li>
                <b>Messages and safety/moderation records</b> may be retained for a period to support
                security, abuse prevention, dispute resolution, and enforcement of our rules.
              </li>
              <li>
                <b>Notification records</b> may be retained to support delivery status and user preferences.
              </li>
            </ul>

            <p className="mt-4 text-base text-light-text dark:text-dark-text font-sans">
              You may request deletion of your account at any time (see “Your Rights” below). Some data
              may be retained where required for legal, security, or fraud-prevention purposes.
            </p>
          </section>

          {/* 10. Your Rights (renumbered from 9) */}
          <section className="mb-8">
            <h2 className="text-2xl font-heading font-bold mb-3 text-light-text dark:text-dark-text">
              10. Your Rights & Choices
            </h2>
            <ul className="list-disc pl-6 space-y-1 text-base text-light-text dark:text-dark-text font-sans">
              <li><b>Access:</b> You may request access to your personal data we hold.</li>
              <li><b>Correction:</b> You may correct or update your information in your account settings.</li>
              <li><b>Deletion:</b> You may request deletion of your account and associated data. Some data may be retained for legal or security reasons.</li>
              <li><b>Objection:</b> You may object to or restrict certain types of data processing.</li>
              <li><b>Data Portability:</b> You may request a copy of your data in a machine-readable format.</li>
              <li><b>Marketing Preferences:</b> You can opt out of non-essential communications at any time.</li>
              <li>
                <b>Notification Preferences:</b> You can manage certain notification settings in your account
                (where available) and via your device settings for push notifications.
              </li>
            </ul>

            <p className="mt-4 text-base text-light-text dark:text-dark-text font-sans">
              To exercise any of these rights, email us at{" "}
              <a
                href="mailto:support@sixbyfive.co.uk"
                className="underline font-medium text-light-accent dark:text-dark-accent"
              >
                support@sixbyfive.co.uk
              </a>
              . We may require verification of your identity.
            </p>
          </section>

          {/* 11. Children's Privacy (renumbered from 10) */}
          <section className="mb-8">
            <h2 className="text-2xl font-heading font-bold mb-3 text-light-text dark:text-dark-text">
              11. Children’s Privacy
            </h2>

            {/* CHANGED: aligns with age gating + DOB collection */}
            <p className="text-base text-light-text dark:text-dark-text font-sans">
              Our Service is not directed at children under 16. We may use age-gating measures (such as
              date of birth or age verification status) to restrict access to features like messaging,
              trading, and community interactions.
            </p>
            <p className="mt-3 text-base text-light-text dark:text-dark-text font-sans">
              If we become aware that we have collected personal data from a child under 16 without
              appropriate consent or legal basis, we will take steps to delete that information.
            </p>
          </section>

          {/* 12. Changes to This Policy (renumbered from 11) */}
          <section className="mb-8">
            <h2 className="text-2xl font-heading font-bold mb-3 text-light-text dark:text-dark-text">
              12. Changes to This Policy
            </h2>
            <p className="text-base text-light-text dark:text-dark-text font-sans">
              We may update this Privacy Policy from time to time. We will notify you of any material
              changes by posting the new Policy on this page or via email. Your continued use of the
              Service after any change constitutes acceptance.
            </p>
          </section>

          {/* 13. Contact (renumbered from 12) */}
          <section>
            <h2 className="text-2xl font-heading font-bold mb-3 text-light-text dark:text-dark-text">
              13. Contact Us
            </h2>
            <p className="text-base text-light-text dark:text-dark-text font-sans">
              If you have any questions, concerns, or requests regarding your privacy, contact us at{" "}
              <a
                href="mailto:support@sixbyfive.co.uk"
                className="underline font-medium text-light-accent dark:text-dark-accent"
              >
                support@sixbyfive.co.uk
              </a>
              .
            </p>

            {/* OPTIONAL: ICO complaint line - you already had it commented */}
            {/* <p className="text-sm text-light-textMuted dark:text-dark-textMuted mt-2">
              You also have the right to lodge a complaint with the Information Commissioner’s Office (ICO) in the UK or your local data protection authority.
            </p> */}
          </section>
        </main>
      </Layout>
    </>
  );
}
