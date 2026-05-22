// src/components/UserProfile/ProfileHeader.js
"use client";

// UPDATED (2026-01-29):
// - FIX: Messenger import casing + use openChat(userId) that now exists
// - FIX: Message button size (small, secondary style)
// - FIX: Button does something: opens messenger + loads chat/messages
// - KEEP: all your existing profile editing logic unchanged

import React, { useState, useRef, useEffect, useContext, useMemo } from "react";
import Image from "next/image";
import { AuthContext } from "@/components/Auth/AuthProvider";
import ProfileSocialLinks from "@/components/UserProfile/ProfileSocialLinks";
import { FaEyeSlash } from "react-icons/fa";
import pokemonList, { getPokemonDisplaySprite } from "@/utils/pokemonListShiny";

import { useMessenger } from "@/components/Messenger/MessengerContext";
import { getApiBase, getGraphqlUrl } from "@/utils/apiClient";
import { devError } from "@/utils/devLog";

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

  const rawBackendUrl = getApiBase();
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

  // Depend on scalar values, not the object reference — avoids resetting state
  // every time the parent re-renders and recreates the profileData object.
  // While the user is actively editing we skip the bio/favouritePokemon reset
  // so mid-edit text isn't clobbered by a parent re-render.
  const _pdId       = profileData?.id;
  const _pdUsername = profileData?.username;
  const _pdBio      = profileData?.bio;
  const _pdFav      = profileData?.favouritePokemon;
  const _pdAvatar   = profileData?.avatar;

  useEffect(() => {
    setUsername(_pdUsername || "Username");
    if (!isEditing) {
      setBio(_pdBio || "");
      setFavouritePokemon(_pdFav || "");
    }
    setProfileImagePreview(resolveavatar(_pdAvatar));
    setCurrentAvatar(_pdAvatar || null);
    setNewProfileImage(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_pdId, _pdUsername, _pdBio, _pdFav, _pdAvatar]);

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
          avatar
          user { id username email avatar emailVerified }
        }
      }
    `;

    const variables = { bio, favouritePokemon, avatar: avatarForUpdate || null };

    const res = await fetch(getGraphqlUrl(), {
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
    // media-service returns { ok: true, url: "/uploads/avatars/..." }
    if (data?.ok && data?.url) return data.url;
    // legacy shape fallback
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
        devError("Avatar upload failed", err);
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
        devError("Failed to update profile", json);
        setIsEditing(false);
      }
    } catch (e) {
      devError("Profile update failed", e);
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
      devError("openChat failed:", e);
    }
  };

  const updatedAgoLabel = formatUpdatedAgo(collectionValueUpdatedAt);

  // Resolve sprite for the saved favourite Pokémon (5% shiny chance, stable per name)
  const shinyRollRef = useRef(null);
  const favSprite = useMemo(() => {
    if (!favouritePokemon) return null;
    const match = pokemonList.find(
      (p) => p.name.toLowerCase() === favouritePokemon.toLowerCase()
    );
    if (!match) return null;
    // Keep the shiny roll stable across re-renders for this profile view
    if (shinyRollRef.current === null) {
      shinyRollRef.current = Math.random() < 0.05;
    }
    const result = getPokemonDisplaySprite(match, {
      shinyChance: shinyRollRef.current ? 1 : 0,
    });
    return result.displaySprite ?? null;
  }, [favouritePokemon]);

  return (
    <div className="w-full rounded-t-2xl overflow-hidden border-t border-x border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface shadow-lg">

      {/* Accent banner strip */}
      <div className="h-1.5 w-full bg-gradient-to-r from-light-accent via-light-accentLight to-light-accent dark:from-dark-accent dark:via-dark-accentLight dark:to-dark-accent" />

      <div className="px-6 sm:px-8 py-6 flex flex-col sm:flex-row gap-5 items-start">

        {/* ── Avatar ── */}
        <div className="flex-shrink-0">
          <div
            className={`
              relative w-20 h-20 sm:w-24 sm:h-24 rounded-full
              ring-2 ring-light-accent/60 dark:ring-dark-accent/60
              ring-offset-2 ring-offset-light-surface dark:ring-offset-dark-surface
              shadow-lg overflow-hidden bg-light-alt dark:bg-dark-alt
              ${isEditing ? "cursor-pointer" : ""}
            `}
            onClick={handleChooseImage}
          >
            <Image
              src={profileImagePreview}
              alt={`${username}'s avatar`}
              fill
              className="object-cover"
              priority
            />
            {isEditing && (
              <div className="absolute inset-0 bg-black/55 flex items-center justify-center">
                <span className="text-white text-[11px] font-bold tracking-wide text-center leading-tight px-1">
                  Change
                </span>
              </div>
            )}
            <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageChange} />
          </div>
        </div>

        {/* ── Centre: name + bio + collection value ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-2.5">

          {/* Name + badges */}
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-extrabold text-light-accent dark:text-dark-accent leading-none">
              {username}
            </h1>
            {tceBadge && (
              <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-light-accent dark:bg-dark-accent text-white">
                ✨ TCE
              </span>
            )}
            {badges.map((badge, i) => (
              <span
                key={i}
                className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-light-accentLight/20 dark:bg-dark-accentLight/20 text-light-accent dark:text-dark-accent border border-light-accent/20 dark:border-dark-accent/30"
              >
                {badge}
              </span>
            ))}
          </div>

          {/* Bio + favourite */}
          {!isEditing ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-sm text-light-text dark:text-dark-text leading-relaxed">
                {bio || <span className="text-light-textMuted dark:text-dark-textMuted italic">No bio yet.</span>}
              </p>
              {favouritePokemon && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-light-textMuted dark:text-dark-textMuted">·</span>
                  {favSprite && (
                    <img
                      src={favSprite}
                      alt={favouritePokemon}
                      className="w-7 h-7 object-contain drop-shadow-sm"
                      style={{ imageRendering: "pixelated" }}
                    />
                  )}
                  <span className="text-sm text-light-textSecondary dark:text-dark-textMuted">
                    {favouritePokemon}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-3">
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={2}
                placeholder="Write something about yourself…"
                disabled={isSaving}
                className="flex-1 px-3 py-2 rounded-lg text-sm border bg-light-alt dark:bg-dark-alt border-light-border dark:border-dark-border text-light-text dark:text-dark-text placeholder:text-light-textMuted dark:placeholder:text-dark-textMuted focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition resize-none"
              />
              <input
                type="text"
                value={favouritePokemon}
                onChange={(e) => setFavouritePokemon(e.target.value)}
                placeholder="Favourite Pokémon…"
                disabled={isSaving}
                className="sm:w-48 px-3 py-2 rounded-lg text-sm border bg-light-alt dark:bg-dark-alt border-light-border dark:border-dark-border text-light-text dark:text-dark-text placeholder:text-light-textMuted dark:placeholder:text-dark-textMuted focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition"
              />
            </div>
          )}

          {/* Collection value */}
          <div className="flex flex-wrap items-center gap-3 mt-0.5">
            {collectionValue > 0 && !hideCollectionValue && (
              <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-lg">
                <div className="flex flex-col leading-none">
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">
                    Est. collection value
                    <span className="ml-1 text-[9px] opacity-70">beta</span>
                  </span>
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {formatCurrency(collectionValue)}
                  </span>
                </div>
                {updatedAgoLabel && (
                  <span className="text-[10px] text-emerald-600/60 dark:text-emerald-400/50 self-end pb-0.5">
                    {updatedAgoLabel}
                  </span>
                )}
              </div>
            )}
            {isOwnProfile && hideCollectionValue && (
              <div className="flex items-center gap-1.5 text-xs text-light-textMuted dark:text-dark-textMuted">
                <FaEyeSlash className="opacity-60" />
                <span>Value hidden</span>
              </div>
            )}
          </div>

          {/* Save / cancel when editing */}
          {isEditing && (
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={handleSaveAllChanges}
                disabled={isSaving}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold bg-light-accent hover:bg-light-accentLight dark:bg-dark-accent dark:hover:bg-dark-accentLight text-white transition ${isSaving ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                {isSaving ? "Saving…" : "Save Changes"}
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  setBio(profileData.bio || "");
                  setFavouritePokemon(profileData.favouritePokemon || "");
                  setNewProfileImage(null);
                  setProfileImagePreview(resolveavatar(profileData.avatar));
                  setCurrentAvatar(profileData.avatar || null);
                  setIsEditing(false);
                }}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold border border-light-border dark:border-dark-border bg-transparent text-light-textSecondary dark:text-dark-textMuted hover:bg-light-alt dark:hover:bg-dark-alt transition ${isSaving ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* ── Right: actions + social — tight column, no dead space ── */}
        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          {!isOwnProfile && !!profileUserId && (
            <button
              type="button"
              onClick={handleMessageUser}
              disabled={!token}
              title={!token ? "Log in to message" : "Message this user"}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text hover:border-light-accent/50 dark:hover:border-dark-accent/50 hover:text-light-accent dark:hover:text-dark-accent disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Message
            </button>
          )}
          {isOwnProfile && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              disabled={isSaving}
              className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-light-accent hover:bg-light-accentLight dark:bg-dark-accent dark:hover:bg-dark-accentLight text-white shadow-sm transition"
            >
              Edit Profile
            </button>
          )}
          <ProfileSocialLinks profileUrl={profileUrl} editable={false} />
        </div>

      </div>
    </div>
  );
}
