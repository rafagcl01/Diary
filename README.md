# Mi diario (RPG)

Diario personal privado con una capa de progresión inspirada en los RPG. Aplicación web estática (HTML, CSS y JavaScript, sin dependencias ni paso de compilación). Se puede abrir en local con doble clic y, cuando estés conforme, publicarse con GitHub Pages.

**Estado:** fase 3 de 8. Hay estructura, diseño base (identidad "Corazón Remendado": pastel goth / creepy cute, con superficies claras y oscuras) y navegación. Ya se puede conectar un repositorio privado de datos en GitHub, hacer copias de seguridad y llevar el diario (escribir, editar, buscar, calendario y borradores).

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
js/diary/           Lógica del diario sin pantalla: entradas, búsqueda, calendario, estadísticas, repositorio y borradores
js/views/diary/     Pantallas del diario: cronología, lectura y editor por bloques
js/views/mood.js    Estadísticas de ánimo
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


## Fase 3: el diario (una entrada por día, con bloques)

### Cómo funciona
- **Una entrada por día.** Cada entrada tiene un título opcional y **varios bloques**. Cada bloque lleva su propio texto, sus **etiquetas** y su **estado de ánimo** (opcional). Un bloque puede ser solo un ánimo, sin texto.
- **El ánimo se apunta en los bloques.** La sección *Estado de ánimo* ya no registra nada: solo muestra estadísticas. Desde el inicio, *¿Cómo te sientes hoy?* añade con un toque un bloque (solo con ánimo) a la entrada de hoy.
- **Las etiquetas hacen de actividades.** No hay una lista aparte de actividades ni emociones secundarias: si quieres anotar "paseo" o "dibujar", usa una etiqueta en el bloque.
- **Escribir:** *Escribir hoy* (`#/diario/hoy`) abre el día con un bloque nuevo; también puedes escribir en otra fecha pasada. Los bloques se pueden añadir, subir, bajar y quitar. Ctrl+Intro guarda.
- **Leer:** cada bloque con su texto, su ánimo (con su nombre, no solo color) y sus etiquetas. Los controles (editar, favorito, eliminar, añadir bloque) quedan fuera de la hoja.
- **Cronología y calendario** por días, **búsqueda** por texto (sin importar tildes ni mayúsculas, en títulos, bloques y etiquetas), etiquetas, ánimo, favoritos, día y rango de fechas.
- **Borradores:** el texto se guarda cada medio segundo en este navegador, con un borrador por día. Si cierras la pestaña, el diario muestra "Trabajo pendiente". Se puede escribir sin conexión con GitHub.
- La cantidad de texto no da nada: el sistema de XP llega en la fase 6 y no mirará cuánto escribes.

### Cómo se guardan las entradas
Un archivo por mes en el repositorio de datos: `entries/AAAA-MM.json`.

```json
{
  "month": "2026-10",
  "version": 2,
  "entries": [{
    "day": "2026-10-13",
    "title": "Tarde de sábado",
    "favorite": false,
    "createdAt": "2026-10-13T19:30:12.000Z",
    "updatedAt": "2026-10-13T19:30:12.000Z",
    "blocks": [
      { "id": "b_01234567", "text": "Quedé con Marcos.", "tags": ["amigos"], "mood": "radiante" },
      { "id": "b_89abcdef", "text": "", "tags": [], "mood": "cansada" }
    ]
  }]
}
```

- **El día es la identidad de la entrada** (no hay otro identificador). No se puede escribir en días que aún no han llegado.
- **Cada bloque tiene un identificador propio** (`b_…`). En la fase 4 las personas se vincularán a esos identificadores, así que corregir un texto no rompe nada.
- Los **ánimos** son: radiante, tranquila, normal, cansada, ansiosa, triste y enfadada. Su orden en el selector es solo ese; ninguno cuenta más ni menos que otro.
- Los campos desconocidos se conservan al editar, para que una versión futura no pierda datos.
- Un archivo de mes dañado se avisa, **no se toca** y no impide leer ni escribir los demás meses.

### Dos dispositivos a la vez
- Si editas el **mismo día** desde dos dispositivos y el otro ya guardó cambios, la aplicación **se niega a pisarlos** (te avisa y tu texto sigue como borrador). Recarga para ver la versión nueva y vuelve a añadir lo tuyo.
- *Añadir un ánimo con un toque* (inicio) no tiene ese problema: se suma al día sin pisar nada.
- Días distintos se fusionan sin problema.

### Formato antiguo (si ya habías escrito entradas en la versión anterior)
Antes había varias entradas por día, con fecha y hora y etiquetas de entrada. Si el diario detecta ese formato, muestra *Actualizar el formato del diario* y **bloquea guardar** hasta que lo aceptes. La actualización une las entradas de cada día en una (cada texto antiguo pasa a ser un bloque, ordenados por la hora a la que los escribiste), copia las etiquetas de la entrada a todos sus bloques y no pierde texto; GitHub conserva el historial. **Antes de actualizar, descarga una copia** en Configuración. Los borradores de la versión anterior también se convierten solos.

### Estadísticas de ánimo
La sección *Estado de ánimo* solo muestra números calculados con tus bloques:
- **Mes:** cuántos bloques con ánimo, en cuántos días, el reparto (con el número escrito y el porcentaje) y un calendario donde cada día se colorea con el ánimo que más aparece (si empatan, el del último bloque del día).
- **Mes a mes:** los últimos 12 meses en columnas; pulsa una para ver ese mes.
- **Etiquetas y ánimo:** para las etiquetas con al menos 5 bloques con ánimo, qué ánimo aparece más en ellos, comparado con el total. Solo se muestra si hay al menos 15 bloques con ánimo en los últimos 12 meses.
- Son **asociaciones, no causas**, no hay diagnósticos ni juicios sobre qué ánimo es "mejor" y con pocos datos no se saca ninguna pista.

### Privacidad de los borradores
Los borradores viven en `localStorage` de este navegador, **sin cifrar**, hasta que guardas la entrada o los descartas (como máximo 20). En un ordenador compartido, descártalos al terminar.

### Límites conocidos
- Cada mes debe pesar menos de ~850 KB de texto; si lo supera, la aplicación se niega a guardar y lo explica. Un bloque admite hasta 20 000 caracteres y una entrada hasta 200 bloques.
- Sin conexión no se puede leer ni editar lo ya guardado (solo escribir borradores).
- La búsqueda por personas llega con la fase 4; las fotos, más adelante.

### Comprobaciones manuales de la fase 3
- [ ] Con los datos conectados: **Escribir hoy**, escribir en un bloque, elegir un ánimo, añadir una etiqueta, **Añadir bloque** y **Guardar**: se abre la lectura con los dos bloques.
- [ ] Recarga y la entrada sigue ahí (y existe `entries/AAAA-MM.json` en GitHub).
- [ ] En el inicio, elegir un ánimo y **Apuntar en el diario de hoy** añade un bloque a la entrada de hoy.
- [ ] **Escribir en esa fecha** con un día pasado crea esa entrada; un día futuro no se puede.
- [ ] Escribe algo, cierra la pestaña y reábrela: aparece "Trabajo pendiente".
- [ ] La búsqueda encuentra "música" aunque escribas "MUSICA"; el calendario, las etiquetas, el filtro de ánimo y favoritos filtran.
- [ ] *Estado de ánimo*: con varios ánimos apuntados se ven el reparto, el calendario y los 12 meses, sin ningún texto que juzgue un ánimo.
- [ ] **Eliminar** pide confirmación y el día desaparece de la lista.
- [ ] Si tenías entradas antiguas: aparece el aviso de formato, y tras *Actualizar formato* todo sigue ahí, una entrada por día.
