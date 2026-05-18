"use client";
import Head from "next/head";
import React, { useContext, useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout/Layout";
import ProfileHeader from "@/components/UserProfile/ProfileHeader";
import { AuthContext } from "@/components/Auth/AuthProvider";
import StatusMessage from "@/components/UI/StatusMessage";
import { useTheme } from "@/hooks/ThemeProvider";
import CardDetailsModal from "@/components/UserProfile/CardDetailsModal";
import useProfileCollection from "@/hooks/useProfileCollection";
import useProfileCardActions from "@/hooks/useProfileCardActions";
import ProfileTabs from "@/components/UserProfile/ProfileTabs";
import ProfileCollectionPanel from "@/components/UserProfile/ProfileCollectionPanel";
import ProfileBindersPanel from "@/components/UserProfile/ProfileBindersPanel";
import ProfileWishlistPanel from "@/components/UserProfile/ProfileWishlistPanel";
import ProfileAchievements from "@/components/UserProfile/ProfileAchievements";
import useWishlistData from "@/hooks/useWishlistData";

// GraphQL endpoints
const API_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;
const WP_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT;

// --- SSR user fetch from Node backend ---
export async function getServerSideProps({ params, res }) {
  const { username } = params;
  if (!username) return { notFound: true };

  res.setHeader("Cache-Control", "no-store");
  const userQuery = `
    query GetUser($username: String!) {
      userProfile(username: $username) {
        id
        userId
        bio
        favouritePokemon
        avatar
        user {
          id
          username
          email
          avatar
          emailVerified
          createdAt
          updatedAt
        }
      }
    }
  `;
  try {
    const r = await fetch(API_GRAPHQL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: userQuery, variables: { username } }),
    });
    const { data, errors } = await r.json();

    if (errors || !data?.userProfile) {
      return errors
        ? { props: { error: errors[0].message } }
        : { notFound: true };
    }

    const profile = data.userProfile;
    const mergedUser = {
      ...profile,
      username: profile.user?.username,
      email: profile.user?.email,
      emailVerified: profile.user?.emailVerified,
    };
    delete mergedUser.user;

    return { props: { user: mergedUser } };
  } catch (err) {
    return { props: { error: "Remote server error" } };
  }
}

export default function ProfilePage({ user, error }) {
  const { user: me, token, loading: authLoading } = useContext(AuthContext);
  const { dark } = useTheme();
  const router = useRouter();
  const isOwnProfile = me?.username === user?.username;

  // Always use the real account user id for GraphQL queries (not the profile id)
  const UID = String(user?.userId ?? user?.id);
  // Memoised so the object reference is stable across parent re-renders —
  // prevents ProfileHeader's useEffect from firing and resetting edit state.
  const userForQueries = useMemo(() => ({ ...user, id: UID }), [user, UID]);

  // 1. Read tab from ?tab= in URL for deep linking
  const [activeTab, setActiveTab] = useState("collection");
  useEffect(() => {
    if (router.query.tab && typeof router.query.tab === "string") {
      setActiveTab(router.query.tab);
    }
  }, [router.query.tab]);

  const [isBinderEditorOpen, setBinderEditorOpen] = useState(false);

  // --- Achievements ---
  const [achievements, setAchievements] = useState([]);
  const [achievementsLoading, setAchievementsLoading] = useState(true);
  useEffect(() => {
    async function fetchAchievements() {
      if (!UID) return;
      setAchievementsLoading(true);
      try {
        const res = await fetch(WP_GRAPHQL_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `
              query GetUserAchievements($userId: ID!) {
                userAchievements(userId: $userId) {
                  id
                  earnedAt
                  achievement {
                    id
                    code
                    name
                    description
                    tier
                    iconUrl
                    createdAt
                    updatedAt
                  }
                }
              }
            `,
            variables: { userId: UID }
          }),
        });
        const json = await res.json();
        setAchievements(json.data?.userAchievements ?? []);
      } catch (e) {
        setAchievements([]);
      }
      setAchievementsLoading(false);
    }
    fetchAchievements();
  }, [UID]);

  const {
    collection, loading, collectionValue,
    refresh, status,
    showCardDetails, setShowCardDetails, cardDetails
  } = useProfileCollection({ userId: UID, token });

  // --- Wishlist data (provides wishlist state + setter) ---
  const {
    wishlist: wl,
    setWishlist,             // <-- real setter
    loading: wlLoading,
    error: wlError,
    refresh: refreshWishlist // <-- expose refetch function
  } = useWishlistData({
    isOwnProfile,
    userId: UID,
    token,
    page: 1, pageSize: 25
  });

  const {
    handleMoveToCollection, handleRemoveCard,
    handleRemoveFromWishlist
  } = useProfileCardActions({
    isOwnProfile,
    token,
    setStatus: status.set,
    setCollection: collection.set,
    setWishlist,            // <-- pass the real setter (fixes setWishlist crash)
    setLoading: loading.set,
    collection: collection.value,
    wishlist: wl,
    userId: UID,
    refresh,
    refreshWishlist         // <-- let actions refresh wishlist after mutations
  });

  // --- Render ---
  if (authLoading && !user) {
    return (
      <Layout>
        <div className="text-center p-10">Loading authentication...</div>
      </Layout>
    );
  }
  if (error) {
    return (
      <Layout>
        <p className="error text-center p-10">{error}</p>
      </Layout>
    );
  }
  if (!user) {
    return (
      <Layout>
        <p className="text-center p-10">Profile not found.</p>
      </Layout>
    );
  }

  return (
    <>
      <Head>
        <title>{`${user.username}'s Profile – SixByFive TCG`}</title>
        <meta
          name="description"
          content={user?.bio || "Check out my Pokémon TCG collection!"}
        />
        <link
          rel="canonical"
          href={`https://tcg.sixbyfive.com/profile/${user.username}`}
        />
        <meta
          property="og:title"
          content={`${user.username}'s Profile – SixByFive TCG`}
        />
        <meta
          property="og:description"
          content={user?.bio || "Check out my Pokémon TCG collection!"}
        />
        <meta
          property="og:url"
          content={`https://tcg.sixbyfive.com/profile/${user.username}`}
        />
        <meta property="og:image" content={user?.avatar || "/default-avatar.png"} />
        <meta property="og:type" content="profile" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content={`${user.username}'s Profile – SixByFive TCG`}
        />
        <meta
          name="twitter:description"
          content={user?.bio || "Check out my Pokémon TCG collection!"}
        />
        <meta
          name="twitter:image"
          content={user?.avatar || "/default-avatar.png"}
        />
      </Head>
      <Layout hideBackTop={isBinderEditorOpen}>
        <div className="w-full px-2 sm:px-4 md:px-8 lg:px-24 xl:px-32 py-6">
          <ProfileHeader
            profileData={userForQueries}
            isOwnProfile={isOwnProfile}
            onEdit={refresh}
            dark={dark}
            collectionValue={collectionValue.value}
          />

          {/* MVP Tabs */}
          <ProfileTabs activeTab={activeTab} onChange={setActiveTab} />

          {/* Tab Panels */}
          {activeTab === "collection" && (
            <ProfileCollectionPanel
              userId={UID}
              cards={collection.value}
              isOwnProfile={isOwnProfile}
              setStatus={status.set}
              onCardRemoved={handleRemoveCard}
            />
          )}

          {activeTab === "binders" && (
            <ProfileBindersPanel
              userId={UID}
              isOwnProfile={isOwnProfile}
              dark={dark}
              userEntireCollection={collection?.value || []}
              onBinderEditorOpen={() => setBinderEditorOpen(true)}
              onBinderEditorClose={() => setBinderEditorOpen(false)}
            />
          )}

          {activeTab === "wishlist" && (
            <ProfileWishlistPanel
              wishlist={wl?.entries || []}
              isOwnProfile={isOwnProfile}
              onCardRemoved={handleRemoveFromWishlist}
              onMoveToCollection={handleMoveToCollection}
              setToastStatus={status.set}     // ✅ renamed
              setWishlist={setWishlist}       // ✅ from useWishlistData
              refreshWishlist={refreshWishlist} // ✅ from useWishlistData
              dark={dark}
            />
          )}

          {activeTab === "achievements" && (
            <ProfileAchievements
              achievements={achievements}
              loading={achievementsLoading}
            />
          )}

          {/* Card details modal */}
          {showCardDetails && cardDetails && (
            <CardDetailsModal
              card={cardDetails}
              onClose={() => setShowCardDetails(false)}
            />
          )}

          {/* Collection loader */}
          {loading.value && (
            <div className="w-full py-12 text-center text-gray-400">
              Loading cards...
            </div>
          )}

          {/* Status messages */}
          {status.value && (
            <StatusMessage
              type={status.value.type}
              message={status.value.msg}
              onClose={() => status.set(null)}
            />
          )}
        </div>
      </Layout>
    </>
  );
}
