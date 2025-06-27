import Link from 'next/link';
import { useEffect, useState } from 'react';

const DEFAULT_MODULES = [
  'users',
  'cards',
  'binders',
  'listings',
  'logs',
  'messages',
  'notifications',
  'wishlist',
  'rewards',
  'trades',
];

export default function Layout({ children }) {
  const [modules, setModules] = useState(DEFAULT_MODULES);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('enabledModules');
      if (stored) {
        try {
          setModules(JSON.parse(stored));
        } catch (_) {}
      }
    }
  }, []);

  const link = (href, label, mod) =>
    modules.includes(mod) && (
      <Link className="hover:text-white" href={href}>
        {label}
      </Link>
    );

  return (
    <div className="flex min-h-screen bg-gray-900 text-gray-100">
      <aside className="w-64 bg-gray-800 p-4 space-y-4">
        <h2 className="text-xl font-semibold">TCG Admin</h2>
        <nav className="flex flex-col space-y-2">
          <Link className="hover:text-white" href="/">Home</Link>
          {link('/users', 'Users', 'users')}
          {link('/cards', 'Cards', 'cards')}
          {link('/binders', 'Binders', 'binders')}
          {link('/listings', 'Listings', 'listings')}
          {link('/logs', 'Logs', 'logs')}
          {link('/messages', 'Messages', 'messages')}
          {link('/notifications', 'Notifications', 'notifications')}
          {link('/wishlist', 'Wishlist', 'wishlist')}
          {link('/rewards', 'Rewards', 'rewards')}
          {link('/trades', 'Trades', 'trades')}
          <Link className="hover:text-white" href="/modules">Modules</Link>
          <Link className="hover:text-white" href="/login">Login</Link>
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
