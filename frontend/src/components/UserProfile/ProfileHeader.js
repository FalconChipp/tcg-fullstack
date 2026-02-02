// src/components/UserProfile/ProfileHeader.js
"use client";

// UPDATED (2026-01-29):
// - FIX: Messenger import casing + use openChat(userId) that now exists
// - FIX: Message button size (small, secondary style)
// - FIX: Button does something: opens messenger + loads chat/messages
// - KEEP: all your existing profile editing logic unchanged

import React, { useState, useRef, useEffect, useContext } from "react";
import Image from "next/image";
import { AuthContext } from "@/components/Auth/AuthProvider";
import ProfileSocialLinks from "@/components/UserProfile/ProfileSocialLinks";
import { FaEyeSlash } from "react-icons/fa";

import { useMessenger } from "@/components/Messenger/MessengerContext";

const WP_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;

const formatCurrency = (value) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);

function formatUpdatedAgo(iso) {
  if (!iso) return null;
  try {
    const updated = new Date(iso);
    const diffMs = Date.now() - updated.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    if (diffMinutes < 1) return "just now";
    if (diffMinutes < 60) return `${diffMinutes} min ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return null;
  }
}

export default function ProfileHeader({
  profileData,
  isOwnProfile,
  onEdit,
  dark,
  collectionValue = 0,
  collectionValueUpdatedAt,
  hideCollectionValue = false,
}) {
  const { token } = useContext(AuthContext);

  // Messenger API
  const { openChat } = useMessenger();

  const rawBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  const NEXT_PUBLIC_BACKEND_URL = rawBackendUrl.startsWith("http")
    ? rawBackendUrl
    : `https://${rawBackendUrl}`;

  const resolveavatar = (avatar) => {
    if (!avatar) return "https://placehold.co/100/webp";
    if (avatar.startsWith("http")) return avatar;
    const p = avatar.startsWith("/") ? avatar : `/${avatar}`;
    return `${NEXT_PUBLIC_BACKEND_URL}${p}`;
  };

  const [username, setUsername] = useState(profileData?.username || "Username");
  const [bio, setBio] = useState(profileData?.bio || "");
  const [favouritePokemon, setFavouritePokemon] = useState(profileData?.favouritePokemon || "");
  const [newProfileImage, setNewProfileImage] = useState(null);

  const [currentAvatar, setCurrentAvatar] = useState(profileData?.avatar || null);

  const [profileImagePreview, setProfileImagePreview] = useState(resolveavatar(profileData?.avatar));

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  const xp = profileData?.xp ?? 0;
  const xpMax = profileData?.xpMax ?? 100;
  const level = profileData?.level ?? 1;
  const badges = profileData?.badges ?? [];
  const tceBadge = profileData?.tceBadge ?? false;

  const xpPercent = Math.min(Math.round((xp / xpMax) * 100), 100);

  const profileUserId = profileData?.user?.id || profileData?.userId || profileData?.id || null;

  useEffect(() => {
    setUsername(profileData?.username || "Username");
    setBio(profileData?.bio || "");
    setFavouritePokemon(profileData?.favouritePokemon || "");
    setProfileImagePreview(resolveavatar(profileData?.avatar));
    setCurrentAvatar(profileData?.avatar || null);
    setNewProfileImage(null);
  }, [profileData]);

  const handleChooseImage = () => isEditing && fileInputRef.current?.click();

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setNewProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setProfileImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const profileUrl = typeof window !== "undefined" ? window.location.href : "";

  const updateProfileTextAndFinalAvatar = async (avatarForUpdate) => {
    const updateProfileMutation = `
      mutation UpdateProfile($bio: String, $favouritePokemon: String, $avatar: String) {
        updateProfile(
          bio: $bio
          favouritePokemon: $favouritePokemon
          avatar: $avatar
        ) {
          id
          bio
          favouritePokemon
          createdAt
          updatedAt
          avatar
          user { id username email avatar emailVerified }
        }
      }
    `;

    const variables = { bio, favouritePokemon, avatar: avatarForUpdate || null };

    const res = await fetch(WP_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: updateProfileMutation, variables }),
    });

    return res.json();
  };

  const performAvatarUpload = async () => {
    if (!newProfileImage) return null;

    const formData = new FormData();
    formData.append("avatar", newProfileImage);

    const res = await fetch(`${NEXT_PUBLIC_BACKEND_URL}/upload/avatar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    const data = await res.json();
    if (data?.success && data?.avatar) return data.avatar;
    throw new Error(data?.error || "Avatar upload failed");
  };

  const handleSaveAllChanges = async () => {
    if (!isOwnProfile || !token) return;
    setIsSaving(true);

    let avatarToSend = currentAvatar;

    if (newProfileImage) {
      try {
        const uploadedPath = await performAvatarUpload();
        if (uploadedPath) {
          avatarToSend = uploadedPath;
          setProfileImagePreview(resolveavatar(uploadedPath));
          setCurrentAvatar(uploadedPath);
          setNewProfileImage(null);
        }
      } catch (err) {
        console.error("Avatar upload failed", err);
      }
    }

    try {
      const json = await updateProfileTextAndFinalAvatar(avatarToSend);
      if (json?.data?.updateProfile) {
        const serverProfile = json.data.updateProfile;
        setBio(serverProfile.bio || "");
        setFavouritePokemon(serverProfile.favouritePokemon || "");
        setProfileImagePreview(resolveavatar(serverProfile.avatar));
        setCurrentAvatar(serverProfile.avatar);
        setIsEditing(false);
        onEdit?.(serverProfile);
      } else {
        console.error("Failed to update profile", json);
        setIsEditing(false);
      }
    } catch (e) {
      console.error("Profile update failed", e);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  // NEW: message click
  const handleMessageUser = async () => {
    if (!token) return;
    if (!profileUserId) return;
    if (isOwnProfile) return;

    try {
      await openChat(String(profileUserId));
    } catch (e) {
      console.error("openChat failed:", e);
    }
  };

  const updatedAgoLabel = formatUpdatedAgo(collectionValueUpdatedAt);

  return (
    <div
      className="
        w-full shadow-lg rounded-t-2xl p-6 sm:p-8
        bg-light-surface dark:bg-dark-surface
        border-t border-x border-light-border dark:border-dark-border
        grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch
      "
    >
      {/* Left: Avatar */}
      <div className="lg:col-span-2 flex flex-col items-center lg:items-start justify-center">
        <div
          className={`
            relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden
            bg-light-alt dark:bg-dark-alt
            border-4 ${dark ? "border-dark-accent" : "border-light-accent"}
            ${isEditing ? "cursor-pointer hover:opacity-80" : ""}
            shadow-xl mx-auto
          `}
          onClick={handleChooseImage}
        >
          <Image src={profileImagePreview} alt={`${username}'s avatar`} fill className="object-cover w-full h-full" priority />
          {isEditing && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-semibold">
              Change Image
            </div>
          )}
          <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageChange} />
        </div>
      </div>

      {/* Center: Main Info */}
      <div className="lg:col-span-6 flex flex-col min-w-0 justify-center">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold text-light-accent dark:text-dark-accent">
            {username}
          </span>

          {tceBadge && (
            <span className="ml-2 px-2 py-1 rounded-md text-xs font-bold bg-light-accent dark:bg-dark-accent text-white">
              ✨ TCE
            </span>
          )}

          {badges.length > 0 && (
            <span className="flex gap-1 ml-2">
              {badges.map((badge, i) => (
                <span
                  key={i}
                  className="bg-light-accentLight dark:bg-dark-accentLight text-white px-1.5 py-0.5 rounded text-xs font-semibold"
                >
                  {badge}
                </span>
              ))}
            </span>
          )}

          {/* Buttons (right aligned) */}
          <div className="ml-auto flex items-center gap-2">
            {!isOwnProfile && !!profileUserId && (
              <button
                type="button"
                onClick={handleMessageUser}
                disabled={!token}
                className="
                  ml-2 inline-flex items-center gap-1.5
                  px-2.5 py-1 rounded-full
                  text-[12px] font-semibold leading-none
                  border border-light-border/70 dark:border-dark-border/70
                  bg-light-alt/60 dark:bg-dark-alt/60
                  text-light-textSecondary dark:text-dark-textMuted
                  hover:bg-light-accent/10 hover:text-light-accent
                  dark:hover:bg-dark-accent/20 dark:hover:text-dark-accent
                  disabled:opacity-60 disabled:cursor-not-allowed
                  transition
                "
                title={!token ? "Log in to message" : "Message this user"}
              >
                Message
              </button>
            )}

            {isOwnProfile && !isEditing && (
              <button
                type="button"
                className="bg-light-accent hover:bg-light-accentLight dark:bg-dark-accent dark:hover:bg-dark-accentLight text-white font-bold px-4 py-2 rounded-xl shadow text-sm transition"
                onClick={() => setIsEditing(true)}
                disabled={isSaving}
              >
                Edit Profile
              </button>
            )}
          </div>
        </div>

        {/* Value row */}
        <div className="flex flex-wrap items-center gap-3 mt-3 mb-2">
          {collectionValue > 0 && !hideCollectionValue && (
            <div className="flex items-center gap-2 bg-light-alt dark:bg-dark-alt px-3 py-1.5 rounded-xl border border-light-border/70 dark:border-dark-border/70">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-light-textMuted dark:text-dark-textMuted">
                  Estimated collection value
                  <span className="ml-1 rounded-full bg-light-accent/10 dark:bg-dark-accent/20 px-1.5 py-[1px] text-[9px] font-bold text-light-accent dark:text-dark-accent">
                    beta
                  </span>
                </span>
                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                  {formatCurrency(collectionValue)}
                </span>
              </div>
              {updatedAgoLabel && (
                <span className="text-[10px] text-light-textMuted dark:text-dark-textMuted ml-2">
                  Updated {updatedAgoLabel}
                </span>
              )}
            </div>
          )}

          {isOwnProfile && hideCollectionValue && (
            <div className="flex items-center gap-1 text-xs text-light-textMuted dark:text-dark-textMuted">
              <FaEyeSlash className="opacity-70" />
              <span>Collection value hidden</span>
            </div>
          )}
        </div>

        {/* Bio + Favourite */}
        <div className="flex flex-col sm:flex-row gap-4 mt-2">
          <div className="flex-1">
            <h3 className="font-semibold text-light-accent dark:text-dark-accent text-xs mb-1 uppercase tracking-wide">
              Bio
            </h3>
            {isEditing ? (
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition"
                rows="2"
                placeholder="Write something about yourself..."
                disabled={isSaving}
              />
            ) : (
              <p className="text-light-textSecondary dark:text-dark-textMuted text-base">
                {bio || "No bio provided."}
              </p>
            )}
          </div>

          <div className="flex-1">
            <h3 className="font-semibold text-light-accent dark:text-dark-accent text-xs mb-1 uppercase tracking-wide">
              Favourite Pokémon
            </h3>
            {isEditing ? (
              <input
                type="text"
                value={favouritePokemon}
                onChange={(e) => setFavouritePokemon(e.target.value)}
                className="w-full px-4 py-2 rounded-lg border bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition"
                placeholder="e.g. Umbreon"
                disabled={isSaving}
              />
            ) : (
              <p className="text-light-textSecondary dark:text-dark-textMuted text-base">
                {favouritePokemon || "Not specified."}
              </p>
            )}
          </div>
        </div>

        {isEditing && (
          <div className="flex mt-6 gap-3">
            <button
              onClick={handleSaveAllChanges}
              className={`px-6 py-2 rounded-lg font-bold transition-colors
                bg-light-accent hover:bg-light-accentLight dark:bg-dark-accent dark:hover:bg-dark-accentLight text-white
                ${isSaving ? "opacity-60 cursor-not-allowed" : ""}
              `}
              disabled={isSaving}
              type="button"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>

            <button
              onClick={() => {
                setBio(profileData.bio || "");
                setFavouritePokemon(profileData.favouritePokemon || "");
                setNewProfileImage(null);
                setProfileImagePreview(resolveavatar(profileData.avatar));
                setCurrentAvatar(profileData.avatar || null);
                setIsEditing(false);
              }}
              className={`px-6 py-2 rounded-lg font-bold transition-colors
                border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface text-light-accent dark:text-dark-accent
                hover:bg-light-accent/10 dark:hover:bg-dark-accent/20
                ${isSaving ? "opacity-60 cursor-not-allowed" : ""}
              `}
              disabled={isSaving}
              type="button"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Right: social */}
      <div className="lg:col-span-4 flex flex-col gap-4 justify-center h-full">
        <div className="mt-4 flex flex-col gap-2 w-full">
          <h3 className="font-semibold text-light-accent dark:text-dark-accent text-xs mb-1 uppercase tracking-wide">
            Social Links
          </h3>
          <ProfileSocialLinks profileUrl={profileUrl} editable={false} />
        </div>
      </div>
    </div>
  );
}
