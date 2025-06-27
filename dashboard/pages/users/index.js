import { gql, useQuery, useMutation } from '@apollo/client';
import useRequireAdmin from '../../hooks/useRequireAdmin';

const USERS = gql`
  query AllUsers {
    allUsers {
      id
      email
      username
      isBanned
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

export default function Users() {
  const { loading: authLoading } = useRequireAdmin();
  const { data, loading, error, refetch } = useQuery(USERS, { skip: authLoading });
  const [del] = useMutation(DELETE_USER, { onCompleted: () => refetch() });
  const [ban] = useMutation(BAN_USER, { onCompleted: () => refetch() });
  const [unban] = useMutation(UNBAN_USER, { onCompleted: () => refetch() });

  if (authLoading) return <p>Loading...</p>;
  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error loading users</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Users</h1>
      <ul className="space-y-2">
        {data.allUsers.map((u) => (
          <li key={u.id} className="border-b border-gray-700 pb-1 flex justify-between">
            <span>
              {u.username} ({u.email}) {u.isBanned && '(banned)'}
            </span>
            <div className="space-x-2">
              <button
                className="text-red-400 hover:text-red-200"
                onClick={() => del({ variables: { id: u.id } })}
              >
                Delete
              </button>
              {u.isBanned ? (
                <button className="text-yellow-400" onClick={() => unban({ variables: { id: u.id } })}>
                  Unban
                </button>
              ) : (
                <button className="text-yellow-400" onClick={() => ban({ variables: { id: u.id } })}>
                  Ban
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
