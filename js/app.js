
if(navigator.serviceWorker  ){
    navigator.serviceWorker.register('/sw.js')
} // registra el service worker

// Referencias de jQuery

var titulo      = $('#titulo');
var nuevoBtn    = $('#nuevo-btn');
var salirBtn    = $('#salir-btn');
var notifBtn    = $('#notif-btn');
var cancelarBtn = $('#cancel-btn');
var postBtn     = $('#post-btn');
var markerBtn   = $('#marker-btn');
var photoBtn    = $('#photo-btn');
var avatarSel   = $('#seleccion');
var timeline    = $('#timeline');

var modal       = $('#modal');
var modalAvatar = $('#modal-avatar');
var avatarBtns  = $('.seleccion-avatar');
var txtMensaje  = $('#txtMensaje');

var offlineBanner = $('#offline-banner');
var installBanner  = $('#install-banner');
var toast          = $('#toast');

var cameraModal    = $('#camera-modal');
var cameraCerrar   = $('#camera-cerrar');
var cameraVideo    = $('#camera-video');
var cameraCanvas   = $('#camera-canvas');
var cameraPreview  = $('#camera-preview');
var cameraCapturar = $('#camera-capturar');
var cameraRepetir  = $('#camera-repetir');
var cameraEnviar   = $('#camera-enviar');

// El usuario, contiene el ID del héroe seleccionado
var usuario;

// Stream de la cámara mientras está abierta
var cameraStream = null;

// El evento beforeinstallprompt guardado, para poder disparar el prompt
// de instalación cuando el usuario toca el botón (Escenario: Instalabilidad)
var deferredPrompt = null;




// ===== Codigo de la aplicación

// Dibuja un mensaje (texto, foto o ubicación) en el timeline.
// item.estado === 'pendiente' lo pinta atenuado con un reloj, para
// distinguir lo que sigue en la cola offline de lo ya enviado.
function renderMensaje(item) {

    var esPendiente = item.estado === 'pendiente';
    var idAttr = item.id !== undefined && item.id !== null ? item.id : '';

    var cuerpo = item.tipo === 'foto'
        ? '<img class="foto-mensaje" src="' + item.foto + '">'
        : item.mensaje;

    var iconoPendiente = esPendiente
        ? ' <i class="fa fa-clock pendiente-icon" title="Pendiente de enviar"></i>'
        : '';

    var content = `
    <li class="animated fadeIn fast ${ esPendiente ? 'pendiente' : '' }" data-id="${ idAttr }">
        <div class="avatar">
            <img src="img/avatars/${ item.personaje }.jpg">
        </div>
        <div class="bubble-container">
            <div class="bubble">
                <h3>@${ item.personaje }${ iconoPendiente }</h3>
                <br/>
                ${ cuerpo }
            </div>

            <div class="arrow"></div>
        </div>
    </li>
    `;

    timeline.prepend(content);

}

// Quita la marca de "pendiente" de una burbuja ya enviada/sincronizada
function marcarBurbujaEnviada(id) {

    var li = document.querySelector('li[data-id="' + id + '"]');
    if (!li) return;

    li.classList.remove('pendiente');
    var icono = li.querySelector('.pendiente-icon');
    if (icono) icono.remove();

}

// Punto de entrada único para mandar cualquier cosa al chat (texto, foto o
// ubicación). Si hay conexión se muestra de inmediato; si no la hay, se
// guarda en IndexedDB como pendiente y se registra para reintentarse
// cuando vuelva la red (Background Sync, con respaldo manual).
async function enviarOEncolar(item) {

    if (navigator.onLine) {
        renderMensaje(item);
        mostrarNotificacion('Nuevo mensaje de @' + item.personaje, {
            body: item.tipo === 'foto' ? '📷 Foto' : item.mensaje.replace(/<[^>]+>/g, ''),
            icon: 'img/avatars/' + item.personaje + '.jpg'
        });
        return;
    }

    // Sin conexión: se guarda localmente y se muestra como pendiente
    var id = await guardarPendiente(item);
    renderMensaje(Object.assign({}, item, { id: id, estado: 'pendiente' }));
    mostrarToast('Sin conexión: se enviará automáticamente cuando vuelva internet.');

    if ('serviceWorker' in navigator && 'SyncManager' in window) {
        try {
            // navigator.serviceWorker.ready no rechaza si el registro falla:
            // se queda pendiente para siempre. Le ponemos un límite de tiempo
            // para no dejar colgada esta función si el SW nunca llega a activarse.
            var listo = await Promise.race([
                navigator.serviceWorker.ready,
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000))
            ]);
            await listo.sync.register('sync-mensajes');
        } catch (err) {
            // Si el registro de Background Sync falla (o no hay SW activo a
            // tiempo), el listener 'online' de más abajo sirve de respaldo
            // para procesar la cola igual.
        }
    }

}

// Respaldo para navegadores sin Background Sync (Safari, Firefox): procesa
// la cola pendiente directamente desde la página al detectar el evento 'online'.
async function procesarColaManual() {

    var pendientes = await obtenerPendientes();

    for (var i = 0; i < pendientes.length; i++) {
        var item = pendientes[i];
        await marcarEnviado(item.id);
        marcarBurbujaEnviada(item.id);
        mostrarNotificacion('Mensaje enviado', {
            body: item.tipo === 'foto' ? 'Tu foto se envió correctamente.' : 'Tu mensaje se envió correctamente.',
            icon: 'img/favicon.ico'
        });
    }

}

// El Service Worker avisa por aquí cuando procesa la cola (Background Sync)
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', function (e) {
        if (e.data && e.data.tipo === 'mensaje-sincronizado') {
            marcarBurbujaEnviada(e.data.item.id);
        }
    });
}



// Globals
function logIn( ingreso ) {

    if ( ingreso ) {
        nuevoBtn.removeClass('oculto');
        salirBtn.removeClass('oculto');
        timeline.removeClass('oculto');
        avatarSel.addClass('oculto');
        modalAvatar.attr('src', 'img/avatars/' + usuario + '.jpg');
        actualizarBotonNotificaciones();
    } else {
        nuevoBtn.addClass('oculto');
        salirBtn.addClass('oculto');
        timeline.addClass('oculto');
        avatarSel.removeClass('oculto');
        notifBtn.addClass('oculto');
        detenerCamara();

        titulo.text('Seleccione Personaje');

    }

}


// Seleccion de personaje
avatarBtns.on('click', function() {

    usuario = $(this).data('user');

    titulo.text('@' + usuario);

    logIn(true);

});

// Boton de salir
salirBtn.on('click', function() {

    logIn(false);

});

// Boton de nuevo mensaje
nuevoBtn.on('click', function() {

    modal.removeClass('oculto');
    modal.animate({
        marginTop: '-=1000px',
        opacity: 1
    }, 200 );

});

// Boton de cancelar mensaje
cancelarBtn.on('click', function() {
   modal.animate({
       marginTop: '+=1000px',
       opacity: 0
    }, 200, function() {
        modal.addClass('oculto');
        txtMensaje.val('');
    });
});

// Boton de enviar mensaje
postBtn.on('click', function() {

    var mensaje = txtMensaje.val();
    if ( mensaje.length === 0 ) {
        cancelarBtn.click();
        return;
    }

    enviarOEncolar({ tipo: 'texto', personaje: usuario, mensaje: mensaje });
    cancelarBtn.click();

});


// ===== Geolocalización =====
// Usa la API de BigDataCloud (reverse geocoding, sin necesidad de API key)
// para convertir coordenadas en un lugar legible. Si no hay red o la API
// falla, se usan las coordenadas crudas como respaldo.
markerBtn.on('click', function() {

    if ( !('geolocation' in navigator) ) {
        mostrarToast('Este dispositivo no tiene geolocalización disponible.');
        return;
    }

    navigator.geolocation.getCurrentPosition(async function(pos) {

        var lat = pos.coords.latitude;
        var lng = pos.coords.longitude;
        var lugar = lat.toFixed(4) + ', ' + lng.toFixed(4); // respaldo sin red/API

        if ( navigator.onLine ) {
            try {
                var resp = await fetch(
                    'https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + lat +
                    '&longitude=' + lng + '&localityLanguage=es'
                );
                if ( resp.ok ) {
                    var data = await resp.json();
                    var partes = [data.city || data.locality, data.principalSubdivision, data.countryName]
                        .filter(Boolean);
                    if ( partes.length ) lugar = partes.join(', ');
                }
            } catch (err) {
                // Sin red hacia la API: se usan las coordenadas ya calculadas arriba
            }
        }

        enviarOEncolar({
            tipo: 'ubicacion',
            personaje: usuario,
            mensaje: '<i class="fa fa-map-marker-alt"></i> Estoy en ' + lugar,
            lat: lat,
            lng: lng
        });

        cancelarBtn.click();

    }, function(err) {
        mostrarToast('No se pudo obtener tu ubicación: ' + err.message);
    }, { enableHighAccuracy: true, timeout: 8000 });

});


// ===== Cámara =====

async function abrirCamara() {

    if ( !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia ) {
        mostrarToast('Este dispositivo no tiene cámara disponible.');
        return;
    }

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'environment' },
            audio: false
        });
    } catch (err) {
        mostrarToast('No se pudo acceder a la cámara: ' + err.message);
        return;
    }

    cameraVideo[0].srcObject = cameraStream;

    cameraVideo.removeClass('oculto');
    cameraPreview.addClass('oculto');
    cameraCapturar.removeClass('oculto');
    cameraRepetir.addClass('oculto');
    cameraEnviar.addClass('oculto');

    cameraModal.removeClass('oculto');

}

function detenerCamara() {

    if ( cameraStream ) {
        cameraStream.getTracks().forEach(function(track) { track.stop(); });
        cameraStream = null;
    }

}

function cerrarCamara() {
    detenerCamara();
    cameraModal.addClass('oculto');
}

// El boton de foto vive dentro del modal de "nuevo mensaje": lo ocultamos
// y abrimos la cámara a pantalla completa encima
photoBtn.on('click', function() {
    modal.addClass('oculto');
    abrirCamara();
});

cameraCerrar.on('click', cerrarCamara);

cameraCapturar.on('click', function() {

    var video  = cameraVideo[0];
    var canvas = cameraCanvas[0];

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    cameraPreview.attr('src', canvas.toDataURL('image/jpeg', 0.8));

    cameraVideo.addClass('oculto');
    cameraPreview.removeClass('oculto');
    cameraCapturar.addClass('oculto');
    cameraRepetir.removeClass('oculto');
    cameraEnviar.removeClass('oculto');

    detenerCamara(); // se libera la cámara mientras se revisa la foto

});

cameraRepetir.on('click', function() {
    abrirCamara();
});

cameraEnviar.on('click', function() {

    var foto = cameraPreview.attr('src');

    enviarOEncolar({ tipo: 'foto', personaje: usuario, mensaje: '', foto: foto });

    cerrarCamara();

});


// ===== Estado de conexión =====

function actualizarEstadoConexion() {

    if ( navigator.onLine ) {
        offlineBanner.addClass('oculto');
        $('body').removeClass('offline');
    } else {
        offlineBanner.removeClass('oculto');
        $('body').addClass('offline');
    }

}

window.addEventListener('online', function() {
    actualizarEstadoConexion();
    mostrarToast('Conexión recuperada — enviando lo pendiente…');

    // Si el navegador no soporta Background Sync, procesamos la cola aquí mismo
    if ( !('serviceWorker' in navigator) || !('SyncManager' in window) ) {
        procesarColaManual();
    }
});

window.addEventListener('offline', actualizarEstadoConexion);

actualizarEstadoConexion(); // estado inicial al cargar la página


// ===== Aviso corto (toast) =====

var toastTimeout;

function mostrarToast(mensaje) {
    clearTimeout(toastTimeout);
    toast.text(mensaje);
    toast.removeClass('oculto');
    toastTimeout = setTimeout(function() {
        toast.addClass('oculto');
    }, 3500);
}


// ===== Notificaciones =====

// Muestra u oculta el boton de notificaciones segun el permiso actual
function actualizarBotonNotificaciones() {

    if ( !('Notification' in window) ) {
        // El navegador no soporta notificaciones
        notifBtn.addClass('oculto');
        return;
    }

    if ( Notification.permission === 'default' ) {
        // Aun no se ha pedido permiso: mostramos el boton para pedirlo
        notifBtn.removeClass('oculto');
    } else {
        // 'granted' (ya activas) o 'denied' (bloqueadas): no hace falta el boton
        notifBtn.addClass('oculto');
    }

}

// Envia (muestra) una notificacion si el permiso esta concedido
function mostrarNotificacion( titulo, opciones ) {

    if ( !('Notification' in window) || Notification.permission !== 'granted' ) {
        return;
    }

    if ( navigator.serviceWorker && navigator.serviceWorker.ready ) {
        navigator.serviceWorker.ready.then( reg => reg.showNotification( titulo, opciones ) );
    } else {
        new Notification( titulo, opciones );
    }

}

// Boton de notificaciones: pide el permiso al usuario
notifBtn.on('click', function() {

    Notification.requestPermission().then( permiso => {

        actualizarBotonNotificaciones();

        if ( permiso === 'granted' ) {
            mostrarNotificacion('¡Notificaciones activadas!', {
                body: 'Te avisaremos cuando llegue un nuevo mensaje.',
                icon: 'img/favicon.ico'
            });
        }

    });

});


// ===== Instalación (PWA) =====

// Chrome/Edge disparan este evento cuando la app cumple los requisitos de
// instalabilidad. Lo guardamos para poder mostrarlo cuando el usuario
// toque el botón, en vez de dejar que el navegador decida cuándo ofrecerlo.
window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    deferredPrompt = e;
    installBanner.removeClass('oculto');
});

installBanner.on('click', async function() {

    if ( !deferredPrompt ) {
        // iOS Safari (y otros navegadores sin beforeinstallprompt) no
        // permiten disparar la instalación por código: se instala a mano
        mostrarToast('Para instalar: toca "Compartir" y elige "Agregar a pantalla de inicio".');
        return;
    }

    installBanner.addClass('oculto');
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;

});

window.addEventListener('appinstalled', function() {
    installBanner.addClass('oculto');
    deferredPrompt = null;
    mostrarToast('¡Aplicación instalada correctamente!');
});

// iOS no dispara beforeinstallprompt: mostramos igual el boton con
// instrucciones manuales, salvo que ya este corriendo instalada
var esIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
var yaInstalada = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

if ( esIOS && !yaInstalada ) {
    installBanner.removeClass('oculto');
}
