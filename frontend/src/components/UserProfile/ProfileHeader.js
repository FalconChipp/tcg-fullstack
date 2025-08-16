"use client";

import React, { useState, useRef, useEffect, useContext } from "react";
import Image from "next/image";
import { AuthContext } from "@/components/Auth/AuthProvider";
import ProfileSocialLinks from "@/components/UserProfile/ProfileSocialLinks";
// import ProfileReputation from "@/components/UserProfile/ProfileReputation";
import { FaLink } from "react-icons/fa";

const WP_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;

// Currency formatter
const formatCurrency = (value) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

export default function ProfileHeader({
  profileData,
  isOwnProfile,
  onEdit,
  dark,
  collectionValue = 0,
}) {
  const { token } = useContext(AuthContext);

  // Backend URLs
  // Always ensure NEXT_PUBLIC_BACKEND_URL includes protocol!
const rawBackendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
const NEXT_PUBLIC_BACKEND_URL = rawBackendUrl.startsWith("http")
  ? rawBackendUrl
  : `https://${rawBackendUrl}`;

// Avatar URL resolver
const resolveavatar = (avatar) => {
  if (!avatar) return "https://placehold.co/100/webp";
  if (avatar.startsWith("http")) return avatar;
  // Ensure leading slash for the avatar path (avoid double slash or missing slash)
  const path = avatar.startsWith("/") ? avatar : `/${avatar}`;
  return `${NEXT_PUBLIC_BACKEND_URL}${path}`;
};


  // Editable State
  const [username, setUsername] = useState(profileData?.username || "Username");
  const [bio, setBio] = useState(profileData?.bio || "");
  const [favouritePokemon, setFavouritePokemon] = useState(
    profileData?.favouritePokemon || ""
  );
  const [newProfileImage, setNewProfileImage] = useState(null);

  // NEW: Hold avatar *path* (what's in the DB), always a path or null
  const [currentAvatar, setCurrentAvatar] = useState(profileData?.avatar || null); // CHANGED

  // Preview can be data URI or resolved URL—used only for display
  const [profileImagePreview, setProfileImagePreview] = useState(
    resolveavatar(profileData?.avatar)
  );

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  // XP/Level defaults
  const xp = profileData?.xp ?? 0;
  const xpMax = profileData?.xpMax ?? 100;
  const level = profileData?.level ?? 1;
  const badges = profileData?.badges ?? [];
  const tceBadge = profileData?.tceBadge ?? false;

  // Reputation fields
  const repScore = profileData?.reputation?.score ?? 0;
  const repMonthly = profileData?.reputation?.monthlyChange ?? 0;
  const repYearly = profileData?.reputation?.yearlyChange ?? 0;
  const repTrustLevel = profileData?.reputation?.trustLevel ?? "Standard";
  const repLog = profileData?.reputation?.repLog ?? [];

  const xpPercent = Math.min(Math.round((xp / xpMax) * 100), 100);

  // Reset fields when profileData changes
  useEffect(() => {
    setUsername(profileData?.username || "Username");
    setBio(profileData?.bio || "");
    setFavouritePokemon(profileData?.favouritePokemon || "");
    setProfileImagePreview(resolveavatar(profileData?.avatar));
    setCurrentAvatar(profileData?.avatar || null); // CHANGED
    setNewProfileImage(null);
  }, [profileData]);

  // ---- Image upload logic ----
  const handleChooseImage = () => isEditing && fileInputRef.current?.click();
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setProfileImagePreview(reader.result); // preview only
      reader.readAsDataURL(file);
    }
  };

  // Profile link for sharing
  const profileUrl =
    typeof window !== "undefined" ? window.location.href : "";

  // --- Main mutation for updating profile fields ---
  // Only ever send the DB value/path for avatar!
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
          user {
            id
            username
            email
            avatar
            emailVerified
          }
        }
      }
    `;

    const variables = {
      bio,
      favouritePokemon,
      avatar: avatarForUpdate || null, // CHANGED: always a path or null
    };
    const res = await fetch(WP_GRAPHQL_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query: updateProfileMutation, variables }),
    });
    return res.json();
  };

  // --- Avatar upload logic (REST endpoint) ---
  const performAvatarUpload = async () => {
    if (!newProfileImage) return null;

    const formData = new FormData();
    formData.append("avatar", newProfileImage);

    const res = await fetch(`${NEXT_PUBLIC_BACKEND_URL}/upload/avatar`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await res.json();
    if (data?.success && data?.avatar) {
      return data.avatar; // <-- e.g. "/uploads/avatars/Foo_12345.png"
    } else {
      throw new Error(data?.error || "Avatar upload failed");
    }
  };

  // --- Save profile logic (fully updated) ---
  const handleSaveAllChanges = async () => {
    if (!isOwnProfile || !token) return;
    setIsSaving(true);

    // Always start from currentAvatar (DB-safe value)
    let avatarToSend = currentAvatar; // CHANGED

    // If user picked a new file, upload it first (returns path)
    if (newProfileImage) {
      try {
        const uploadedUrl = await performAvatarUpload();
        if (uploadedUrl) {
          avatarToSend = uploadedUrl; // CHANGED
          setProfileImagePreview(resolveavatar(uploadedUrl)); // for UI
          setCurrentAvatar(uploadedUrl); // for DB
          setNewProfileImage(null);
        }
      } catch (uploadError) {
        console.error("Avatar upload failed", uploadError);
      }
    }

    // Now update text fields (and avatar path)
    try {
      const json = await updateProfileTextAndFinalAvatar(avatarToSend);
      if (json?.data?.updateProfile) {
        const serverProfile = json.data.updateProfile;
        setBio(serverProfile.bio || "");
        setFavouritePokemon(serverProfile.favouritePokemon || "");
        setProfileImagePreview(resolveavatar(serverProfile.avatar));
        setCurrentAvatar(serverProfile.avatar);
        setIsEditing(false);
        if (onEdit) onEdit(serverProfile);
      } else {
        console.error("Failed to update profile", json);
        setIsEditing(false);
      }
    } catch (e) {
      console.error("Profile update failed", e);
      setIsEditing(false);
    }
    setIsSaving(false);
  };

  // ---- RENDER ----
  return (
    <div
      className={`
        w-full shadow-lg
        rounded-t-2xl
        p-6 sm:p-8
        bg-light-surface dark:bg-dark-surface
        border-t border-x border-light-border dark:border-dark-border
        grid grid-cols-1 lg:grid-cols-12 gap-8
        items-stretch
      `}
    >
      {/* Left: Avatar */}
      <div className="lg:col-span-2 flex flex-col items-center lg:items-start justify-center">
        <div
          className={`
            relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden
            bg-light-alt dark:bg-dark-alt
            border-4 ${dark ? "border-dark-accent" : "border-light-accent"}
            ${isEditing ? "cursor-pointer hover:opacity-80" : ""}
            shadow-xl
            mx-auto
          `}
          onClick={handleChooseImage}
        >
          <Image
            src={profileImagePreview}
            alt={`${username}'s avatar`}
            fill
            className="object-cover w-full h-full"
            priority
          />
          {isEditing && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white font-semibold">
              Change Image
            </div>
          )}
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            className="hidden"
            onChange={handleImageChange}
          />
        </div>
      </div>

      {/* Center: Main Info */}
      <div className="lg:col-span-6 flex flex-col min-w-0 justify-center">
        {/* Username/Badges/Level row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <span className="text-2xl sm:text-3xl font-extrabold text-light-accent dark:text-dark-accent">
            {username}
          </span>
          {tceBadge && (
            <span className="ml-2 px-2 py-1 rounded-md text-xs font-bold bg-light-accent dark:bg-dark-accent text-white">
              <span role="img" aria-label="TCE">
                ✨
              </span>{" "}
              TCE
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
          {isOwnProfile && !isEditing && (
            <button
              className="ml-auto sm:ml-6 bg-light-accent hover:bg-light-accentLight dark:bg-dark-accent dark:hover:bg-dark-accentLight text-white font-bold px-4 py-2 rounded-xl shadow text-sm transition"
              onClick={() => setIsEditing(true)}
              disabled={isSaving}
            >
              Edit Profile
            </button>
          )}
        </div>
        {/* XP/Level, Value, etc */}
        <div className="flex flex-wrap items-center gap-4 mt-3 mb-2">
          {collectionValue > 0 && (
            <div className="flex items-center gap-2 bg-light-alt dark:bg-dark-alt px-3 py-1 rounded-xl">
              <span className="text-xs font-semibold text-light-textMuted dark:text-dark-textMuted">
                Collection Value:
              </span>
              <span className="text-sm font-bold text-green-700 dark:text-green-400">
                {formatCurrency(collectionValue)}
              </span>
            </div>
          )}
        </div>
        {/* Bio and Favorite Pokémon */}
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
              Favorite Pokémon
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
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
            <button
              onClick={() => {
                setBio(profileData.bio || "");
                setFavouritePokemon(profileData.favouritePokemon || "");
                setNewProfileImage(null);
                setProfileImagePreview(resolveavatar(profileData.avatar));
                setCurrentAvatar(profileData.avatar || null); // ADDED
                setIsEditing(false);
              }}
              className={`px-6 py-2 rounded-lg font-bold transition-colors
                border border-light-border dark:border-dark-border bg-light-surface dark:bg-dark-surface text-light-accent dark:text-dark-accent
                hover:bg-light-accent/10 dark:hover:bg-dark-accent/20
                ${isSaving ? "opacity-60 cursor-not-allowed" : ""}
              `}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Right: Reputation on large screens only, with share profile under it */}
      <div className="lg:col-span-4 flex flex-col gap-4 justify-center h-full">
        <div className="w-full">
          {/* 
          <ProfileReputation
            score={repScore}
            trustLevel={repTrustLevel}
            monthlyChange={repMonthly}
            yearlyChange={repYearly}
            repLog={repLog}
          />
          */}
        </div>
        {/* Social Links Section */}
        <div className="mt-4 flex flex-col gap-2 w-full">
          <h3 className="font-semibold text-light-accent dark:text-dark-accent text-xs mb-1 uppercase tracking-wide">
            Social Links
          </h3>
          {isEditing ? (
            <div className="flex items-center gap-3 flex-wrap">
              {/* Placeholder for social links editing */}
            </div>
          ) : (
            <ProfileSocialLinks
              // links={socialLinks}
              profileUrl={profileUrl}
              editable={false}
            />
          )}
        </div>
      </div>
    </div>
  );
}
