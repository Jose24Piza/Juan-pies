
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
var avatarSel   = $('#seleccion');
var timeline    = $('#timeline');

var modal       = $('#modal');
var modalAvatar = $('#modal-avatar');
var avatarBtns  = $('.seleccion-avatar');
var txtMensaje  = $('#txtMensaje');

// El usuario, contiene el ID del héroe seleccionado
var usuario;




// ===== Codigo de la aplicación

function crearMensajeHTML(mensaje, personaje) {

    var content =`
    <li class="animated fadeIn fast">
        <div class="avatar">
            <img src="img/avatars/${ personaje }.jpg">
        </div>
        <div class="bubble-container">
            <div class="bubble">
                <h3>@${ personaje }</h3>
                <br/>
                ${ mensaje }
            </div>
            
            <div class="arrow"></div>
        </div>
    </li>
    `;

    timeline.prepend(content);
    cancelarBtn.click();

    mostrarNotificacion('Nuevo mensaje de @' + personaje, {
        body: mensaje,
        icon: 'img/avatars/' + personaje + '.jpg'
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

    crearMensajeHTML( mensaje, usuario );

});


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