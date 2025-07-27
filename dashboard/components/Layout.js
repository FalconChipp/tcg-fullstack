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
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    <div className="min-h-screen flex flex-col md:flex-row bg-gray-950 text-gray-100">
      {/* Mobile header */}
      <header className="flex items-center justify-between md:hidden px-4 py-3 border-b border-gray-800">
        <button
          aria-label="Open sidebar"
          onClick={() => setSidebarOpen(true)}
          className="text-gray-300 hover:text-white"
        >
          {/* simple hamburger icon */}
          <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span className="text-lg font-semibold text-indigo-400">TCG Admin</span>
      </header>

      {/* Sidebar */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`
          fixed inset-y-0 left-0 z-30 w-64 transform bg-gray-900 p-5 flex flex-col gap-6 border-r border-gray-800 transition-transform md:static md:translate-x-0 md:flex-shrink-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}
      >
        <div className="flex items-center justify-between mb-6 md:block">
          <div>
            <h2 className="text-2xl font-bold tracking-tight mb-2 text-indigo-400">TCG Admin</h2>
            <span className="text-sm text-gray-400">Control Panel</span>
          </div>
          <button
            className="md:hidden text-gray-300 hover:text-white"
            aria-label="Close sidebar"
            onClick={() => setSidebarOpen(false)}
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
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
                onClick={() => setSidebarOpen(false)}
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
            onClick={() => setSidebarOpen(false)}
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
