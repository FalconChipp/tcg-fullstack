import { gql, useQuery, useMutation } from '@apollo/client';

const USERS = gql`
  query AdminUsers {
    adminUsers {
      id
      email
      username
    }
  }
`;

const DELETE_USER = gql`
  mutation AdminDeleteUser($id: ID!) {
    adminDeleteUser(userId: $id)
  }
`;

export default function Users() {
  const { data, loading, error, refetch } = useQuery(USERS);
  const [del] = useMutation(DELETE_USER, { onCompleted: () => refetch() });

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error loading users</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Users</h1>
      <ul className="space-y-2">
        {data.adminUsers.map((u) => (
          <li key={u.id} className="border-b border-gray-700 pb-1 flex justify-between">
            <span>
              {u.username} ({u.email})
            </span>
            <button
              className="text-red-400 hover:text-red-200"
              onClick={() => del({ variables: { id: u.id } })}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
