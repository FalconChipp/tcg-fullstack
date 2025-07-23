// import { gql, useQuery, useMutation } from '@apollo/client';
// import useRequireAdmin from '../../hooks/useRequireAdmin';

// const CARDS = gql`
//   query AdminCards {
//     adminCards {
//       id
//       name
//       set
//     }
//   }
// `;

// const DELETE_CARD = gql`
//   mutation AdminDeleteCard($id: String!) {
//     adminDeleteCard(id: $id)
//   }
// `;

// export default function Cards() {
//   const { loading: authLoading } = useRequireAdmin();
//   const { data, loading, error, refetch } = useQuery(CARDS, { skip: authLoading });
//   const [del] = useMutation(DELETE_CARD, { onCompleted: () => refetch() });

//   if (authLoading) return <p>Loading...</p>;
//   if (loading) return <p>Loading...</p>;
//   if (error) return <p>Error loading cards</p>;

//   return (
//     <div className="space-y-4">
//       <h1 className="text-2xl font-semibold">Cards</h1>
//       <ul className="space-y-2">
//         {data.adminCards.map((c) => (
//           <li key={c.id} className="border-b border-gray-700 pb-1 flex justify-between">
//             <span>
//               {c.name} - {c.set}
//             </span>
//             <button
//               className="text-red-400 hover:text-red-200"
//               onClick={() => del({ variables: { id: c.id } })}
//             >
//               Delete
//             </button>
//           </li>
//         ))}
//       </ul>
//     </div>
//   );
// }

export default function Cards() {
  return <div>Cards</div>
}