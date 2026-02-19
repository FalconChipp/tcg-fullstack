// frontend/app/parent/verify/VerifyClient.js

"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";

export default function VerifyClient() {
  const params = useSearchParams();
  const status = params.get("status");
  const reason = params.get("reason");

  const ok = status === "success";

  return (
    <div style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
      <h1>Parent Approval</h1>

      {ok ? (
        <>
          <p>
            ✅ Approval successful. Community features can now be enabled for
            this account.
          </p>
        </>
      ) : status === "failed" ? (
        <>
          <p>❌ Approval failed.</p>
          <p style={{ color: "#666" }}>
            Reason: <code>{reason || "unknown"}</code>
          </p>
        </>
      ) : (
        <p>Checking…</p>
      )}

      <div style={{ marginTop: 16 }}>
        <Link href="/">Back to SixByFive TCG</Link>
      </div>
    </div>
  );
}
