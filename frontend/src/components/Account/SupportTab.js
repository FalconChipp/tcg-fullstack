import React from "react";
import { FaDiscord } from "react-icons/fa";

export default function SupportTab() {
  return (
    <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl px-6 py-8 shadow">
      <h2 className="text-xl font-bold mb-6 text-light-primary dark:text-dark-primary">
        Support & Help
      </h2>
      {/* Discord Community */}
      <div className="mb-8">
        <div className="flex items-center gap-4 bg-[#5865F2]/10 border border-[#5865F2] rounded-xl px-4 py-3">
          <FaDiscord className="text-[#5865F2] w-8 h-8" />
          <div className="flex-1">
            <div className="font-bold text-[#5865F2]">Join our Discord Community</div>
            <div className="text-sm text-light-text dark:text-dark-text">
              Chat with staff, get instant help, suggest features, and connect with other collectors.
            </div>
          </div>
          <a
            href="https://discord.gg/PRMbMbRE2H"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-2 bg-[#5865F2] text-white font-bold px-5 py-2 rounded-lg shadow hover:bg-[#4854c1] transition"
          >
            Join Discord
          </a>
        </div>
      </div>
      <p className="mb-4">
        Need help? Check our{" "}
        <a href="/help" className="text-light-accent dark:text-dark-accent underline">
          FAQ
        </a>.
      </p>
      <div className="mt-6 text-light-textMuted dark:text-dark-textMuted">
        Or email <a href="mailto:support@sixbyfive.com" className="underline">support@sixbyfive.com</a>
      </div>
    </div>
  );
}
