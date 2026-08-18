"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "@apollo/client";
import { MARKETPLACE_RULES_QUERY as RULES_QUERY, AGREE_TO_MARKETPLACE_RULES_MUTATION as AGREE_MUTATION } from '@/graphql/marketplace';

export default function MarketplaceRulesModal({ onAgreed, isLoggedIn = false }) {
  const [confirmed, setConfirmed] = useState(false);

  const { data, loading: rulesLoading } = useQuery(RULES_QUERY, { fetchPolicy: "cache-first" });
  const rules = data?.marketplaceRules ?? [];

  const [agree, { loading: agreeing, error }] = useMutation(AGREE_MUTATION, {
    onCompleted: () => onAgreed?.(),
  });

  function handleAgree() {
    if (isLoggedIn) {
      agree();
    } else {
      onAgreed?.();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-lg rounded-[14px] border border-white/[0.08] bg-[#0d0f17]  flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-white/[0.06] shrink-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-[10px] bg-indigo-600/20 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-neutral-100">Marketplace Rules</h2>
          </div>
          <p className="text-xs text-neutral-500 ml-11">
            Before you buy or sell, you must agree to our marketplace rules. Please read them carefully.
          </p>
        </div>

        {/* Rules list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2.5 min-h-0">
          {rulesLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-4 rounded bg-white/[0.04] animate-pulse" style={{ width: `${70 + (i % 3) * 10}%` }} />
            ))
          ) : (
            rules.map((rule, i) => (
              <div key={i} className="flex gap-3 items-start">
                <span className="shrink-0 mt-0.5 w-5 h-5 rounded-[6px] bg-white/[0.06] border border-white/[0.08] flex items-center justify-center text-[10px] font-semibold text-neutral-500">
                  {i + 1}
                </span>
                <p className="text-xs text-neutral-300 leading-relaxed">{rule}</p>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] shrink-0 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer group">
            <div
              onClick={() => setConfirmed((v) => !v)}
              className={[
                "mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center transition shrink-0",
                confirmed
                  ? "bg-indigo-600 border-indigo-500"
                  : "border-white/20 group-hover:border-white/40",
              ].join(" ")}
            >
              {confirmed && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <span className="text-xs text-neutral-400 leading-relaxed">
              I have read and agree to the marketplace rules. I understand that violations may result in listing removal or account suspension.
            </span>
          </label>

          {error && (
            <p className="text-xs text-red-400">{error.message}</p>
          )}

          <button
            onClick={handleAgree}
            disabled={!confirmed || agreeing || rulesLoading}
            className="w-full rounded-[10px] py-3 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {agreeing ? "Saving…" : "I agree — take me to the marketplace"}
          </button>
        </div>
      </div>
    </div>
  );
}
