import { useEffect, useState } from 'react';

// Hash routing works identically under file://-like Tauri origins, LAN servers and PWAs.
export type Route =
  | { name: 'dashboard' }
  | { name: 'new' }
  | { name: 'analysis'; id: string | null }
  | { name: 'plan' }
  | { name: 'progress' }
  | { name: 'settings' };

export function parse(hash: string): Route {
  const [page = '', id] = hash.replace(/^#\/?/, '').split('/');
  switch (page) {
    case 'new': return { name: 'new' };
    case 'analysis': return { name: 'analysis', id: id ?? null };
    case 'plan': return { name: 'plan' };
    case 'progress': return { name: 'progress' };
    case 'settings': return { name: 'settings' };
    default: return { name: 'dashboard' };
  }
}

export function navigate(path: string) {
  window.location.hash = path;
  window.scrollTo({ top: 0 });
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
