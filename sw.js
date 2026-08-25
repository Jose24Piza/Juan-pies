importScripts('js/sw-utils.js');

const STATIC_CACHE = 'static-v3';
const DYNAMIC_CACHE = 'dynamic-v1';
const INMUTABLE_CACHE = 'inmutable-v1';

const APP_SHELL = [
    '/',
    'index.html',
    'css/style.css',
    'img/favicon.ico',
    'img/avatars/Luffy.jpg',
    'img/avatars/roronoa.jpg',
    'img/avatars/sanji.jpg',
    'img/avatars/nami.jpg',
    'img/avatars/ussop.jpg',
    'js/app.js',
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