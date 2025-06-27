import { useEffect, useState } from 'react';
import useRequireAdmin from '../hooks/useRequireAdmin';

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

export default function ModulesPage() {
  const { loading } = useRequireAdmin();
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

  const toggle = (mod) => {
    setModules((prev) => {
      const updated = prev.includes(mod)
        ? prev.filter((m) => m !== mod)
        : [...prev, mod];
      if (typeof window !== 'undefined') {
        localStorage.setItem('enabledModules', JSON.stringify(updated));
      }
      return updated;
    });
  };

  if (loading) return <p>Loading...</p>;
  return (
    <div className="space-y-4 max-w-md">
      <h1 className="text-2xl font-semibold">Enabled Modules</h1>
      <div className="space-y-2">
        {DEFAULT_MODULES.map((mod) => (
          <label key={mod} className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={modules.includes(mod)}
              onChange={() => toggle(mod)}
            />
            <span className="capitalize">{mod}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
