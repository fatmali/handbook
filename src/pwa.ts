export async function registerPWA(onUpdate: (registration: ServiceWorkerRegistration) => void, onError: (error: unknown) => void) {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL });
    if (registration.waiting) onUpdate(registration);
    registration.addEventListener('updatefound', () => {
      const worker = registration.installing;
      worker?.addEventListener('statechange', () => { if (worker.state === 'installed' && navigator.serviceWorker.controller) onUpdate(registration); });
    });
    return registration;
  } catch (error) { onError(error); }
}
