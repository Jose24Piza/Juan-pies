importScripts('js/sw-utils.js');
importScripts('js/db.js');

const STATIC_CACHE = 'static-v4';
const DYNAMIC_CACHE = 'dynamic-v1';
const INMUTABLE_CACHE = 'inmutable-v1';

const APP_SHELL = [
    '/',
    'index.html',
    'manifest.json',
    'css/style.css',
    'img/favicon.ico',
    'img/avatars/Luffy.jpg',
    'img/avatars/roronoa.jpg',
    'img/avatars/sanji.jpg',
    'img/avatars/nami.jpg',
    'img/avatars/ussop.jpg',
    'img/icons/icon-72x72.png',
    'img/icons/icon-96x96.png',
    'img/icons/icon-128x128.png',
    'img/icons/icon-144x144.png',
    'img/icons/icon-152x152.png',
    'img/icons/icon-192x192.png',
    'img/icons/icon-384x384.png',
    'img/icons/icon-512x512.png',
    'js/app.js',
    'js/db.js',
    'js/sw-utils.js'
];

const APP_SHELL_INMUTABLE = [
    'https://fonts.googleapis.com/css?family=Quicksand:300,400',
    'https://fonts.googleapis.com/css?family=Lato:400,300',
    'https://use.fontawesome.com/releases/v5.3.1/css/all.css',
    'css/animate.css',
    'js/libs/jquery.js'
];

self.addEventListener('install', e => {
    // Activa el SW nuevo de inmediato, sin esperar a que se cierren las pestañas viejas
    self.skipWaiting();

    const cacheStatic = caches.open(STATIC_CACHE).then(cache =>
        cache.addAll(APP_SHELL));
    const cacheInmutable = caches.open(INMUTABLE_CACHE).then(cache =>
        cache.addAll(APP_SHELL_INMUTABLE));
    e.waitUntil(Promise.all([cacheStatic, cacheInmutable]));
});

self.addEventListener('activate', e => {
    const respuesta = caches.keys().then(keys => {
        return Promise.all(
            keys.map(key => {
                if (key !== STATIC_CACHE && key.includes('static')) {
                    return caches.delete(key);
                }
            })
        );
    }).then(() => self.clients.claim()); // toma el control de las pestañas abiertas ya mismo

    e.waitUntil(respuesta);
});

self.addEventListener('fetch', e => {
    const respuesta = caches.match(e.request).then(res => {
        if (res) {
            return res;
        } else {
            return fetch(e.request)
                .then(newRes => actualizarCacheDinamico(DYNAMIC_CACHE, e.request, newRes))
                .catch(() => caches.match('index.html'));
        }
    });
    e.respondWith(respuesta);
});

// Al hacer click en la notificacion, enfoca la app si ya esta abierta
// o abre una pestaña nueva si no lo esta
self.addEventListener('notificationclick', e => {
    e.notification.close();

    e.waitUntil(
        clients.matchAll({ type: 'window' }).then(listaClientes => {
            for (const cliente of listaClientes) {
                if (cliente.url.includes(self.registration.scope) && 'focus' in cliente) {
                    return cliente.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow('/');
            }
        })
    );
});

// ===== Background Sync =====
// Se dispara cuando el navegador recupera la conexion, para la tarea
// registrada como reg.sync.register('sync-mensajes') en app.js
self.addEventListener('sync', e => {
    if (e.tag === 'sync-mensajes') {
        e.waitUntil(procesarColaPendientes());
    }
});

async function procesarColaPendientes() {
    const pendientes = await obtenerPendientes();

    for (const item of pendientes) {
        // Esta app no tiene backend: "enviar" = marcar como procesado.
        // Si hubiera una API real, aqui iria el fetch(POST) correspondiente.
        await marcarEnviado(item.id);

        // Avisa a las pestañas abiertas para que actualicen la burbuja
        // de "pendiente" a "enviado" sin necesidad de recargar
        const clientesAbiertos = await self.clients.matchAll({ type: 'window' });
        clientesAbiertos.forEach(cliente => {
            cliente.postMessage({ tipo: 'mensaje-sincronizado', item });
        });

        // Notificacion push de confirmacion (Escenario: Gestion Offline y Sincronizacion)
        await self.registration.showNotification('Mensaje enviado', {
            body: item.tipo === 'foto'
                ? 'Tu foto se envió correctamente al recuperar la conexión.'
                : 'Tu mensaje se envió correctamente al recuperar la conexión.',
            icon: 'img/icons/icon-192x192.png',
            tag: 'sync-' + item.id
        });
    }
}

// ===== Push =====
// No hay servidor push real en este proyecto (no hay backend), pero el
// evento queda implementado para cumplir el ciclo de vida del SW y para
// poder probarse manualmente desde DevTools -> Application -> Service
// Workers -> "Push" (envia un payload de prueba sin necesidad de servidor).
self.addEventListener('push', e => {
    let datos = { title: 'One Piece Chat', body: 'Tienes una notificación nueva.' };

    if (e.data) {
        try {
            datos = e.data.json();
        } catch (err) {
            datos.body = e.data.text();
        }
    }

    e.waitUntil(
        self.registration.showNotification(datos.title || 'One Piece Chat', {
            body: datos.body || 'Tienes una notificación nueva.',
            icon: 'img/icons/icon-192x192.png'
        })
    );
});