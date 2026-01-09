// frontend/src/pages/admin/index.js

"use client";

import React from "react";
import Head from "next/head"; // ✅ ADD THIS
import AdminGuard from "@/components/Admin/AdminGuard";
import AdminDashboardRoot from "@/components/Admin/AdminDashboardRoot";

export default function AdminIndexPage() {
  return (
    <>
      {/* ✅ Page-specific <head> */}
      <Head>
        <title>Admin · SBF TCG</title>
        <meta name="robots" content="noindex,nofollow" />
      </Head>

      <AdminGuard redirectTo="/">
        <AdminDashboardRoot />
      </AdminGuard>
    </>
  );
}
