// pages/_app.js
import React, { useEffect } from "react";
import { AuthProvider } from "@/components/Auth/AuthProvider";
import { ThemeProvider } from "@/hooks/ThemeProvider";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "@/styles/global.css"
import "@/styles/condition.css";

export default function MyApp({ Component, pageProps }) {
  useEffect(() => {
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <GoogleOAuthProvider clientId={process.env.GOOGLE_CLIENT_ID}>
        <ThemeProvider>
            <AuthProvider>
                <Component {...pageProps} />
            </AuthProvider>
        </ThemeProvider>
    </GoogleOAuthProvider>
  );
}
