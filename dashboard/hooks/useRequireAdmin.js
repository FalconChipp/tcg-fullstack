import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { gql, useQuery } from '@apollo/client';

const CHECK_QUERY = gql`
  query __AdminCheck { adminUsers(limit: 1) { id } }
`;

export default function useRequireAdmin() {
  const router = useRouter();
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const { loading, error } = useQuery(CHECK_QUERY, {
    skip: !token,
    fetchPolicy: 'network-only'
  });

  useEffect(() => {
    if (!token) {
      router.replace('/login');
    }
  }, [token, router]);

  useEffect(() => {
    if (!loading && error) {
      router.replace('/login');
    }
  }, [loading, error, router]);

  return { loading };
}
