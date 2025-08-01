import { gql, useQuery, useMutation } from '@apollo/client';
import useAdminAuth from '../../hooks/useAdminAuth';
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
      lastLogin
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
  const { user, loading: authLoading } = useAdminAuth();
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null); // Modal state

  const { data, loading, error, refetch } = useQuery(USERS, { skip: authLoading });
  const [del, { loading: delLoading }] = useMutation(DELETE_USER, { onCompleted: () => refetch() });
  const [ban, { loading: banLoading }] = useMutation(BAN_USER, { onCompleted: () => refetch() });
  const [unban, { loading: unbanLoading }] = useMutation(UNBAN_USER, { onCompleted: () => refetch() });

  const filteredUsers = data?.allUsers?.filter(
    (u) =>
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      u.username?.toLowerCase().includes(search.toLowerCase()) ||
      String(u.id).includes(search)
  ) || [];

  if (authLoading || loading) return <p className="text-white">Loading...</p>;
  if (error) return <p className="text-red-400">Error loading users</p>;

  // Modal: display all details of the selected user
  function UserModal({ user, onClose }) {
    if (!user) return null;
    return (
      <div className="fixed inset-0 bg-black bg-opacity-60 z-40 flex items-center justify-center">
        <div className="bg-[#23242a] rounded-2xl shadow-2xl p-8 max-w-md w-full relative">
          <button
            className="absolute top-3 right-3 text-gray-400 hover:text-white text-2xl"
            onClick={onClose}
            aria-label="Close"
          >&times;</button>
          <h2 className="text-xl font-semibold mb-4 text-white">User Details</h2>
          <dl className="space-y-2 text-base">
            {Object.entries(user).map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-[#333] pb-1">
                <dt className="font-medium text-gray-400">{k}</dt>
                <dd className="text-white">
                  {typeof v === "boolean" ? (v ? 'Yes' : 'No') :
                   v === null || v === undefined ? <span className="text-gray-500">—</span> :
                   k === "lastLogin" && v ? new Date(v).toLocaleString() :
                   v.toString()}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-white mb-6">Users</h1>

      <input
        className="w-full mb-6 p-2 bg-[#181a20] border border-[#23242a] rounded text-white placeholder-gray-400"
        placeholder="Search users by email, username, or ID"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />

      <div className="overflow-x-auto rounded-lg shadow-lg">
        <table className="min-w-full bg-[#181a20] text-white">
          <thead>
            <tr className="border-b border-[#23242a] text-left">
              <th className="py-2 px-4">ID</th>
              <th className="py-2 px-4">Username</th>
              <th className="py-2 px-4">Email</th>
              <th className="py-2 px-4">Admin?</th>
              <th className="py-2 px-4">Status</th>
              <th className="py-2 px-4">Last Login</th>
              <th className="py-2 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(u => (
              <tr
                key={u.id}
                className={`border-b border-[#23242a] ${u.isBanned ? "bg-red-950/50" : "hover:bg-[#23242a]"}`}
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
                <td className="py-2 px-4">{u.lastLogin ? new Date(u.lastLogin).toLocaleString() : <span className="text-gray-400">—</span>}</td>
                <td className="py-2 px-4 space-x-2">
                  <button
                    className="px-2 py-1 bg-blue-700 hover:bg-blue-800 rounded text-xs text-white"
                    onClick={() => setSelectedUser(u)}
                  >
                    View
                  </button>
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
                <td colSpan={7} className="text-center text-gray-400 py-8">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <UserModal user={selectedUser} onClose={() => setSelectedUser(null)} />
    </div>
  );
}
