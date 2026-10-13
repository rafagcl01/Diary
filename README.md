# Mi diario (RPG)

Diario personal privado con una capa de progresión inspirada en los RPG. Aplicación web estática (HTML, CSS y JavaScript, sin dependencias ni paso de compilación). Se puede abrir en local con doble clic y, cuando estés conforme, publicarse con GitHub Pages.

**Estado:** fase 2 de 8. Hay estructura, diseño base (identidad "Corazón Remendado": pastel goth / creepy cute, con superficies claras y oscuras) y navegación. Ya se puede conectar un repositorio privado de datos en GitHub y hacer copias de seguridad; todavía no se pueden escribir entradas.

## Estructura

```
index.html          Página única
css/tokens.css      Sistema de diseño: colores, tipografías, radios, sombras y tema claro/oscuro (aquí se cambia la estética)
css/app.css         Estilos de la aplicación
js/main.js          Arranque, barra lateral, barra inferior móvil y hoja "Más"
js/router.js        Navegación por hash (#/diario)
js/sections.js      Lista de secciones: para añadir una, crea su vista, añade su <script> en index.html y regístrala aquí
js/prefs.js         Preferencias de interfaz (solo en este navegador)
js/ui.js            Utilidades de interfaz (escape de HTML, cabeceras, estados vacíos, descargas)
js/storage/         Capa de almacenamiento (ver abajo)
js/views/           Una vista por sección
tests/              Pruebas automáticas (node --test) y un GitHub de mentira para probar sin red
```

## Privacidad: qué se guarda y dónde

- **Este repositorio contiene solo código.** No debe contener entradas, personas, exportaciones ni credenciales. El `.gitignore` excluye las rutas habituales, pero revisa siempre antes de subir.
- **Datos del diario (a partir de la fase 2):** irán en un repositorio privado de GitHub **distinto** de este.
- **Los datos no se cifran.** Un repositorio privado solo es visible para tu cuenta y para quien añadas como colaborador, pero GitHub como empresa puede acceder técnicamente a él, y quien consiga tu cuenta o tu token verá todo. Además, el historial de commits conserva todo lo que se suba, aunque luego se borre.
- **Token de acceso:** usa un token *fine-grained* limitado solo al repositorio de datos, con permiso de lectura y escritura de contenido y con fecha de caducidad. Activa la verificación en dos pasos en tu cuenta de GitHub.
- **Nunca cambies a público el repositorio de datos.**
- **Ajustes de interfaz** (nombre para el saludo, animaciones): se guardan en el navegador (`localStorage`), no en GitHub.
- **Servicios externos:** Google Fonts (las tipografías se descargan desde sus servidores al abrir la página). No hay analítica ni IA externa.

## Probar en local

Abre `index.html` con doble clic en tu navegador. No hace falta servidor ni instalar nada: el JavaScript usa scripts clásicos (no módulos) precisamente para que funcione así.

- Las tipografías (IM Fell English, Nunito y Silkscreen) se descargan de Google Fonts; sin internet se ven con tipografías del sistema.
- Los ajustes (nombre, animaciones) se guardan en el navegador. Si abres el archivo desde otra ubicación o con otro navegador, empezarán de cero.

Pruebas automáticas (opcionales, requieren Node 18 o superior): `node --test`

## Publicar con GitHub Pages

1. Crea un repositorio **privado** (por ejemplo `diario-rpg`) y sube estos archivos.
2. En el repositorio: *Settings > Pages > Build and deployment > Deploy from a branch*, rama `main`, carpeta `/ (root)`.
3. Según tu plan de GitHub, Pages en repositorios privados puede requerir un plan de pago.
4. Para actualizar la aplicación, sube los archivos nuevos al mismo repositorio.

## Comprobaciones manuales de la fase 1

- [ ] `index.html` se abre con doble clic y muestra la página con estilos.
- [ ] Todas las secciones se abren desde la barra lateral (escritorio).
- [ ] En móvil aparece la barra inferior y "Más" abre las demás secciones.
- [ ] Al cambiar de sección con el teclado, el foco pasa al título de la página.
- [ ] Escribir un nombre en Configuración cambia el saludo del Inicio y se conserva al recargar.
- [ ] En el logo, al pasar el cursor, la grieta del corazón se abre y aparece un ojo.
- [ ] Con los efectos en OFF (barra lateral o Configuración) se paran las estrellitas y los destellos de las tarjetas.
- [ ] El tema claro, el oscuro y el automático se ven bien y el texto se lee sin esfuerzo.
- [ ] Cada sección tiene su fondo propio; Personaje es una escena oscura.
- [ ] No hay desplazamiento horizontal en móvil.
- [ ] Configuración > Tus datos: con un repositorio privado vacío y un token válido, **Conectar** funciona y aparece «Conectado».
- [ ] Con un repositorio público, o con el repositorio del código, se niega a conectar.
- [ ] Al recargar la página, la barra lateral muestra «Datos: usuario/repositorio».
- [ ] **Descargar copia** baja un archivo; en otro repositorio vacío, **Importar copia…** lo recupera.

## Plan por fases

1. Base: estructura, diseño y navegación (**esta**).
2. Almacenamiento: conexión con el repositorio privado de datos, exportación e importación.
3. Diario: entradas, borradores, búsqueda, calendario.
4. Personas: fichas, editor por bloques y vínculos con párrafos.
5. Estado de ánimo y actividades.
6. Sistema RPG: atributos, XP, niveles, historial sin duplicados.
7. Misiones y colección.
8. Acabado: capítulos, copias de seguridad, accesibilidad y animaciones.

## Reglas del sistema RPG (fijas desde el principio)

No se pierde XP ni nivel, no se penalizan las rachas, el ánimo negativo no da menos XP que el positivo, y la longitud de una entrada no da más XP.


## Fase 2: tus datos en GitHub

La aplicación guarda tus datos como archivos JSON en un **repositorio privado distinto** de este. La capa de almacenamiento está separada del resto:

```
js/storage/errors.js          Errores con código y mensaje en español (nunca incluyen el token)
js/storage/github-adapter.js  Habla con la API de GitHub (leer, escribir, borrar, listar)
js/storage/store.js           Reglas: rutas válidas, una escritura a la vez, conflictos, exportar e importar
js/storage/connection.js      Guarda dónde están los datos, verifica que es seguro y entrega el almacén
```

### Preparar el repositorio de datos (una sola vez)

1. En GitHub, crea un repositorio **privado** nuevo, por ejemplo `diario-datos`. Déjalo vacío (se admite README, .gitignore o licencia).
2. Crea un token: *Settings > Developer settings > Personal access tokens > Fine-grained tokens > Generate new token*.
   - *Repository access:* **Only select repositories**, y elige solo `diario-datos`.
   - *Repository permissions:* **Contents: Read and write** (Metadata queda en lectura automáticamente).
   - *Expiration:* una fecha de caducidad (por ejemplo, 90 días).
3. En la aplicación: *Configuración > Tus datos*. Escribe `tu-usuario/diario-datos`, pega el token y pulsa **Conectar**.

### Qué comprueba al conectar

- Que el repositorio es **privado**: si es público, se niega a conectar.
- Que el token puede escribir.
- Que el repositorio está vacío o ya es de este diario. Si tiene otros archivos (por ejemplo, el código de la aplicación), **se niega** para no escribir donde no debe.
- Crea `meta.json` con un identificador de usuario. Una segunda conexión no lo cambia.

### Qué se guarda y dónde

- **En GitHub (repositorio de datos):** archivos `.json` legibles y **sin cifrar**. El historial de commits conserva todo.
- **En este navegador:** el nombre del repositorio y, si marcas "Recordar el token", el token (en `localStorage`, en texto). Si no lo marcas, el token solo vive en memoria hasta que cierres la pestaña.
- **Seguridad añadida:** la página solo puede conectarse a `api.github.com`, de modo que el token no podría enviarse a otro servidor.
- Un token fine-grained limitado al repositorio de datos y con caducidad reduce el daño si alguien lo consigue. Activa la verificación en dos pasos en tu cuenta.

### Copias de seguridad y recuperación

- **Descargar copia:** *Configuración > Copia de seguridad > Descargar copia* genera un archivo `diario-rpg-copia-AAAA-MM-DD.json` con todos tus datos. Guárdalo fuera de GitHub.
- **Recuperar:** crea un repositorio vacío nuevo, conéctalo y usa *Importar copia…*. Por defecto no sobrescribe lo que ya existe; puedes marcar "Sobrescribir". El `meta.json` del destino nunca se sustituye.
- Si importas y algo falla, se detiene e indica en qué archivo; volver a importar no duplica nada.
- Sin la aplicación: los datos son JSON normales en tu repositorio, se pueden leer y descargar desde GitHub.

### Conflictos entre dispositivos

Las escrituras van de una en una. Si editas desde dos dispositivos y GitHub detecta que el archivo cambió, la aplicación vuelve a leerlo y reaplica tu cambio (hasta 3 veces) en lugar de pisar el del otro dispositivo.

### Límites conocidos

- Hace falta conexión a internet para guardar en GitHub. Los borradores locales llegarán con el diario (fase 3).
- Cada archivo debe pesar menos de ~900 KB; por eso las entradas se repartirán por meses.
- Las fotos no se guardan aquí (fase posterior).
