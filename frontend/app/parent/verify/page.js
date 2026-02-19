// frontend/app/parent/verify/page.js

import React, { Suspense } from "react";
import VerifyClient from "./VerifyClient";

export default function ParentVerifyPage() {
  return (
    <Suspense
      fallback={
        <div style={{ maxWidth: 720, margin: "40px auto", padding: 16 }}>
          <h1>Parent Approval</h1>
          <p>Checking…</p>
        </div>
      }
    >
      <VerifyClient />
    </Suspense>
  );
}
