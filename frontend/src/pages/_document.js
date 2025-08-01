// pages/_document.js
import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html className="dark">
      <Head>
        {/* Place external CSS links here */}
        <link
          key="font-awesome"
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.3/css/all.min.css"
        />
        <meta name="google-site-verification" content="E99dzL-VmDXBCklACriXXuFFdbiFGlx9Ieawb5lVqTQ" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
