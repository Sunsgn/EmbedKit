type UpdateListener = (available: boolean) => void;

let registration: ServiceWorkerRegistration | null = null;
const listeners = new Set<UpdateListener>();
const notify = (available: boolean) => listeners.forEach(listener => listener(available));

export function subscribePwaUpdate(listener: UpdateListener) {
  listeners.add(listener);
  listener(Boolean(registration?.waiting));
  return () => { listeners.delete(listener); };
}

export async function registerPwa() {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
  if (registration.waiting) notify(true);
  registration.addEventListener('updatefound', () => {
    const worker = registration?.installing;
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed' && navigator.serviceWorker.controller) notify(true);
    });
  });
}

export function activatePwaUpdate() {
  if (!registration?.waiting) return;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
  registration.waiting.postMessage({ type: 'SKIP_WAITING' });
}
