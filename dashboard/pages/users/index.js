import { gql, useQuery, useMutation } from '@apollo/client';
import useAdminAuth from '../../hooks/useAdminAuth'; // Updated hook name for consistency
import { useState } from 'react';

// --- GraphQL Queries/Mutations ---
const USERS = gql`
  query AllUsers {
    allUsers {
      id
      email
      username
      isBanned
      isAdmin
    }
  }
`;

const DELETE_USER = gql`
  mutation AdminDeleteUser($id: ID!) {
    adminDeleteUser(userId: $id)
  }
`;

const BAN_USER = gql`
  mutation AdminBanUser($id: ID!) {
    adminBanUser(userId: $id)
  }
`;

const UNBAN_USER = gql`
  mutation AdminUnbanUser($id: ID!) {
    adminUnbanUser(userId: $id)
  }
`;

// --- MAIN USERS COMPONENT ---
export default function Users() {
  // 1. Require admin login
  const { user, loading: authLoading } = useAdminAuth();

  // 2. State for search/filter
  const [search, setSearch] = useState('');

  // 3. Query users list
  const { data, loading, error, refetch } = useQuery(USERS, { skip: authLoading });

  // 4. Mutations for admin actions
  const [del, { loading: delLoading }] = useMutation(DELETE_USER, { onCompleted: () => refetch() });
  const [ban, { loading: banLoading }] = useMutation(BAN_USER, { onCompleted: () => refetch() });
  const [unban, { loading: unbanLoading }] = useMutation(UNBAN_USER, { onCompleted: () => refetch() });

  // 5. Filtered users for search box
  const filteredUsers = data?.allUsers?.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      String(u.id).includes(search)
  ) || [];

  // --- Render Loading/Error States ---
  if (authLoading || loading) return <p className="text-white">Loading...</p>;
  if (error) return <p className="text-red-400">Error loading users</p>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-white mb-6">Users</h1>

      {/* Search Box */}
      <input
        className="w-full mb-6 p-2 bg-[#181a20] border border-[#23242a] rounded text-white placeholder-gray-400"
        placeholder="Search users by email, username, or ID"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      {/* Users Table */}
      <div className="overflow-x-auto rounded-lg shadow-lg">
        <table className="min-w-full bg-[#181a20] text-white">
          <thead>
            <tr className="border-b border-[#23242a] text-left">
              <th className="py-2 px-4">ID</th>
              <th className="py-2 px-4">Username</th>
              <th className="py-2 px-4">Email</th>
              <th className="py-2 px-4">Admin?</th>
              <th className="py-2 px-4">Status</th>
              <th className="py-2 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(u => (
              <tr
                key={u.id}
                className={`border-b border-[#23242a] ${u.isBanned ? "bg-red-950/50" : ""}`}
              >
                <td className="py-2 px-4 font-mono">{u.id}</td>
                <td className="py-2 px-4">{u.username || <span className="text-gray-400 italic">none</span>}</td>
                <td className="py-2 px-4">{u.email}</td>
                <td className="py-2 px-4">{u.isAdmin ? <span className="text-green-400 font-bold">Yes</span> : <span className="text-gray-400">No</span>}</td>
                <td className="py-2 px-4">
                  {u.isBanned ? (
                    <span className="text-red-400 font-bold">Banned</span>
                  ) : (
                    <span className="text-green-400">Active</span>
                  )}
                </td>
                <td className="py-2 px-4 space-x-2">
                  {!u.isAdmin && (
                    <>
                      <button
                        className="px-3 py-1 bg-red-700 hover:bg-red-800 rounded text-sm text-white"
                        disabled={delLoading}
                        onClick={() => {
                          if (window.confirm(`Delete user ${u.username || u.email}? This cannot be undone.`))
                            del({ variables: { id: u.id } });
                        }}
                      >
                        Delete
                      </button>
                      {u.isBanned ? (
                        <button
                          className="px-3 py-1 bg-yellow-700 hover:bg-yellow-800 rounded text-sm text-white"
                          disabled={unbanLoading}
                          onClick={() => unban({ variables: { id: u.id } })}
                        >
                          Unban
                        </button>
                      ) : (
                        <button
                          className="px-3 py-1 bg-yellow-700 hover:bg-yellow-800 rounded text-sm text-white"
                          disabled={banLoading}
                          onClick={() => ban({ variables: { id: u.id } })}
                        >
                          Ban
                        </button>
                      )}
                    </>
                  )}
                  {u.isAdmin && (
                    <span className="text-xs text-indigo-400 italic">admin</span>
                  )}
                </td>
              </tr>
            ))}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-8">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
