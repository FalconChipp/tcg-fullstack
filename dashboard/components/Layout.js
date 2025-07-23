import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';

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

const SIDEBAR_LINKS = [
  { href: '/', label: 'Dashboard', mod: null },
  { href: '/users', label: 'Users', mod: 'users' },
  // { href: '/cards', label: 'Cards', mod: 'cards' },
  // { href: '/binders', label: 'Binders', mod: 'binders' },
  // { href: '/listings', label: 'Listings', mod: 'listings' },
  // { href: '/logs', label: 'Logs', mod: 'logs' },
  // { href: '/messages', label: 'Messages', mod: 'messages' },
  // { href: '/notifications', label: 'Notifications', mod: 'notifications' },
  // { href: '/wishlist', label: 'Wishlist', mod: 'wishlist' },
  // { href: '/rewards', label: 'Rewards', mod: 'rewards' },
  // { href: '/trades', label: 'Trades', mod: 'trades' },
];

export default function Layout({ children }) {
  const [modules, setModules] = useState(DEFAULT_MODULES);
  const router = useRouter();
  const pathname = router.pathname;

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

  // Sidebar links, only include modules that are enabled
  const filteredLinks = SIDEBAR_LINKS.filter(
    link => link.mod === null || modules.includes(link.mod)
  );

  return (
    <div className="flex min-h-screen bg-gray-950 text-gray-100">
      <aside className="w-64 bg-gray-900 p-5 flex flex-col gap-6 border-r border-gray-800">
        <div>
          <h2 className="text-2xl font-bold tracking-tight mb-2 text-indigo-400">TCG Admin</h2>
          <span className="text-sm text-gray-400">Control Panel</span>
        </div>
        <nav className="flex flex-col gap-1">
          {filteredLinks.map(({ href, label }) => {
            const active = href === '/'
              ? pathname === '/'
              : pathname.startsWith(href);

            return (
              <Link
                key={href}
                href={href}
                className={`
                  px-4 py-2 rounded-lg transition-all font-medium
                  ${active
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'}
                `}
                aria-current={active ? 'page' : undefined}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto flex flex-col gap-1">
          <Link
            href="/login"
            className={`
              px-4 py-2 rounded-lg font-medium
              ${pathname === '/login'
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:bg-gray-800 hover:text-white'}
            `}
          >
            Login
          </Link>
          {/* Add logout etc here if needed */}
        </div>
      </aside>
      <main className="flex-1 min-h-screen bg-gray-950 p-8 overflow-x-auto">
        {children}
      </main>
    </div>
  );
}
