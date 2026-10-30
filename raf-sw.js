/*
 * Service worker de RAF : celui d'Angular (cache hors ligne, mises a jour) plus
 * l'affichage des notifications push.
 *
 * Le backend envoie { title, body, url, type, data }. Le worker d'Angular
 * n'affiche que les charges utiles de la forme { notification: {...} } : il ignore
 * donc celles-ci, et c'est ce fichier qui les affiche, sans doublon.
 */
importScripts('./ngsw-worker.js');

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'RAF', body: event.data ? event.data.text() : '' };
  }
  if (payload.notification) {
    return; // format Angular : deja affiche par ngsw-worker
  }
  event.waitUntil(
    self.registration.showNotification(payload.title || 'RAF', {
      body: payload.body || '',
      icon: 'icons/icon-192x192.png',
      badge: 'icons/icon-96x96.png',
      tag: payload.type || undefined,
      data: { url: payload.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Le lien du backend est absolu (APP_FRONTEND_URL) : on n'en garde que le chemin,
  // pour rester dans l'application installee quel que soit son domaine.
  let path = '/';
  try {
    const url = new URL(event.notification.data && event.notification.data.url, self.location.origin);
    path = url.pathname + url.search;
  } catch (e) {}
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.postMessage({ type: 'RAF_OPEN', path });
          return client.focus();
        }
      }
      return self.clients.openWindow(path);
    }),
  );
});
