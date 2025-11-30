// frontend/src/pages/admin/index.js

"use client";

import React from "react";
import AdminGuard from "@/components/Admin/AdminGuard";
import AdminDashboardRoot from "@/components/Admin/AdminDashboardRoot";

export default function AdminIndexPage() {
  return (
    <AdminGuard redirectTo="/">
      <AdminDashboardRoot />
    </AdminGuard>
  );
}
