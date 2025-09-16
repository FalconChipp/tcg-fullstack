// src/pages/allow-desktop.js
// NEW: Sets a bypass cookie and redirects back to ?from=/... (or /)

export async function getServerSideProps({ res, query }) {
  const from = typeof query.from === 'string' ? query.from : '/';

  // Set a non-HTTPOnly cookie (client can clear it). If you want httpOnly, do this via API route.
  const maxAge = 60 * 60 * 24 * 7; // 7 days
  res.setHeader('Set-Cookie', `allowMobileWeb=1; Path=/; SameSite=Lax; Max-Age=${maxAge}`);

  return {
    redirect: {
      destination: from || '/',
      permanent: false,
    },
  };
}

export default function AllowDesktop() {
  // This page never renders; it's an immediate redirect
  return null;
}
