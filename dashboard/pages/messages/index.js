import { gql, useQuery, useMutation } from '@apollo/client';
import useRequireAdmin from '../../hooks/useRequireAdmin';

const REPORTED = gql`
  query AdminReportedMessages {
    adminQueryReportedMessages {
      id
      senderId
      content
      flagReason
    }
  }
`;

const DELETE_MESSAGE = gql`
  mutation AdminDeleteMessage($id: ID!) {
    adminDeleteMessage(id: $id)
  }
`;

export default function Messages() {
  const { loading: authLoading } = useRequireAdmin();
  const { data, loading, error, refetch } = useQuery(REPORTED, { skip: authLoading });
  const [del] = useMutation(DELETE_MESSAGE, { onCompleted: () => refetch() });

  if (authLoading) return <p>Loading...</p>;
  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error loading messages</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Reported Messages</h1>
      <ul className="space-y-2">
        {data.adminQueryReportedMessages.map((m) => (
          <li key={m.id} className="border-b border-gray-700 pb-1 flex justify-between">
            <span>
              {m.senderId}: {m.content} ({m.flagReason})
            </span>
            <button className="text-red-400 hover:text-red-200" onClick={() => del({ variables: { id: m.id } })}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
