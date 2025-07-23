// import { gql, useMutation } from '@apollo/client';
// import { useState } from 'react';
// import useRequireAdmin from '../../hooks/useRequireAdmin';

// const GRANT = gql`
//   mutation GrantReward($userId: ID!, $type: String!, $achievementId: ID) {
//     grantReward(userId: $userId, type: $type, achievementId: $achievementId)
//   }
// `;

// export default function Rewards() {
//   const { loading } = useRequireAdmin();
//   const [userId, setUserId] = useState('');
//   const [type, setType] = useState('achievement');
//   const [achievementId, setAchievementId] = useState('');
//   const [grant] = useMutation(GRANT);

//   if (loading) return <p>Loading...</p>;

//   return (
//     <div className="space-y-4 max-w-md">
//       <h1 className="text-2xl font-semibold">Grant Reward</h1>
//       <input className="w-full p-2 rounded bg-gray-700" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" />
//       <input className="w-full p-2 rounded bg-gray-700" value={type} onChange={(e) => setType(e.target.value)} placeholder="Type" />
//       <input className="w-full p-2 rounded bg-gray-700" value={achievementId} onChange={(e) => setAchievementId(e.target.value)} placeholder="Achievement ID" />
//       <button className="px-4 py-2 bg-blue-600 rounded" onClick={() => grant({ variables: { userId, type, achievementId: achievementId || null } })}>Grant</button>
//     </div>
//   );
// }
