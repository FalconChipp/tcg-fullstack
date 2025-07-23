// import { gql, useQuery, useMutation } from '@apollo/client';
// import useAdminAuth from '../hooks/useAdminAuth';

// const DISPUTES = gql`
//   query AdminDisputes {
//     tradeDisputes(status: "open") {
//       id
//       tradeId
//       reason
//       raisedById
//     }
//   }
// `;

// const RESOLVE = gql`
//   mutation ResolveDispute($id: ID!, $resolution: String!) {
//     adminResolveTradeDispute(tradeId: $id, resolution: $resolution) {
//       id
//     }
//   }
// `;

// export default function Trades() {
//   const { loading: authLoading } = useRequireAdmin();
//   const { data, loading, error, refetch } = useQuery(DISPUTES, { skip: authLoading });
//   const [resolve] = useMutation(RESOLVE, { onCompleted: () => refetch() });

//   if (authLoading) return <p>Loading...</p>;
//   if (loading) return <p>Loading...</p>;
//   if (error) return <p>Error loading disputes</p>;

//   const handleResolve = (id) => {
//     const res = prompt('Resolution message:');
//     if (res) resolve({ variables: { id, resolution: res } });
//   };

//   return (
//     <div className="space-y-4">
//       <h1 className="text-2xl font-semibold">Trade Disputes</h1>
//       <ul className="space-y-2">
//         {data.tradeDisputes.map((d) => (
//           <li key={d.id} className="border-b border-gray-700 pb-1 flex justify-between">
//             <span>
//               Trade {d.tradeId} by {d.raisedById}: {d.reason}
//             </span>
//             <button className="text-blue-400" onClick={() => handleResolve(d.tradeId)}>
//               Resolve
//             </button>
//           </li>
//         ))}
//       </ul>
//     </div>
//   );
// }
