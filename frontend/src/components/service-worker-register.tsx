'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (!('serviceWorker' in navigator)) return;

    // Dev servers and HMR conflict with aggressive SW caching; keep prod-only.
    if (process.env.NODE_ENV !== 'production') {
      void navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          void registration.unregister();
        });
      });
      return;
    }

    navigator.serviceWorker.register('/sw.js').then(
      (registration) => {
        console.log('[PWA] Service Worker registered successfully:', registration);

        setInterval(() => {
          registration.update();
        }, 60000);
      },
      (error) => {
        console.log('[PWA] Service Worker registration failed:', error);
      },
    );
  }, []);

  return null;
}
