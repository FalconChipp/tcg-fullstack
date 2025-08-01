import React, { useEffect } from "react";
import Head from "next/head";
import { AuthProvider } from "@/components/Auth/AuthProvider";
import { ThemeProvider } from "@/hooks/ThemeProvider";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { MessengerProvider } from "@/components/Messenger/MessengerContext";
import MessengerLayout from "@/components/Messenger/MessengerLayout";
import "@/styles/global.css";
import "@/styles/condition.css";

export default function MyApp({ Component, pageProps }) {
  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);
  return (
    <GoogleOAuthProvider clientId={process.env.GOOGLE_CLIENT_ID}>
      <ThemeProvider>
        <AuthProvider>
          {/* <MessengerProvider> */}
            {/* Global favicon */}
            <Head>
              <link rel="icon" href="/assets/favicon.png" sizes="any" />
              <meta name="google-site-verification" content="E99dzL-VmDXBCklACriXXuFFdbiFGlx9Ieawb5lVqTQ" />
            </Head>
            <Component {...pageProps} />
            {/* MessengerLayout includes sidebar, toggle, and popups */}
            {/* <MessengerLayout />
          </MessengerProvider> */}
        </AuthProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
}
