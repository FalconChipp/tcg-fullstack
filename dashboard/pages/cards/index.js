import { useState } from "react";
import { gql, useQuery, useMutation } from "@apollo/client";
import useAdminAuth from "../../hooks/useAdminAuth"; // Or your admin auth hook

const CARDS = gql`
  query AdminCards($offset: Int, $limit: Int, $search: String) {
    adminCards(offset: $offset, limit: $limit, search: $search) {
      cards {
        id
        name
        set
        number
        rarity
        tcgImageUrl
      }
      total
    }
  }
`;

const DELETE_CARD = gql`
  mutation AdminDeleteCard($id: String!) {
    adminDeleteCard(id: $id)
  }
`;

export default function Cards() {
  const { user, loading: authLoading } = useAdminAuth();

  // Pagination, search, state
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const pageSize = 25;

  // Query with variables
  const { data, loading, error, refetch } = useQuery(CARDS, {
    variables: { offset: (page - 1) * pageSize, limit: pageSize, search },
    skip: authLoading,
    fetchPolicy: "network-only"
  });

  const [del, { loading: delLoading }] = useMutation(DELETE_CARD, {
    onCompleted: () => refetch(),
  });

  if (authLoading || loading) return <p className="text-white">Loading...</p>;
  if (error) return <p className="text-red-400">Error loading cards</p>;

  const cards = data?.adminCards?.cards || [];
  const total = data?.adminCards?.total || 0;
  const pageCount = Math.ceil(total / pageSize);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-white mb-6">All Cards</h1>

      {/* Search box */}
      <input
        className="w-full mb-6 p-2 bg-[#181a20] border border-[#23242a] rounded text-white placeholder-gray-400"
        placeholder="Search by name, set, or number"
        value={search}
        onChange={e => {
          setSearch(e.target.value);
          setPage(1);
        }}
      />

      {/* Cards Table */}
      <div className="overflow-x-auto rounded-lg shadow-lg">
        <table className="min-w-full bg-[#181a20] text-white">
          <thead>
            <tr className="border-b border-[#23242a] text-left">
              <th className="py-2 px-4">Image</th>
              <th className="py-2 px-4">Name</th>
              <th className="py-2 px-4">Set</th>
              <th className="py-2 px-4">No.</th>
              <th className="py-2 px-4">Rarity</th>
              <th className="py-2 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr key={c.id} className="border-b border-[#23242a]">
                <td className="py-2 px-4">
                  {c.tcgImageUrl ? (
                    <img src={c.tcgImageUrl} alt={c.name} className="w-14 h-20 object-cover rounded shadow" />
                  ) : (
                    <span className="text-gray-500 italic">No image</span>
                  )}
                </td>
                <td className="py-2 px-4">{c.name}</td>
                <td className="py-2 px-4">{c.set}</td>
                <td className="py-2 px-4">{c.number}</td>
                <td className="py-2 px-4">{c.rarity}</td>
                <td className="py-2 px-4">
                  <button
                    className="px-3 py-1 bg-red-700 hover:bg-red-800 rounded text-sm text-white"
                    disabled={delLoading}
                    onClick={() => {
                      if (window.confirm(`Delete card ${c.name}?`)) del({ variables: { id: c.id } });
                    }}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {cards.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-gray-400 py-8">
                  No cards found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="mt-6 flex gap-4 items-center">
        <button
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white"
          disabled={page <= 1}
          onClick={() => setPage(p => Math.max(p - 1, 1))}
        >
          Prev
        </button>
        <span className="text-gray-400">
          Page {page} of {pageCount || 1}
        </span>
        <button
          className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-white"
          disabled={page >= pageCount}
          onClick={() => setPage(p => Math.min(p + 1, pageCount))}
        >
          Next
        </button>
      </div>
    </div>
  );
}
