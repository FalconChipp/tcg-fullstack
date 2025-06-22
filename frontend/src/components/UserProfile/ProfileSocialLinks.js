import React, { useState } from "react";
import { FaDiscord, FaTwitter, FaInstagram, FaYoutube, FaLink } from "react-icons/fa";

const ICONS = {
  discord: FaDiscord,
  twitter: FaTwitter,
  instagram: FaInstagram,
  youtube: FaYoutube,
  link: FaLink,
};

/**
 * ProfileSocialLinks - Displays and lets user share/add socials.
 * @param {object} props - { links, username, editable }
 */
export default function ProfileSocialLinks({ links = {}, profileUrl = "", editable = false, onEdit }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(profileUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {Object.entries(links).map(([type, url]) => {
        const Icon = ICONS[type] || FaLink;
        return (
          <a
            key={type}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="
              p-2 rounded-full 
              bg-light-alt dark:bg-dark-alt 
              hover:bg-light-accent dark:hover:bg-dark-accent
              text-light-accent dark:text-dark-accent
              text-lg transition
            "
            aria-label={type}
            title={type.charAt(0).toUpperCase() + type.slice(1)}
          >
            <Icon />
          </a>
        );
      })}
      <button
        onClick={handleCopy}
        className="
          flex items-center gap-1 px-3 py-1.5 rounded-lg
          bg-light-accent hover:bg-light-accentLight
          dark:bg-dark-accent dark:hover:bg-dark-accentLight
          text-white text-sm font-semibold transition
        "
        aria-label="Copy Profile Link"
      >
        <FaLink />
        {copied ? "Copied!" : "Share Profile"}
      </button>
      {editable && (
        <button
          onClick={onEdit}
          className="
            ml-2 px-3 py-1 rounded 
            bg-light-alt dark:bg-dark-alt 
            text-light-accent dark:text-dark-accent
            text-xs hover:bg-light-accent/10 dark:hover:bg-dark-accent/10
            transition
          "
        >
          Edit Socials
        </button>
      )}
    </div>
  );
}
