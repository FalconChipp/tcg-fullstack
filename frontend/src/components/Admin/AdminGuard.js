// frontend/src/components/Admin/AdminGuard.js
// -----------------------------------------------------------------------------
// Wrap any page/section that should only be accessible to admin users.
//
// Usage:
//   <AdminGuard redirectTo="/">
//     <AdminDashboardRoot />
//   </AdminGuard>
// -----------------------------------------------------------------------------

"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/router";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export default function AdminGuard({ children, redirectTo = null }) {
  const router = useRouter();
  const { user, isAdmin, loading, error } = useCurrentUser();

  // Optional redirect for non-admins
  useEffect(() => {
    if (!loading && user && !isAdmin && redirectTo) {
      router.replace(redirectTo);
    }
  }, [loading, user, isAdmin, redirectTo, router]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05060a]">
        <p className="text-sm text-neutral-400">Loading admin access…</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05060a]">
        <div className="max-w-md px-4 text-center">
          <p className="text-sm text-red-400 mb-2">
            Failed to load your account details.
          </p>
          <p className="text-xs text-neutral-500">
            {error.message}
          </p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05060a]">
        <div className="max-w-md px-4 text-center space-y-2">
          <p className="text-base text-neutral-100 font-medium">
            You need to be logged in to access the admin dashboard.
          </p>
          {/* If you have a /login route, you can link to it here */}
          {/* <Link href="/login" className="text-sm text-brand-300 underline">Go to login</Link> */}
        </div>
      </div>
    );
  }

  // Logged in but not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#05060a]">
        <div className="max-w-md px-4 text-center space-y-2">
          <p className="text-base text-neutral-100 font-medium">
            You don’t have permission to access this area.
          </p>
          <p className="text-xs text-neutral-500">
            If you believe this is a mistake, please contact support.
          </p>
        </div>
      </div>
    );
  }

  // ✅ Admin and loaded → render protected content
  return <>{children}</>;
}
