import {
  UserCircleIcon,
  KeyIcon,
  EnvelopeIcon,
  BanknotesIcon,
  QuestionMarkCircleIcon,
  BellIcon,
  Cog6ToothIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";

// Tab configuration array for easy management
const TABS = [
  { key: "connected", label: "Connected Accounts", icon: UserCircleIcon, soon: true },
  { key: "security", label: "Security", icon: KeyIcon },
  { key: "subscriptions", label: "Subscription", icon: EnvelopeIcon, soon: false },
  { key: "marketplace", label: "Marketplace/Trading", icon: BanknotesIcon, soon: true },
  { key: "support", label: "Support/Help", icon: QuestionMarkCircleIcon, soon: false },
  { key: "notifications", label: "Notifications", icon: BellIcon, soon: true },
  { key: "preferences", label: "Preferences", icon: Cog6ToothIcon, soon: true },
  { key: "privacy", label: "Privacy & Data", icon: LockClosedIcon, soon: false },
];

export default function AccountTabs({ activeTab, setActiveTab }) {
  return (
    <aside className="md:w-60 w-full flex-shrink-0 mb-4 md:mb-0">
      <nav
        className="
          rounded-2xl border border-light-border dark:border-dark-border
          bg-light-surface dark:bg-dark-surface shadow-lg
          px-3 py-6 flex flex-row md:flex-col gap-1 md:gap-0
          relative
        "
      >
        <h2 className="px-4 pb-3 mb-3 text-lg font-extrabold text-light-primary dark:text-dark-primary tracking-wide border-b border-light-border dark:border-dark-border">
          Account
        </h2>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              className={`
                group flex items-center gap-3 px-4 py-2 mb-1 rounded-xl font-semibold w-full transition-all
                ${
                  isActive
                    ? "bg-gradient-to-r from-light-accent/90 via-light-accent/70 to-light-accent/40 dark:from-dark-accent dark:to-dark-accent/70 text-white shadow-lg border-l-4 border-light-accent dark:border-dark-accent"
                    : "text-light-text dark:text-dark-text hover:bg-light-alt dark:hover:bg-dark-alt"
                }
                ${tab.soon ? "opacity-60 cursor-not-allowed grayscale" : ""}
              `}
              onClick={() => !tab.soon && setActiveTab(tab.key)}
              disabled={tab.soon}
              type="button"
              tabIndex={tab.soon ? -1 : 0}
              aria-current={isActive ? "page" : undefined}
            >
              <tab.icon
                className={`w-5 h-5 flex-shrink-0 transition-all ${
                  isActive
                    ? "text-white scale-110 drop-shadow"
                    : "text-light-accent dark:text-dark-accent"
                }`}
              />
              <span className="truncate">{tab.label}</span>
              {tab.soon && (
                <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded shadow-sm">
                  Soon
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
