import { gql, useMutation } from '@apollo/client';
import { useState } from 'react';
import useRequireAdmin from '../../hooks/useRequireAdmin';

const ADD = gql`
  mutation AdminAdd($userId: ID!, $cardId: String!, $quantity: Int, $variation: String) {
    adminAddToWishlist(userId: $userId, cardId: $cardId, quantity: $quantity, variation: $variation)
  }
`;

const REMOVE = gql`
  mutation AdminRemove($userId: ID!, $cardId: String!, $variation: String) {
    adminRemoveFromWishlist(userId: $userId, cardId: $cardId, variation: $variation)
  }
`;

const CLEAR = gql`
  mutation AdminClear($userId: ID!) {
    adminClearWishlist(userId: $userId)
  }
`;

export default function Wishlist() {
  const { loading } = useRequireAdmin();
  const [userId, setUserId] = useState('');
  const [cardId, setCardId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [variation, setVariation] = useState('');
  const [add] = useMutation(ADD);
  const [remove] = useMutation(REMOVE);
  const [clear] = useMutation(CLEAR);

  if (loading) return <p>Loading...</p>;

  return (
    <div className="space-y-4 max-w-md">
      <h1 className="text-2xl font-semibold">Wishlist Tools</h1>
      <div className="space-y-2">
        <input className="w-full p-2 rounded bg-gray-700" value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" />
        <input className="w-full p-2 rounded bg-gray-700" value={cardId} onChange={(e) => setCardId(e.target.value)} placeholder="Card ID" />
        <input className="w-full p-2 rounded bg-gray-700" type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} placeholder="Quantity" />
        <input className="w-full p-2 rounded bg-gray-700" value={variation} onChange={(e) => setVariation(e.target.value)} placeholder="Variation" />
        <div className="flex space-x-2">
          <button className="px-3 py-2 bg-blue-600 rounded" onClick={() => add({ variables: { userId, cardId, quantity, variation } })}>Add</button>
          <button className="px-3 py-2 bg-red-600 rounded" onClick={() => remove({ variables: { userId, cardId, variation } })}>Remove</button>
          <button className="px-3 py-2 bg-yellow-600 rounded" onClick={() => clear({ variables: { userId } })}>Clear</button>
        </div>
      </div>
    </div>
  );
}
