import React, { useState } from "react";

export default function PreferencesTab({ user }) {
  const [theme, setTheme] = useState("system");

  return (
    <div className="bg-light-surface dark:bg-dark-surface border border-light-border dark:border-dark-border rounded-2xl px-6 py-8 shadow">
      <h2 className="text-xl font-bold mb-6 text-light-primary dark:text-dark-primary">
        Preferences
      </h2>
      <form className="space-y-4">
        <div>
          <label className="font-semibold">Theme</label>
          <div className="flex gap-3 mt-2">
            <label>
              <input
                type="radio"
                name="theme"
                checked={theme === "system"}
                onChange={() => setTheme("system")}
              />
              <span className="ml-2">System</span>
            </label>
            <label>
              <input
                type="radio"
                name="theme"
                checked={theme === "light"}
                onChange={() => setTheme("light")}
              />
              <span className="ml-2">Light</span>
            </label>
            <label>
              <input
                type="radio"
                name="theme"
                checked={theme === "dark"}
                onChange={() => setTheme("dark")}
              />
              <span className="ml-2">Dark</span>
            </label>
          </div>
        </div>
        {/* You can add more settings here, e.g. card grid/list, default binder view, etc. */}
        <button
          type="submit"
          className="bg-light-accent dark:bg-dark-accent text-white dark:text-black px-6 py-2.5 rounded-xl font-bold hover:bg-light-primary dark:hover:bg-dark-primary transition"
        >
          Save Preferences
        </button>
      </form>
    </div>
  );
}
