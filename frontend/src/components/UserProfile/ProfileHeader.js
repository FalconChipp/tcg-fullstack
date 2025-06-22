"use client";

import React, { useState, useRef, useEffect, useContext } from "react";
import Image from "next/image";
import { AuthContext } from "@/components/Auth/AuthProvider";
import ProfileSocialLinks from "@/components/UserProfile/ProfileSocialLinks";
import ProfileReputation from "@/components/UserProfile/ProfileReputation";
import { FaLink } from "react-icons/fa";

// Currency formatter
const formatCurrency = (value) =>
  new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);

const SOCIAL_KEYS = ["discord", "twitter", "instagram", "youtube", "link"];

export default function ProfileHeader({
  profileData,
  isOwnProfile,
  onEdit,
  dark,
  collectionValue = 0,
}) {
  const { token } = useContext(AuthContext);

  // Editable State
  const [username, setUsername] = useState(profileData?.username || "Username");
  const [bio, setBio] = useState(profileData?.userProfile?.bio || "");
  const [favoritePokemon, setFavoritePokemon] = useState(profileData?.userProfile?.favoritePokemon || "");
  const [socialLinks, setSocialLinks] = useState(profileData?.userProfile?.socialLinks || {});
  const [newProfileImage, setNewProfileImage] = useState(null);
  const [profileImagePreview, setProfileImagePreview] = useState(
    profileData?.userProfile?.avatarUrl || "https://placehold.co/100/webp"
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

  useEffect(() => {
    setUsername(profileData?.username || "Username");
    setBio(profileData?.userProfile?.bio || "");
    setFavoritePokemon(profileData?.userProfile?.favoritePokemon || "");
    setSocialLinks(profileData?.userProfile?.socialLinks || {});
    setProfileImagePreview(
      profileData?.userProfile?.avatarUrl || "https://placehold.co/100/webp"
    );
    setNewProfileImage(null);
  }, [profileData]);

  // ---- Image upload logic ----
  const handleChooseImage = () => isEditing && fileInputRef.current?.click();
  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setNewProfileImage(file);
      const reader = new FileReader();
      reader.onloadend = () => setProfileImagePreview(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // Social link change handler
  const handleSocialLinkChange = (key, value) => {
    setSocialLinks((prev) => ({ ...prev, [key]: value }));
  };

  // Profile link for sharing
  const profileUrl = typeof window !== "undefined"
    ? window.location.href
    : "";

  // GraphQL update
  const WP_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:4000/graphql";
  const updateProfileTextAndFinalAvatar = async (avatarUrlForUpdate) => {
    const updateMutation = `
      mutation UpdateProfile($bio: String, $favoritePokemon: String, $avatarUrl: String, $socialLinks: JSON) {
        updateUserProfile(input: {
          bio: $bio,
          favoritePokemon: $favoritePokemon,
          avatarUrl: $avatarUrl,
          socialLinks: $socialLinks
        }) {
          userProfile { bio favoritePokemon avatarUrl socialLinks }
        }
      }
    `;
    const variables = {
      bio,
      favoritePokemon,
      avatarUrl: avatarUrlForUpdate,
      socialLinks,
    };
    const res = await fetch(WP_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: updateMutation, variables }),
    });
    return res.json();
  };

  // Avatar upload (returns url)
  const performAvatarUpload = async () => {
    if (!newProfileImage) return null;
    const reader = new FileReader();
    const base64Image = await new Promise((resolve, reject) => {
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(newProfileImage);
    });
    const uploadMutation = `
      mutation UploadAvatar($fileBase64: String!) {
        uploadUserAvatar(input: { fileBase64: $fileBase64 }) { avatarUrl }
      }
    `;
    const variables = { fileBase64: base64Image };
    const res = await fetch(WP_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ query: uploadMutation, variables }),
    });
    const json = await res.json();
    if (json?.data?.uploadUserAvatar?.avatarUrl) {
      return json.data.uploadUserAvatar.avatarUrl;
    } else {
      throw new Error(json?.errors?.[0]?.message || "Unknown avatar upload error");
    }
  };

  // Save profile logic
  const handleSaveAllChanges = async () => {
    if (!isOwnProfile || !token) return;
    setIsSaving(true);
    let finalAvatarUrlToSave = profileImagePreview.startsWith("data:")
      ? profileData.userProfile?.avatarUrl
      : profileImagePreview;

    if (newProfileImage) {
      try {
        const uploadedUrl = await performAvatarUpload();
        if (uploadedUrl) {
          finalAvatarUrlToSave = uploadedUrl;
          setProfileImagePreview(uploadedUrl);
          setNewProfileImage(null);
        }
      } catch (uploadError) {
        console.error("Avatar upload failed", uploadError);
      }
    }

    try {
      const json = await updateProfileTextAndFinalAvatar(finalAvatarUrlToSave);
      if (json?.data?.updateUserProfile?.userProfile) {
        const serverProfile = json.data.updateUserProfile.userProfile;
        setBio(serverProfile.bio || "");
        setFavoritePokemon(serverProfile.favoritePokemon || "");
        setProfileImagePreview(serverProfile.avatarUrl || "https://placehold.co/100/webp");
        setSocialLinks(serverProfile.socialLinks || {});
        setIsEditing(false);
        if (onEdit) {
          const updatedFullProfileData = {
            ...profileData,
            username: username,
            userProfile: {
              ...(profileData.userProfile || {}),
              bio: serverProfile.bio,
              favoritePokemon: serverProfile.favoritePokemon,
              avatarUrl: serverProfile.avatarUrl,
              socialLinks: serverProfile.socialLinks,
            },
          };
          onEdit(updatedFullProfileData);
        }
      }
    } catch (e) {
      console.error("Profile update failed", e);
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
        <span className="text-2xl sm:text-3xl font-extrabold text-light-accent dark:text-dark-accent">{username}</span>
        {tceBadge && (
          <span className="ml-2 px-2 py-1 rounded-md text-xs font-bold bg-light-accent dark:bg-dark-accent text-white">
            <span role="img" aria-label="TCE">✨</span> TCE
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
        {/* 
        <div className="flex items-center gap-2">
          <span className="text-light-accentLight dark:text-dark-accentLight font-bold text-base">XP:</span>
          <div className="w-32 h-3 bg-light-alt dark:bg-dark-alt rounded-full relative overflow-hidden">
            <div
              className="bg-gradient-to-r from-light-accent to-dark-accent h-3 rounded-full"
              style={{ width: `${xpPercent}%` }}
            />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xs text-white font-bold">
              {xp} / {xpMax}
            </span>
          </div>
          <span className="ml-2 text-white text-base font-semibold">Level {level}</span>
        </div>
        */}
        {collectionValue > 0 && (
          <div className="flex items-center gap-2 bg-light-alt dark:bg-dark-alt px-3 py-1 rounded-xl">
            <span className="text-xs font-semibold text-light-textMuted dark:text-dark-textMuted">Collection Value:</span>
            <span className="text-sm font-bold text-green-700 dark:text-green-400">{formatCurrency(collectionValue)}</span>
          </div>
        )}
      </div>
      {/* Bio and Favorite Pokémon */}
      <div className="flex flex-col sm:flex-row gap-4 mt-2">
        <div className="flex-1">
          <h3 className="font-semibold text-light-accent dark:text-dark-accent text-xs mb-1 uppercase tracking-wide">Bio</h3>
          {isEditing ? (
            <textarea
              value={bio}
              onChange={e => setBio(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition"
              rows="2"
              placeholder="Write something about yourself..."
              disabled={isSaving}
            />
          ) : (
            <p className="text-light-textSecondary dark:text-dark-textMuted text-base">{bio || "No bio provided."}</p>
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-light-accent dark:text-dark-accent text-xs mb-1 uppercase tracking-wide">Favorite Pokémon</h3>
          {isEditing ? (
            <input
              type="text"
              value={favoritePokemon}
              onChange={e => setFavoritePokemon(e.target.value)}
              className="w-full px-4 py-2 rounded-lg border bg-light-surface dark:bg-dark-surface border-light-border dark:border-dark-border text-light-text dark:text-dark-text focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition"
              placeholder="e.g. Umbreon"
              disabled={isSaving}
            />
          ) : (
            <p className="text-light-textSecondary dark:text-dark-textMuted text-base">{favoritePokemon || "Not specified."}</p>
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
              setBio(profileData.userProfile?.bio || "");
              setFavoritePokemon(profileData.userProfile?.favoritePokemon || "");
              setNewProfileImage(null);
              setProfileImagePreview(profileData.userProfile?.avatarUrl || "https://placehold.co/100/webp");
              setSocialLinks(profileData.userProfile?.socialLinks || {});
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
        <h3 className="font-semibold text-light-accent dark:text-dark-accent text-xs mb-1 uppercase tracking-wide">Social Links</h3>
        {isEditing ? (
          <div className="flex items-center gap-3 flex-wrap">
            {SOCIAL_KEYS.map((type) => (
              <input
                key={type}
                type="text"
                value={socialLinks?.[type] || ""}
                onChange={e => handleSocialLinkChange(type, e.target.value)}
                className="w-44 px-2 py-1 rounded border border-light-border dark:border-dark-border bg-light-alt dark:bg-dark-alt text-light-text dark:text-dark-text placeholder:text-light-textMuted dark:placeholder:text-dark-textMuted focus:outline-none focus:ring-2 focus:ring-light-accent dark:focus:ring-dark-accent transition"
                placeholder={type.charAt(0).toUpperCase() + type.slice(1)}
                disabled={isSaving}
              />
            ))}
          </div>
        ) : (
          <ProfileSocialLinks
            links={socialLinks}
            profileUrl={profileUrl}
            editable={false}
          />
        )}
      </div>
    </div>
  </div>
);

}
