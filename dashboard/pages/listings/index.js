// import { gql, useQuery, useMutation } from '@apollo/client';
// import useRequireAdmin from '../../hooks/useRequireAdmin';

// const LISTINGS = gql`
//   query AdminListings {
//     adminMarketplaceListings {
//       id
//       cardId
//       quantity
//       price
//       status
//     }
//   }
// `;

// const DELETE_LISTING = gql`
//   mutation AdminDeleteListing($id: ID!) {
//     adminDeleteMarketplaceListing(id: $id)
//   }
// `;

// export default function Listings() {
//   const { loading: authLoading } = useRequireAdmin();
//   const { data, loading, error, refetch } = useQuery(LISTINGS, { skip: authLoading });
//   const [del] = useMutation(DELETE_LISTING, {
//     onCompleted: () => refetch()
//   });

//   if (authLoading) return <p>Loading...</p>;
//   if (loading) return <p>Loading...</p>;
//   if (error) return <p>Error loading listings</p>;

//   return (
//     <div className="space-y-4">
//       <h1 className="text-2xl font-semibold">Marketplace Listings</h1>
//       <ul className="space-y-2">
//         {data.adminMarketplaceListings.map((l) => (
//           <li key={l.id} className="border-b border-gray-700 pb-1 flex justify-between">
//             <span>
//               {l.cardId} - {l.quantity} @ ${l.price} ({l.status})
//             </span>
//             <button
//               className="text-red-400 hover:text-red-200"
//               onClick={() => del({ variables: { id: l.id } })}
//             >
//               Delete
//             </button>
//           </li>
//         ))}
//       </ul>
//     </div>
//   );
// }

export default function Listings() {
  return <div>Listings</div>
}