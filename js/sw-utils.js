function actualizarCacheDinamico(dynamicCache, req, res) {
    if (req.url.startsWith('chrome-extension://')) {
        return res;
    }

    if (res && res.ok) {
        return caches.open(dynamicCache).then(cache => {
            cache.put(req, res.clone());
            return res.clone();
        });
    }

    return res;
}
