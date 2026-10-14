// Errores de almacenamiento con un código estable y un mensaje en español.
// Los mensajes nunca incluyen el token.
(function (App) {
  var MESSAGES = {
    auth: 'GitHub no acepta el token (puede haber caducado). Genera uno nuevo y vuelve a conectar.',
    forbidden: 'El token no tiene permiso de escritura en este repositorio. Necesita el permiso «Contents: Read and write».',
    ratelimit: 'GitHub ha limitado las peticiones por ahora. Espera unos minutos y vuelve a intentarlo.',
    notfound: 'No encuentro el repositorio, o el token no tiene acceso a él. Revisa el nombre (usuario/repositorio) y los permisos del token.',
    conflict: 'Los datos han cambiado desde otro dispositivo. Vuelve a cargarlos e inténtalo de nuevo.',
    network: 'No hay conexión con GitHub. Comprueba tu conexión a internet.',
    'public-repo': 'Ese repositorio es público. Por privacidad, el diario solo se conecta a repositorios privados.',
    stale: 'Esta entrada ha cambiado desde otro dispositivo. Recarga la página para ver la versión nueva; tu texto sigue guardado como borrador.',
    invalid: 'Los datos no tienen el formato esperado.',
    unknown: 'GitHub ha respondido con un error inesperado.'
  };

  // Uso: throw App.storageError('auth')  /  throw App.storageError('invalid', 'texto concreto')
  App.storageError = function (code, detail) {
    var e = new Error(detail || MESSAGES[code] || MESSAGES.unknown);
    e.name = 'StorageError';
    e.code = MESSAGES[code] ? code : 'unknown';
    return e;
  };
})(window.App = window.App || {});
