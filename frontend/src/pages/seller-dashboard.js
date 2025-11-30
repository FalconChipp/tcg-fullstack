"use client";
import React from "react";
import Head from "next/head";
import Layout from "@/components/Layout/Layout";
import SellerDashboard from "@/components/Marketplace_Archive/SellerDashboard";

export default function SellerDashboardPage() {
  return (
    <>
      <Head>
        <title>Seller Dashboard – SixByFive TCG</title>
        <meta name="description" content="Manage your Pokémon TCG card listings. Edit, remove, or track your active, sold, and ended cards." />
        <link rel="canonical" href="https://tcg.sixbyfive.com/seller-dashboard" />
      </Head>
      <Layout>
        <SellerDashboard />
      </Layout>
    </>
  );
}
