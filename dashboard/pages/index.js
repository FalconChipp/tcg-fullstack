import useRequireAdmin from '../hooks/useRequireAdmin';

export default function Home() {
  const { loading } = useRequireAdmin();
  if (loading) return <p>Loading...</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">TCG Admin Dashboard</h1>
      <p>Welcome to the admin dashboard. Use the navigation to manage data.</p>
    </div>
  );
}
