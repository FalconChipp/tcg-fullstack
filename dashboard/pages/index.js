import { gql, useQuery } from '@apollo/client';
import useAdminAuth from '../hooks/useAdminAuth';

const ADMIN_STATS = gql`
  query AdminStats {
    adminStats {
      totalUsers
      totalActiveUsers
      totalListings
      totalCards
      totalTrades
      totalBanned
    }
  }
`;

export default function Home() {
  const { user, loading: authLoading, checked } = useAdminAuth();
  // Skip query if still loading OR no admin user
  const { data, loading: statsLoading, error } = useQuery(ADMIN_STATS, {
    skip: authLoading || !user,
  });

  if (authLoading || !checked) return <p className="text-white">Loading...</p>;
  if (!user) return <p className="text-red-400">Not authenticated</p>;
  if (statsLoading) return <p className="text-white">Loading...</p>;
  if (error) return <p className="text-red-400">Error loading stats</p>;

  const stats = data?.adminStats || {};

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-semibold text-white">TCG Admin Dashboard</h1>
      <p className="text-gray-300 mb-8">Welcome to the admin dashboard. Use the navigation to manage data.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Total Users" value={stats.totalUsers} />
        <StatCard title="Active Users" value={stats.totalActiveUsers} />
        <StatCard title="Banned Users" value={stats.totalBanned} />
        <StatCard title="Listings" value={stats.totalListings} />
        <StatCard title="Cards" value={stats.totalCards} />
        <StatCard title="Trades" value={stats.totalTrades} />
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="bg-[#181a20] border border-[#23242a] rounded-xl shadow p-6 flex flex-col items-center">
      <div className="text-2xl font-bold text-indigo-400">{value ?? "--"}</div>
      <div className="mt-2 text-gray-300 text-lg">{title}</div>
    </div>
  );
}
