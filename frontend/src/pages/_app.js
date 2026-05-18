import React, { useEffect } from "react";
import Head from "next/head";
import { AuthProvider } from "@/components/Auth/AuthProvider";
import { ThemeProvider } from "@/hooks/ThemeProvider";
import { GoogleOAuthProvider } from "@react-oauth/google";
import { ApolloProvider } from "@apollo/client";
import { apolloClient } from "app/apolloClient";
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
          <ApolloProvider client={apolloClient}>
            <MessengerProvider>
              {/* Global favicon */}
              <Head>
                <link rel="icon" href="/assets/favicon.png" sizes="any" />
              </Head>
              <Component {...pageProps} />
              {/* MessengerLayout includes sidebar, toggle, and popups */}
              <MessengerLayout />
            </MessengerProvider>
          </ApolloProvider>
        </AuthProvider>
      </ThemeProvider>
    </GoogleOAuthProvider>
  );
}
