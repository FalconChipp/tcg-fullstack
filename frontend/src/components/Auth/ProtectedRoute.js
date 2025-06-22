'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { getCookie } from '@/utils/cookieUtils';

export default function ProtectedRoute({ component: Component, ...rest }) {
  const router = useRouter();
  const token = getCookie('authToken');

  // If there's no token, user is not logged in => redirect
  if (!token) {
    if (typeof window !== 'undefined') {
      router.push('/');
    }
    return null;
  }

  // Otherwise, render the protected component
  return <Component {...rest} />;
}
