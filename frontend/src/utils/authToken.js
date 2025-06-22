'use client';
import { getCookie } from './cookieUtils';

export function getAuthTokenSafe() {
  if (typeof window !== 'undefined') {
    return getCookie('authToken') || null;
  }
  return null;
}
