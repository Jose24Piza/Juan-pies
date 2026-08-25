/**
 * db.js — capa de IndexedDB compartida entre la página (app.js) y el
 * Service Worker (sw.js). Se carga con <script> en index.html y con
 * importScripts() en sw.js, así que va en formato de funciones globales
 * clásicas (nada de módulos ES).
 *
 * Guarda mensajes/fotos/ubicaciones que el usuario intenta enviar
 * mientras no hay conexión, para que el Service Worker (Background Sync)
 * o la propia página (fallback) los procesen al recuperar la red.
 */

const ONEPIECE_DB_NAME = 'onepiece-db';
const ONEPIECE_DB_VERSION = 1;
const ONEPIECE_STORE = 'pendientes';

function abrirDB() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(ONEPIECE_DB_NAME, ONEPIECE_DB_VERSION);

        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(ONEPIECE_STORE)) {
                const store = db.createObjectStore(ONEPIECE_STORE, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                store.createIndex('estado', 'estado', { unique: false });
            }
        };

        req.onsuccess = (e) => resolve(e.target.result);
        req.onerror = (e) => reject(e.target.error);
    });
}

// Guarda un item pendiente. item = { tipo, personaje, mensaje, foto, lat, lng, lugar }
async function guardarPendiente(item) {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(ONEPIECE_STORE, 'readwrite');
        const store = tx.objectStore(ONEPIECE_STORE);

        const registro = Object.assign({}, item, {
            estado: 'pendiente',
            creado: Date.now()
        });

        const req = store.add(registro);
        req.onsuccess = (e) => resolve(e.target.result); // id autogenerado
        req.onerror = (e) => reject(e.target.error);
    });
}

// Devuelve solo los items que siguen pendientes de envío
async function obtenerPendientes() {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(ONEPIECE_STORE, 'readonly');
        const store = tx.objectStore(ONEPIECE_STORE);
        const req = store.getAll();

        req.onsuccess = (e) => {
            const todos = e.target.result || [];
            resolve(todos.filter((item) => item.estado === 'pendiente'));
        };
        req.onerror = (e) => reject(e.target.error);
    });
}

// Marca un item como enviado (no lo borra, para poder mostrar historial/depurar)
async function marcarEnviado(id) {
    const db = await abrirDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(ONEPIECE_STORE, 'readwrite');
        const store = tx.objectStore(ONEPIECE_STORE);
        const getReq = store.get(id);

        getReq.onsuccess = () => {
            const item = getReq.result;
            if (!item) {
                resolve(null);
                return;
            }
            item.estado = 'enviado';
            item.enviado = Date.now();
            const putReq = store.put(item);
            putReq.onsuccess = () => resolve(item);
            putReq.onerror = (e) => reject(e.target.error);
        };
        getReq.onerror = (e) => reject(e.target.error);
    });
}
