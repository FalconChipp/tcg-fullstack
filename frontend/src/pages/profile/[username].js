"use client";
import Head from "next/head";
import React, { useContext, useState, useEffect } from "react";
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
// ...other imports as needed

// GraphQL endpoints
const API_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:4000/graphql";
const WP_GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || "http://localhost:4000/graphql";

// --- SSR user fetch from Node backend ---
export async function getServerSideProps({ params, res }) {
  const { username } = params;
  if (!username) return { notFound: true };

  res.setHeader("Cache-Control", "no-store");
  const userQuery = `
    query GetUser($username: String!) {
      userProfile(username: $username) {
        id
        bio
        favouritePokemon
        avatar
        user {
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
    console.log({ data, errors })
    if (errors || !data?.userProfile) {
      return errors
        ? { props: { error: errors[0].message } }
        : { notFound: true };
    }
    const profile = data.userProfile;
    const mergedUser = {
      ...profile.user,
      ...profile
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

  // 1. Read tab from ?tab= in URL for deep linking
  const [activeTab, setActiveTab] = useState("collection");
  useEffect(() => {
    if (router.query.tab && typeof router.query.tab === "string") {
      setActiveTab(router.query.tab);
    }
  }, [router.query.tab]);

  const [isBinderEditorOpen, setBinderEditorOpen] = useState(false);

  // --- Fetch profile modules from WP backend (until migrated) ---
  // Example: achievements
  const [achievements, setAchievements] = useState([]);
  const [achievementsLoading, setAchievementsLoading] = useState(true);
  useEffect(() => {
    async function fetchAchievements() {
      if (!user?.id) return;
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
                  imageUrl
                  createdAt
                  updatedAt
                }
              }
            }
            `,
            variables: { userId: user.id }
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
  }, [user?.id]);

  // Example: useProfileCollection and useProfileCardActions can still point to WP backend
  // Or: If you want, use two sets of hooks and merge results
  // For now, keep your current hooks as is:
  const {
    collection, wishlist, loading, collectionValue,
    refresh, status,
    showCardDetails, setShowCardDetails, cardDetails
  } = useProfileCollection({ user, token });
  console.log("Current user for collection fetch:", user);
  const {
    handleMoveToCollection, handleRemoveCard,
    handleRemoveFromWishlist
  } = useProfileCardActions({
    isOwnProfile,
    token,
    setStatus: status.set,
    setCollection: collection.set,
    setWishlist: wishlist.set,
    setLoading: loading.set,
    collection: collection.value,
    wishlist: wishlist.value,
    userId: user?.id,
    refresh
  });

  // --- Render ---
  if (authLoading && !user) return <Layout><div className="text-center p-10">Loading authentication...</div></Layout>;
  if (error) return <Layout><p className="error text-center p-10">{error}</p></Layout>;
  if (!user) return <Layout><p className="text-center p-10">Profile not found.</p></Layout>;

  return (
    <>
      <Head>
        <title>{`${user.username}'s Profile – SixByFive TCG`}</title>
        <meta name="description" content={user?.bio || "Check out my Pokémon TCG collection!"} />
        <link rel="canonical" href={`https://tcg.sixbyfive.com/profile/${user.username}`} />
        <meta property="og:title" content={`${user.username}'s Profile – SixByFive TCG`} />
        <meta property="og:description" content={user?.bio || "Check out my Pokémon TCG collection!"} />
        <meta property="og:url" content={`https://tcg.sixbyfive.com/profile/${user.username}`} />
        <meta property="og:image" content={user?.avatar || '/default-avatar.png'} />
        <meta property="og:type" content="profile" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${user.username}'s Profile – SixByFive TCG`} />
        <meta name="twitter:description" content={user?.bio || "Check out my Pokémon TCG collection!"} />
        <meta name="twitter:image" content={user?.avatar || '/default-avatar.png'} />
      </Head>
      <Layout hideBackTop={isBinderEditorOpen}>
        <div className="w-full px-2 sm:px-4 md:px-8 lg:px-24 xl:px-32 py-6">
          <ProfileHeader
            profileData={user}
            isOwnProfile={isOwnProfile}
            onUpdate={refresh}
            dark={dark}
            collectionValue={collectionValue.value}
          />

          {/* MVP Tabs */}
          <ProfileTabs activeTab={activeTab} onChange={setActiveTab} />

          {/* Tab Panels */}
          {activeTab === "collection" &&
            <ProfileCollectionPanel
              userId={user?.id}
              cards={collection.value}
              isOwnProfile={isOwnProfile}
              setStatus={status.set}
              onCardRemoved={handleRemoveCard}
            />
          }
          {activeTab === "binders" && (
            <ProfileBindersPanel
              userId={user?.id}
              isOwnProfile={isOwnProfile}
              dark={dark}
              userEntireCollection={collection?.value || []}
              onBinderEditorOpen={() => setBinderEditorOpen(true)}
              onBinderEditorClose={() => setBinderEditorOpen(false)}
            />
          )}
          {activeTab === "wishlist" &&
            <ProfileWishlistPanel
              user={user}
              wishlist={wishlist.value}
              isOwnProfile={isOwnProfile}
              onCardRemoved={handleRemoveFromWishlist}
              onMoveToCollection={handleMoveToCollection}
              setStatus={status.set}
            />
          }
          {activeTab === "achievements" &&
            <ProfileAchievements
              achievements={achievements}
              loading={achievementsLoading}
            />
          }
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
