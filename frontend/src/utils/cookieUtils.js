'use client'; // Ensures this runs client-side in Next.js 13 App Router

// Function to set a cookie with a specified name, value, and expiration days
export const setCookie = (name, value, days) => {
  if (typeof document === 'undefined') return; // Guard for SSR

  let expires = '';
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = '; expires=' + date.toUTCString();
  }
  document.cookie = `${name}=${value || ''}${expires}; path=/`;
};

// Function to get the value of a cookie by its name
export const getCookie = (name) => {
  if (typeof document === 'undefined') return null; // Guard for SSR

  const nameEQ = name + '=';
  const parts = document.cookie.split(';');
  for (let i = 0; i < parts.length; i++) {
    let c = parts[i].trimStart();
    if (c.indexOf(nameEQ) === 0) {
      return c.substring(nameEQ.length, c.length);
    }
  }
  return null;
};
