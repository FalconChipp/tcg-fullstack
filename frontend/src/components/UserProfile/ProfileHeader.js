"use client";

import React, { useState, useRef, useEffect, useContext, useMemo } from "react";
import Image from "next/image";
import { AuthContext } from "@/components/Auth/AuthProvider";
import ProfileSocialLinks from "@/components/UserProfile/ProfileSocialLinks";
import {
  FaCheckCircle,
  FaCrown,
  FaEyeSlash,
  FaGem,
  FaShieldAlt,
  FaStar,
  FaStore,
} from "react-icons/fa";
import pokemonList, { getPokemonDisplaySprite } from "@/utils/pokemonListShiny";

import { useMessenger } from "@/components/Messenger/MessengerContext";
import { getApiBase, getGraphqlUrl, gqlFetch } from "@/utils/apiClient";
import { devError } from "@/utils/devLog";
import SellerReviewsDrawer from "@/components/Marketplace/SellerReviewsDrawer";
import { getSellerTier as computeSellerTier } from "@/utils/sellerTier";
import { formatCurrency } from "@/utils/formatCurrency";

/* ─── Header status badges ──────────────────────────────────────────────────
   Changed:
   - Removed the old circular/medal subscription badge.
   - Removed dependency on SellerTierBadge inside the header.
   - Seller and subscription tier are now rendered as clean profile header
     status badges directly under the username.
   - Both badges share the same size, shape, spacing, and visual language.
──────────────────────────────────────────────────────────────────────────── */

// Visual-only map: keys match SELLER_TIERS[*].key from utils/sellerTier.js
const SELLER_TIER_DISPLAY = {
  new: {
    label: "Seller",
    icon: FaStore,
    wrapper: "border-slate-600/70 bg-slate-800/70 text-slate-200 dark:border-slate-600/70 dark:bg-slate-800/70 dark:text-slate-200",
    iconBox: "bg-slate-600 text-white",
  },
  bronze: {
    label: "Seller",
    icon: FaStore,
    wrapper: "border-slate-600/70 bg-slate-800/70 text-slate-200 dark:border-slate-600/70 dark:bg-slate-800/70 dark:text-slate-200",
    iconBox: "bg-slate-600 text-white",
  },
  silver: {
    label: "Silver Seller",
    shortLabel: "Silver",
    icon: FaShieldAlt,
    wrapper: "border-zinc-400/40 bg-zinc-500/10 text-zinc-200 dark:border-zinc-400/40 dark:bg-zinc-500/10 dark:text-zinc-200",
    iconBox: "bg-zinc-300 text-zinc-950",
  },
  gold: {
    label: "Gold Seller",
    shortLabel: "Gold",
    icon: FaCheckCircle,
    wrapper: "border-amber-400/45 bg-amber-500/10 text-amber-200 dark:border-amber-400/45 dark:bg-amber-500/10 dark:text-amber-200",
    iconBox: "bg-amber-400 text-amber-950",
  },
  platinum: {
    label: "Platinum Seller",
    shortLabel: "Platinum",
    icon: FaStar,
    wrapper: "border-cyan-300/45 bg-cyan-400/10 text-cyan-100 dark:border-cyan-300/45 dark:bg-cyan-400/10 dark:text-cyan-100",
    iconBox: "bg-cyan-300 text-cyan-950",
  },
  elite: {
    label: "Elite Seller",
    shortLabel: "Elite",
    icon: FaStar,
    wrapper: "border-violet-400/45 bg-violet-500/10 text-violet-200 dark:border-violet-400/45 dark:bg-violet-500/10 dark:text-violet-200",
    iconBox: "bg-violet-400 text-violet-950",
  },
};

const SUBSCRIPTION_TIERS = {
  collector: {
    label: "Collector",
    icon: FaGem,
    wrapper:
      "border-sky-400/40 bg-sky-500/10 text-sky-200 dark:border-sky-400/40 dark:bg-sky-500/10 dark:text-sky-200",
    iconBox: "bg-sky-400 text-sky-950",
  },

  pro: {
    label: "Pro",
    icon: FaGem,
    wrapper:
      "border-violet-400/45 bg-violet-500/10 text-violet-200 dark:border-violet-400/45 dark:bg-violet-500/10 dark:text-violet-200",
    iconBox: "bg-violet-400 text-violet-950",
  },

  vendor: {
    label: "Vendor",
    icon: FaStore,
    wrapper:
      "border-amber-400/45 bg-amber-500/10 text-amber-200 dark:border-amber-400/45 dark:bg-amber-500/10 dark:text-amber-200",
    iconBox: "bg-amber-400 text-amber-950",
  },

  premium: {
    label: "Premium",
    icon: FaCrown,
    wrapper:
      "border-amber-400/45 bg-amber-500/10 text-amber-200 dark:border-amber-400/45 dark:bg-amber-500/10 dark:text-amber-200",
    iconBox: "bg-amber-400 text-amber-950",
  },

  gold: {
    label: "Gold",
    icon: FaCrown,
    wrapper:
      "border-amber-400/45 bg-amber-500/10 text-amber-200 dark:border-amber-400/45 dark:bg-amber-500/10 dark:text-amber-200",
    iconBox: "bg-amber-400 text-amber-950",
  },

  elite: {
    label: "Elite",
    icon: FaStar,
    wrapper:
      "border-rose-400/45 bg-rose-500/10 text-rose-200 dark:border-rose-400/45 dark:bg-rose-500/10 dark:text-rose-200",
    iconBox: "bg-rose-400 text-rose-950",
  },

  default: {
    label: "Member",
    icon: FaGem,
    wrapper:
      "border-vault-accent/35 bg-vault-accent/10 text-vault-accent dark:border-vault-accent/40 dark:bg-vault-accent/10 dark:text-vault-accent",
    iconBox:
      "bg-vault-accent text-vault-text dark:bg-vault-accent dark:text-vault-bg",
  },
};

function formatScore(reputation) {
  const positive = reputation?.positive ?? 0;
  const negative = reputation?.negative ?? 0;
  const neutral  = reputation?.neutral  ?? 0;
  const total    = positive + negative + neutral;
  if (total === 0) return null;
  return `${Math.round((positive / total) * 100)}%`;
}

function HeaderStatusBadge({
  icon: Icon,
  label,
  eyebrow,
  wrapper,
  iconBox,
  title,
  onClick,
}) {
  const Component = onClick ? "button" : "span";

  return (
    <Component
      type={onClick ? "button" : undefined}
      onClick={onClick}
      title={title || label}
      aria-label={title || label}
      className={`
        inline-flex h-7 items-center gap-1.5 rounded-md border
        px-1.5 pr-2 text-[11px] font-black leading-none
         transition
        hover:-translate-y-0.5 hover:
        ${onClick ? "cursor-pointer focus:outline-none focus:ring-2 focus:ring-vault-accent/40 dark:focus:ring-vault-accent/40" : ""}
        ${wrapper}
      `}
    >
      <span
        className={`
          flex h-[18px] w-[18px] shrink-0 items-center justify-center
          rounded-[5px] text-[9px] 
          ${iconBox}
        `}
      >
        <Icon />
      </span>

      <span className="flex items-center gap-1 uppercase tracking-wide">
        {eyebrow && (
          <span className="text-[9px] font-extrabold opacity-60">
            {eyebrow}
          </span>
        )}
        <span>{label}</span>
      </span>
    </Component>
  );
}

function SellerHeaderBadge({ reputation, onClick }) {
  if (!reputation) return null;

  const { tier: tierData } = computeSellerTier(reputation);
  const tier = SELLER_TIER_DISPLAY[tierData.key] ?? SELLER_TIER_DISPLAY.bronze;
  const Icon = tier.icon;

  const completed = reputation?.completedMarketplace ?? 0;
  const score = formatScore(reputation);

  const title = `${tier.label} · ${completed} completed sale${
    completed === 1 ? "" : "s"
  }${score ? ` · ${score} positive` : ""}`;

  return (
    <HeaderStatusBadge
      icon={Icon}
      label={tier.shortLabel || tier.label}
      eyebrow={tier.shortLabel ? "Seller" : undefined}
      wrapper={tier.wrapper}
      iconBox={tier.iconBox}
      title={title}
      onClick={onClick}
    />
  );
}

function SubscriptionHeaderBadge({ name }) {
  if (!name) return null;

  const key = String(name).toLowerCase().trim();

  const tier =
    SUBSCRIPTION_TIERS[key] ?? {
      ...SUBSCRIPTION_TIERS.default,
      label: name,
    };

  const Icon = tier.icon;

  return (
    <HeaderStatusBadge
      icon={Icon}
      label={tier.label}
      eyebrow="Tier"
      wrapper={tier.wrapper}
      iconBox={tier.iconBox}
      title={`${tier.label} subscription`}
    />
  );
}

const REPUTATION_QUERY = `
  query ProfileReputation($userId: ID!) {
    sellerReputation(userId: $userId) {
      score positive negative neutral completedMarketplace flagged
    }
  }
`;

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
  const [favouritePokemon, setFavouritePokemon] = useState(
    profileData?.favouritePokemon || ""
  );
  const [newProfileImage, setNewProfileImage] = useState(null);

  const [currentAvatar, setCurrentAvatar] = useState(
    profileData?.avatar || null
  );

  const [profileImagePreview, setProfileImagePreview] = useState(
    resolveavatar(profileData?.avatar)
  );

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef(null);

  const badges = profileData?.badges ?? [];
  const tceBadge = profileData?.tceBadge ?? false;
  const planName = profileData?.planName ?? null;

  const profileUserId =
    profileData?.user?.id || profileData?.userId || profileData?.id || null;

  const _pdId = profileData?.id;
  const _pdUsername = profileData?.username;
  const _pdBio = profileData?.bio;
  const _pdFav = profileData?.favouritePokemon;
  const _pdAvatar = profileData?.avatar;

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

    const variables = {
      bio,
      favouritePokemon,
      avatar: avatarForUpdate || null,
    };

    const res = await fetch(getGraphqlUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        query: updateProfileMutation,
        variables,
      }),
    });

    return res.json();
  };

  const performAvatarUpload = async () => {
    if (!newProfileImage) return null;

    const formData = new FormData();
    formData.append("avatar", newProfileImage);

    const res = await fetch(`${NEXT_PUBLIC_BACKEND_URL}/upload/avatar`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const data = await res.json();

    if (data?.ok && data?.url) return data.url;
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

  const [reputation, setReputation] = useState(null);
  const [showReviews, setShowReviews] = useState(false);

  useEffect(() => {
    if (!profileUserId) return;

    gqlFetch(REPUTATION_QUERY, { userId: profileUserId })
      .then((d) => {
        const rep = d?.sellerReputation;

        if (rep && rep.completedMarketplace > 0) {
          setReputation(rep);
        }
      })
      .catch(() => {});
  }, [profileUserId]);

  const shinyRollRef = useRef(null);

  const favSprite = useMemo(() => {
    if (!favouritePokemon) return null;

    const match = pokemonList.find(
      (p) => p.name.toLowerCase() === favouritePokemon.toLowerCase()
    );

    if (!match) return null;

    if (shinyRollRef.current === null) {
      shinyRollRef.current = Math.random() < 0.05;
    }

    const result = getPokemonDisplaySprite(match, {
      shinyChance: shinyRollRef.current ? 1 : 0,
    });

    return result.displaySprite ?? null;
  }, [favouritePokemon]);

  return (
    <div className="w-full rounded-t-2xl overflow-hidden border-t border-x border-vault-border bg-vault-surface ">
      <div className="h-1.5 w-full bg-gradient-to-r from-vault-accent via-vault-accentHover to-vault-accent dark:from-vault-accent dark:via-vault-accentHover dark:to-vault-accent" />

      <div className="px-6 sm:px-8 py-6 flex flex-col sm:flex-row gap-5 items-start">
        <div className="flex-shrink-0">
          <div
            className={`
              relative w-20 h-20 sm:w-24 sm:h-24 rounded-[6px]
              ring-2 ring-vault-accent/60 dark:ring-vault-accent/60
              ring-offset-2 ring-offset-vault-surface dark:ring-offset-vault-surface
               overflow-hidden bg-vault-raised
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

            <input
              type="file"
              accept="image/*"
              ref={fileInputRef}
              className="hidden"
              onChange={handleImageChange}
            />
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col gap-2.5">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-vault-accent leading-none">
                {username}
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {reputation && (
                <SellerHeaderBadge
                  reputation={reputation}
                  onClick={() => setShowReviews(true)}
                />
              )}

              {planName && <SubscriptionHeaderBadge name={planName} />}

              {tceBadge && (
                <span className="inline-flex h-7 items-center rounded-md border border-vault-accent/30 bg-vault-accent/10 px-2 text-[11px] font-black uppercase tracking-wide text-vault-accent dark:border-vault-accent/30 dark:bg-vault-accent/10 dark:text-vault-accent">
                  TCE
                </span>
              )}

              {badges.map((badge, i) => (
                <span
                  key={i}
                  className="inline-flex h-7 items-center rounded-md border border-vault-accent/20 bg-vault-accentHover/10 px-2 text-[11px] font-black uppercase tracking-wide text-vault-accent dark:border-vault-accent/30 dark:bg-vault-accentHover/10 dark:text-vault-accent"
                >
                  {badge}
                </span>
              ))}
            </div>
          </div>

          {!isEditing ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="text-sm text-vault-text leading-relaxed">
                {bio || (
                  <span className="text-vault-textTertiary italic">
                    No bio yet.
                  </span>
                )}
              </p>

              {favouritePokemon && (
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className="text-vault-textTertiary">
                    ·
                  </span>

                  {favSprite && (
                    <img
                      src={favSprite}
                      alt={favouritePokemon}
                      className="w-7 h-7 object-contain drop-"
                      style={{ imageRendering: "pixelated" }}
                    />
                  )}

                  <span className="text-sm text-vault-textSecondary dark:text-vault-textTertiary">
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
                className="flex-1 px-3 py-2 rounded-[6px] text-sm border bg-vault-raised border-vault-border text-vault-text placeholder:text-vault-textTertiary dark:placeholder:text-vault-textTertiary focus:outline-none focus:ring-2 focus:ring-vault-accent dark:focus:ring-vault-accent transition resize-none"
              />

              <input
                type="text"
                value={favouritePokemon}
                onChange={(e) => setFavouritePokemon(e.target.value)}
                placeholder="Favourite Pokémon…"
                disabled={isSaving}
                className="sm:w-48 px-3 py-2 rounded-[6px] text-sm border bg-vault-raised border-vault-border text-vault-text placeholder:text-vault-textTertiary dark:placeholder:text-vault-textTertiary focus:outline-none focus:ring-2 focus:ring-vault-accent dark:focus:ring-vault-accent transition"
              />
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3 mt-0.5">
            {collectionValue > 0 && !hideCollectionValue && (
              <div className="flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-[6px]">
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
              <div className="flex items-center gap-1.5 text-xs text-vault-textTertiary">
                <FaEyeSlash className="opacity-60" />
                <span>Value hidden</span>
              </div>
            )}
          </div>

          {isEditing && (
            <div className="flex gap-2 mt-1">
              <button
                type="button"
                onClick={handleSaveAllChanges}
                disabled={isSaving}
                className={`px-4 py-1.5 rounded-[6px] text-sm font-bold bg-vault-accent hover:bg-vault-accentHover dark:bg-vault-accent dark:hover:bg-vault-accentHover text-white transition ${
                  isSaving ? "opacity-60 cursor-not-allowed" : ""
                }`}
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
                className={`px-4 py-1.5 rounded-[6px] text-sm font-semibold border border-vault-border bg-transparent text-vault-textSecondary dark:text-vault-textTertiary hover:bg-vault-raised dark:hover:bg-vault-raised transition ${
                  isSaving ? "opacity-60 cursor-not-allowed" : ""
                }`}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 flex flex-col items-end gap-2">
          {!isOwnProfile && !!profileUserId && (
            <button
              type="button"
              onClick={handleMessageUser}
              disabled={!token}
              title={!token ? "Log in to message" : "Message this user"}
              className="inline-flex items-center px-3 py-1.5 rounded-[6px] text-xs font-semibold border border-vault-border bg-vault-raised text-vault-text hover:border-vault-accent/50 dark:hover:border-vault-accent/50 hover:text-vault-accent dark:hover:text-vault-accent disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Message
            </button>
          )}

          {isOwnProfile && !isEditing && (
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              disabled={isSaving}
              className="inline-flex items-center px-3 py-1.5 rounded-[6px] text-xs font-semibold bg-vault-accent hover:bg-vault-accentHover dark:bg-vault-accent dark:hover:bg-vault-accentHover text-white  transition"
            >
              Edit Profile
            </button>
          )}

          <ProfileSocialLinks profileUrl={profileUrl} editable={false} />
        </div>
      </div>

      <SellerReviewsDrawer
        sellerId={profileUserId}
        sellerUsername={username}
        open={showReviews}
        onClose={() => setShowReviews(false)}
      />
    </div>
  );
}