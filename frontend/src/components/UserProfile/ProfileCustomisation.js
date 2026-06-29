import React from "react";

export default function ProfileCustomisationPanel({ dark }) {
  // No state/logic, just UI shell

  return (
    <section
      className={`
        rounded-[10px] px-6 py-5 mb-8  border
        ${dark
          ? "bg-vault-surface border-vault-border"
          : "bg-vault-surface border-vault-border"
        }
      `}
    >
      <h2 className="text-lg md:text-xl font-bold mb-5 tracking-tight">Profile Customisation</h2>
      
      {/* Theme Selection */}
      <div className="mb-6">
        <div className="font-semibold mb-2">Theme</div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <input type="radio" name="theme" className="accent-purple-500" defaultChecked /> System
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="theme" className="accent-purple-500" /> Light
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="theme" className="accent-purple-500" /> Dark
          </label>
          <div className="flex gap-1 ml-4">
            <button className="w-6 h-6 rounded-[6px] bg-gradient-to-br from-purple-400 to-purple-700 border-2 border-purple-500"></button>
            <button className="w-6 h-6 rounded-[6px] bg-gradient-to-br from-blue-400 to-blue-700 border-2 border-blue-500"></button>
            <button className="w-6 h-6 rounded-[6px] bg-gradient-to-br from-pink-400 to-pink-700 border-2 border-pink-500"></button>
            <button className="w-6 h-6 rounded-[6px] bg-gradient-to-br from-yellow-300 to-orange-400 border-2 border-yellow-400"></button>
          </div>
          <button
            className={`
              ml-4 px-2 py-1 rounded border text-xs
              ${dark
                ? "bg-vault-raised border-vault-border text-white"
                : "bg-vault-raised border-vault-border text-vault-text"
              }
            `}
          >
            Preview
          </button>
        </div>
      </div>
      
      {/* Profile Background */}
      <div className="mb-6">
        <div className="font-semibold mb-2">Profile Background</div>
        <div className="flex items-center gap-2">
          <div className="w-14 h-10 rounded-[6px] bg-gradient-to-br from-purple-100 to-blue-200 border-2 border-purple-300"></div>
          <div className="w-14 h-10 rounded-[6px] bg-gradient-to-br from-gray-900 to-gray-700 border-2 border-gray-700"></div>
          <div className="w-14 h-10 rounded-[6px] bg-gradient-to-br from-yellow-200 to-orange-300 border-2 border-yellow-200"></div>
          <button
            className={`
              px-3 py-2 rounded border text-xs
              ${dark
                ? "bg-vault-raised border-vault-border text-white"
                : "bg-vault-raised border-vault-border text-vault-text"
              }
            `}
          >
            Upload
          </button>
        </div>
      </div>
      
      {/* Avatar */}
      <div className="mb-6">
        <div className="font-semibold mb-2">Avatar</div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-[6px] bg-gradient-to-br from-purple-200 to-purple-400 border-2 border-purple-400 flex items-center justify-center">
            {/* Avatar placeholder */}
            <span className="text-2xl font-bold text-purple-800">👤</span>
          </div>
          <button
            className={`
              px-3 py-2 rounded border text-xs
              ${dark
                ? "bg-vault-raised border-vault-border text-white"
                : "bg-vault-raised border-vault-border text-vault-text"
              }
            `}
          >
            Change Avatar
          </button>
          <button
            className={`
              px-3 py-2 rounded border text-xs
              ${dark
                ? "bg-vault-raised border-vault-border text-white"
                : "bg-vault-raised border-vault-border text-vault-text"
              }
            `}
          >
            Choose from Gallery
          </button>
        </div>
      </div>
      
      {/* Layout Selection */}
      <div className="mb-6">
        <div className="font-semibold mb-2">Layout</div>
        <div className="flex gap-4">
          <button className={`
            rounded-[6px] border px-4 py-2
            ${dark
              ? "bg-vault-raised border-vault-border text-white"
              : "bg-vault-raised border-vault-border text-vault-text"
            }
          `}>
            Classic
          </button>
          <button className={`
            rounded-[6px] border px-4 py-2
            ${dark
              ? "bg-vault-raised border-vault-border text-white"
              : "bg-vault-raised border-vault-border text-vault-text"
            }
          `}>
            Compact
          </button>
          <button className={`
            rounded-[6px] border px-4 py-2
            ${dark
              ? "bg-vault-raised border-vault-border text-white"
              : "bg-vault-raised border-vault-border text-vault-text"
            }
          `}>
            Showcase
          </button>
        </div>
      </div>
      
      {/* Badge/Flair */}
      <div className="mb-6">
        <div className="font-semibold mb-2">Badges & Frame</div>
        <div className="flex gap-2 items-center flex-wrap">
          <div className="w-10 h-10 rounded-[6px] bg-gradient-to-br from-yellow-300 to-orange-400 border-2 border-yellow-400 flex items-center justify-center text-xl">⭐</div>
          <div className="w-10 h-10 rounded-[6px] bg-gradient-to-br from-blue-200 to-blue-500 border-2 border-blue-400 flex items-center justify-center text-xl">💎</div>
          <div className="w-10 h-10 rounded-[6px] bg-gradient-to-br from-pink-300 to-pink-600 border-2 border-pink-400 flex items-center justify-center text-xl">🔥</div>
          <span className="ml-3 text-xs text-vault-textSecondary">Drag to reorder, or select “featured” badge below.</span>
        </div>
        <div className="mt-3">
          <label className="text-xs mr-2">Featured Badge:</label>
          <select
            className={`
              rounded border px-2 py-1 text-xs
              ${dark
                ? "bg-vault-raised border-vault-border text-white"
                : "bg-vault-raised border-vault-border text-vault-text"
              }
            `}
          >
            <option>⭐</option>
            <option>💎</option>
            <option>🔥</option>
          </select>
        </div>
        <div className="mt-3">
          <label className="text-xs mr-2">Frame/Flair:</label>
          <select
            className={`
              rounded border px-2 py-1 text-xs
              ${dark
                ? "bg-vault-raised border-vault-border text-white"
                : "bg-vault-raised border-vault-border text-vault-text"
              }
            `}
          >
            <option>Default</option>
            <option>Gold</option>
            <option>Rainbow</option>
          </select>
        </div>
      </div>
      
      {/* Privacy Controls */}
      <div className="mb-3">
        <div className="font-semibold mb-2">Privacy Settings</div>
        <div className="flex gap-5 flex-wrap">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" className="accent-purple-500" defaultChecked />
            Show Bio
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" className="accent-purple-500" defaultChecked />
            Show Collection Value
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" className="accent-purple-500" defaultChecked />
            Show Badges
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" className="accent-purple-500" defaultChecked />
            Show Wishlist
          </label>
        </div>
      </div>
      
      {/* Save / Reset */}
      <div className="flex gap-4 mt-4">
        <button className="px-5 py-2 rounded-[6px] font-bold transition bg-purple-800 text-white hover:bg-purple-700">Save Changes</button>
        <button className={`
          px-5 py-2 rounded-[6px] font-bold transition border
          ${dark
            ? "bg-vault-raised border-purple-400 text-white"
            : "bg-vault-raised border-purple-700 text-purple-900"
          }
        `}>Reset</button>
      </div>
    </section>
  );
}
