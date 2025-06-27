import { gql, useMutation } from '@apollo/client';
import { useState } from 'react';
import useRequireAdmin from '../../hooks/useRequireAdmin';

const SEND = gql`
  mutation AdminBroadcast($input: NotificationInput!) {
    adminSendBroadcastNotification(input: $input)
  }
`;

export default function Notifications() {
  const { loading } = useRequireAdmin();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [send] = useMutation(SEND, { onCompleted: () => { setTitle(''); setBody(''); } });

  if (loading) return <p>Loading...</p>;

  const submit = (e) => {
    e.preventDefault();
    send({ variables: { input: { title, body, type: 'system' } } });
  };

  return (
    <div className="space-y-4 max-w-md">
      <h1 className="text-2xl font-semibold">Broadcast Notification</h1>
      <form onSubmit={submit} className="space-y-2">
        <input
          className="w-full p-2 rounded bg-gray-700"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
        />
        <textarea
          className="w-full p-2 rounded bg-gray-700"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Body"
        />
        <button className="px-4 py-2 bg-blue-600 rounded" type="submit">Send</button>
      </form>
    </div>
  );
}
