import { gql, useQuery, useMutation } from '@apollo/client';

const BINDERS = gql`
  query AdminBinders {
    adminBinders {
      id
      name
    }
  }
`;

const DELETE_BINDER = gql`
  mutation AdminDeleteBinder($id: ID!) {
    adminDeleteBinder(id: $id)
  }
`;

export default function Binders() {
  const { data, loading, error, refetch } = useQuery(BINDERS);
  const [del] = useMutation(DELETE_BINDER, { onCompleted: () => refetch() });

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error loading binders</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Binders</h1>
      <ul className="space-y-2">
        {data.adminBinders.map((b) => (
          <li key={b.id} className="border-b border-gray-700 pb-1 flex justify-between">
            <span>{b.name}</span>
            <button
              className="text-red-400 hover:text-red-200"
              onClick={() => del({ variables: { id: b.id } })}
            >
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
