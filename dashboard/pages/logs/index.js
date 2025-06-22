import { gql, useQuery } from '@apollo/client';

const LOGS = gql`
  query AllLogs {
    allActivityLogs(limit: 50) {
      id
      userId
      type
      createdAt
    }
  }
`;

export default function Logs() {
  const { data, loading, error } = useQuery(LOGS);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error loading logs</p>;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">Activity Logs</h1>
      <ul className="space-y-2">
        {data.allActivityLogs.map((log) => (
          <li key={log.id} className="border-b border-gray-700 pb-1">
            {log.type} - {log.userId} ({new Date(log.createdAt).toLocaleString()})
          </li>
        ))}
      </ul>
    </div>
  );
}
