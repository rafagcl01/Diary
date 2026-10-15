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
js/diary/           Lógica del diario sin pantalla: páginas, estados de ánimo y porcentaje, emociones, personas, búsqueda, calendario, estadísticas, repositorio y borradores
js/views/diary/     Pantallas del diario: cronología, lectura y editor de la página del día (y el porcentaje de ánimo)
js/views/people/    Pantallas de Personas: lista, ficha (con historial) y formulario
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


## Fase 3: el diario (una página por día, con entradas)

Vocabulario: una **página** es un día; cada **entrada** es un momento de esa página (en los archivos se llama `blocks`).

### Cómo funciona
- **Una página por día.** Escribir añade una entrada **al final** de la página de ese día (las entradas se ordenan hacia abajo, en el orden en que las escribes). Para cambiar texto, estado, emociones, etiquetas o el orden de las entradas, abres la página de ese día y pulsas editar.
- **Título y fecha dentro de la hoja.** La fecha (y el título, si lo hay) van en la cabecera de la propia página, junto al porcentaje de ánimo; no sobre ella. En el editor, el título se escribe ahí mismo.
- **Cada entrada tiene** su texto, sus **etiquetas**, su **estado de ánimo** y sus **emociones** (todo opcional). Una entrada puede ser solo un estado, sin texto.
- **El ánimo se apunta en las entradas.** La sección *Estado de ánimo* solo muestra estadísticas. Desde el inicio, *¿Cómo te sientes hoy?* añade con un toque una entrada (solo con estado) a la página de hoy.
- **Escribir:** *Escribir hoy* abre la página de hoy; también puedes escribir en cualquier día pasado desde el calendario. Las entradas se pueden añadir, subir, bajar y quitar. Ctrl+Intro guarda.
- **Leer:** cada entrada con su texto, su estado (con nombre, no solo color), sus emociones y sus etiquetas. Los controles quedan fuera de la hoja, con *Página anterior / siguiente*.
- **Cronología y calendario**: cada día del calendario lleva a su página (o a escribirla). Hay **búsqueda** por texto (sin importar tildes ni mayúsculas), etiquetas, estado, favoritos, día y rango de fechas.
- **Borradores:** el texto se guarda cada medio segundo en este navegador, un borrador por día. Se puede escribir sin conexión con GitHub.
- La cantidad de texto no da nada: el sistema de XP no mirará cuánto escribes.

### Estados de ánimo y porcentaje
Hay cinco estados, con una escala lineal (Neutro es el centro):

| Estado | Valor |
|---|---|
| Muy bien | 100 |
| Bien | 75 |
| Neutro | 50 |
| Mal | 25 |
| Muy mal | 0 |

- **El porcentaje de la página es la media de los estados de sus entradas**, redondeada. Se ve arriba, dentro de la hoja, y también en la lista de páginas. Se actualiza con una pequeña animación (anillo y número) cuando cambia; con los efectos desactivados en Configuración o con "reducir movimiento" en el sistema, cambia al instante.
- **Las entradas sin estado no cuentan** (no se tratan como Neutro): si una página tiene 3 entradas y 2 con estado, el porcentaje es la media de esas 2 y la hoja lo dice ("Media de 2 de 3 entradas con estado"). Si ninguna tiene estado **no hay porcentaje** (se muestra un guion, no un 0 %).
- **Las emociones y las etiquetas nunca entran en el cálculo.**
- Los siete ánimos de la versión anterior se convierten solos: radiante→Muy bien, tranquila→Bien, normal y cansada→Neutro, ansiosa, triste y enfadada→Mal. El original se conserva en el archivo (`legacyMood`).

### La hoja cambia con el ánimo de la página
Según el porcentaje de la página, la hoja tiene un aspecto distinto (solo ambiente: no da ni quita puntos y no toca ningún dato):
- **Más de 75 %:** dibujos grises casi negros y muy suaves en los márgenes y esquinas (corazón con alas, rosa, corazones).
- **De 50 a 75 %:** la hoja de siempre.
- **De 25 a 49 %:** bordes rotos: unas pocas mordidas en pico hacia dentro y una esquina doblada.
- **Menos de 25 %:** lo mismo, más ovillos de rayones gruesos y oscuros en las esquinas y el margen.
Todos los dibujos y garabatos tienen el mismo grosor de trazo. Una página sin estados de ánimo queda como la normal. Los dibujos van detrás del texto, con poca opacidad y sin capturar clics. En el editor cambia en directo al elegir el estado. En navegadores muy antiguos sin soporte de máscaras CSS, los bordes se ven rectos.

### Emociones personalizables
- Son **independientes del estado**: puedes tener *Bien* + *Nostalgia* + *Ilusión*. Se eligen varias por entrada (hasta 10).
- Se crean **desde el editor**: botón *Emociones* de la entrada → todas tus emociones como cápsulas que se iluminan al pulsarlas (otra pulsación las desmarca) → el círculo **«+»** al final de las cápsulas → nombre (hasta 30 caracteres) y un símbolo de una galería de 22 iconos (estilo pastel goth / creepy cute). La nueva queda marcada, y **nada se añade a la entrada hasta pulsar *Aceptar*** (cerrar con Esc descarta la selección).
- Quedan guardadas en `emotions.json` y se reutilizan en cualquier entrada. Se puede **editar el nombre y el símbolo** con *Editar* (edita la última que hayas marcado; desmarcar no cuenta); el cambio se ve en todas las entradas que la usan. No se admiten dos emociones con el mismo nombre (sin importar tildes ni mayúsculas).
- Si `emotions.json` no se puede cargar, se puede escribir igual (sin elegirlas).

### Cómo se guardan los datos
`entries/AAAA-MM.json`, un archivo por mes:

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
      { "id": "b_01234567", "text": "Quedé con Marcos.", "tags": ["amigos"], "mood": "bien", "emotions": ["em_0a1b2c3d"] },
      { "id": "b_89abcdef", "text": "", "tags": [], "mood": "mal", "emotions": [] }
    ]
  }]
}
```

`emotions.json`:

```json
{ "version": 1, "emotions": [{ "id": "em_0a1b2c3d", "name": "Nostalgia", "symbol": "moon", "createdAt": "...", "updatedAt": "..." }] }
```

- **El día es la identidad de la página.** No se puede escribir en días que aún no han llegado.
- Cada entrada tiene un identificador propio (`b_…`); las emociones, otro (`em_…`). Cambiar el nombre de una emoción **no toca** `entries/*.json`.
- Los campos desconocidos se conservan al editar. Un archivo de mes dañado se avisa, **no se toca** y no impide leer ni escribir los demás meses.

### Dos dispositivos a la vez
- Si editas la **misma página** desde dos dispositivos y el otro ya guardó cambios, la aplicación **se niega a pisarlos** (te avisa y tu texto sigue como borrador). Recarga y vuelve a añadir lo tuyo.
- *Apuntar un estado con un toque* (inicio) no tiene ese problema: se suma a la página sin pisar nada.

### Formato antiguo
Si el diario detecta entradas con el formato anterior (varias por día), muestra *Actualizar el formato del diario* y **bloquea guardar** hasta que lo aceptes. La actualización une cada día en una página (cada texto antiguo pasa a ser una entrada, ordenadas por la hora, con las etiquetas de la entrada antigua) y no pierde texto; GitHub conserva el historial. **Descarga una copia antes** en Configuración.

### Estadísticas de ánimo
Solo muestran números calculados con tus entradas: reparto del mes, calendario (cada día con el estado que más aparece), **ánimo medio** (media de los porcentajes de las páginas), los últimos 12 meses, y pistas por etiqueta (solo con al menos 15 entradas con estado en 12 meses y 5 por etiqueta). Son asociaciones, no causas, y las emociones no intervienen.

### Privacidad de los borradores
Los borradores viven en `localStorage` de este navegador, **sin cifrar**, hasta que guardas o los descartas (máximo 20). En un ordenador compartido, descártalos al terminar.

### Límites conocidos
- Cada mes debe pesar menos de ~850 KB de texto; si lo supera, la aplicación se niega a guardar y lo explica. Una entrada admite hasta 20 000 caracteres y una página hasta 200 entradas. Hasta 200 emociones.
- Sin conexión no se puede leer ni editar lo ya guardado (solo escribir borradores).
- Personas llega en la fase 4.

### Comprobaciones manuales de la fase 3
- [ ] **Escribir hoy**, escribe, elige *Bien*, añade una emoción nueva desde *Emociones* (nombre + símbolo) y **Guardar**: la página muestra la fecha y el título dentro de la hoja, un 75 % y la emoción.
- [ ] **Añadir entrada** con *Mal*: el porcentaje pasa a 50 % con una pequeña animación.
- [ ] Edita el nombre de la emoción: el porcentaje no cambia. Quita la emoción de la entrada: tampoco.
- [ ] En la lista de páginas aparece el porcentaje de cada día; una página sin estados no muestra ninguno.
- [ ] Recarga: todo sigue ahí (existen `entries/AAAA-MM.json` y `emotions.json` en GitHub).
- [ ] En el inicio, elegir un estado y **Apuntar en el diario de hoy** añade una entrada a la página de hoy.
- [ ] Cada día pasado del calendario abre su página; los futuros no se pueden pulsar.
- [ ] Escribe algo, cierra la pestaña y reábrela: aparece "Trabajo pendiente".
- [ ] La búsqueda encuentra "música" aunque escribas "MUSICA".
- [ ] *Estado de ánimo*: reparto, calendario y 12 meses, sin ningún texto que trate un estado como un error.
- [ ] **Eliminar** pide confirmación y la página desaparece de la lista.
- [ ] Si tenías entradas antiguas: aparece el aviso de formato y tras *Actualizar formato* todo sigue ahí, una página por día.

## Fase 4: personas

Fichas de las personas de tu vida y vínculos con las entradas del diario. Todo es opcional y editable, y el sistema no puntúa ni ordena a nadie por "importancia": una ficha es un álbum, no un marcador.

### La ficha
Nombre (lo único obligatorio), **apodos**, **avatar** (la inicial o un símbolo de la galería), **relación**, **fecha aproximada en que la conociste** (un año, un mes o un día), **notas** (solo para ti), **etiquetas** y **recuerdos destacados**. Se crean y editan en *Personas*; también se puede crear una ficha mínima (nombre y relación) sin salir del editor del diario. La fotografía queda para una fase posterior, junto a los adjuntos.

- **Historial:** en la ficha ves, en orden cronológico (y puedes invertirlo), cada entrada vinculada a esa persona con su fecha, **su texto completo** (el contexto original), con quién más estaba y el enlace *Abrir la página original*. Las entradas sin vínculo no aparecen.
- **Recuerdos destacados:** *Destacar* en cualquier fragmento lo guarda arriba. Es solo una marca tuya.
- **Lista:** ahora es una **cuadrícula de tarjetas casi cuadradas** (cinta, avatar o foto, nombre, apodo, relaciones, cumpleaños y nº de recuerdos). Orden alfabético; buscador por nombre, apodo, relación, mes de cumpleaños o etiqueta (sin importar tildes ni mayúsculas). Los recuentos son solo información. Si quieres, puedes ordenar por quién tiene recuerdos más recientes.
- **Inicio:** *Personas recientes* muestra a quién has vinculado últimamente (por fecha, no por cantidad).

### Relaciones, cumpleaños, foto y emociones (ampliación)
- **Relaciones:** varias por persona, con **el mismo menú que las emociones** pero sin símbolos: botón *Relaciones* en la ficha → cápsulas que se iluminan al pulsarlas (otra pulsación las quita), círculo **«+»** al final para crear una nueva, *Editar* (renombra la última que marcaste, y el cambio se aplica a todas las fichas que la usan) y *Aceptar* (hasta pulsarlo no se añade nada; Esc descarta). Las elegidas se ven como etiquetas en la ficha. Las fichas antiguas con una sola relación se convierten solas.
- **Cumpleaños:** día y mes (el año es opcional). El día y el año se escriben a mano (sin flechas) y el mes es un desplegable propio, con esquinas suaves y colores pastel, que también se maneja con el teclado (flechas, Intro, Esc). Se ve en la tarjeta y en la ficha, y se puede buscar por el mes.
- **Foto:** un círculo con «+» (o la foto actual) abre el selector de archivos; se elige una imagen, se recorta al centro y se reduce a 160 px (JPEG) en tu navegador, y se guarda **dentro de `people.json`** (unos 2–10 KB cada una). Para no pasarse del tamaño que GitHub maneja bien, `people.json` no puede superar ~800 KB: si lo alcanzas, pide quitar alguna foto. La foto no sale de tu repositorio de datos.
- **Emociones en sus recuerdos:** en la ficha, el reparto porcentual de las emociones marcadas en las entradas vinculadas a esa persona (suma 100 %). Solo describe lo que escribiste; no es una nota para la persona, y no cambia ningún porcentaje de ánimo.

### Vincular personas a las entradas
En el editor, cada entrada tiene un botón **Personas**: un buscador sobre tus fichas (por nombre, apodo o relación), varias personas por entrada, y *Crear una ficha nueva* sin salir. Para quitar a alguien, la **×** de su etiqueta; **quitar un vínculo nunca borra el texto**.

- **Un vínculo es un dato estructurado**, no texto en el párrafo: la entrada guarda el identificador de la persona (`"people": ["pe_0a1b2c3d"]`). **Renombrar a alguien no rompe ningún vínculo** (y no modifica ni un byte de `entries/*.json`).
- **Sugerencias al escribir:** si el texto menciona un nombre o apodo de tus fichas, aparece una propuesta ("¿Hablas de Marcos? Vincular…"). **Nunca se vincula nada sin que lo confirmes.** Si un nombre puede ser de varias personas ("Lucía"), se muestran todas para que elijas o pulses *Ninguna*. Una sugerencia descartada no vuelve en esa sesión.
- **Todo se detecta en tu navegador**: el texto de tus entradas no se envía a ningún servicio externo. No hay IA externa.
- **Evitar ambigüedades:** dos fichas con el mismo nombre solo se admiten si **ambas** tienen una relación y es distinta ("Lucía, hermana" y "Lucía, compañera de trabajo"). Al crear una ficha, el editor avisa si ya existe alguien parecido. En todas las listas el nombre va acompañado de la relación.
- **En la lectura** las personas aparecen como enlaces a su ficha; los controles de vínculo solo existen en el editor.
- **Diario:** *Más filtros → Persona* muestra solo las páginas donde aparece.

### Borrar una ficha
Pide confirmación y te dice a cuántas entradas afecta. Se borra la ficha y **se quita su vínculo de las entradas**; los textos, el ánimo, las emociones y las etiquetas no se tocan. Esas páginas reciben una nueva fecha de modificación, así que otro dispositivo con la misma página abierta recibirá el aviso de que cambió en vez de pisarla. GitHub conserva el historial por si quieres recuperar algo.

### Cómo se guardan
`people.json` (nuevo, en el repositorio de datos; entra en las copias de seguridad):

```json
{ "version": 1, "people": [{
  "id": "pe_0a1b2c3d", "name": "Marcos", "nicknames": ["Marqui"], "symbol": "moon", "met": "2019-05",
  "relation": "amigo", "notes": "…", "tags": ["música"],
  "highlights": [{ "day": "2026-10-10", "block": "b_01234567" }],
  "createdAt": "…", "updatedAt": "…" }] }
```

`entries/AAAA-MM.json` añade `people` (lista de identificadores) a cada entrada. Los datos están **sin cifrar**, como el resto, en tu repositorio privado: las notas sobre otras personas viven ahí. Un `people.json` dañado se avisa y no se toca.

### Límites conocidos
- Hasta 500 fichas, 10 apodos por ficha, 20 personas por entrada y 50 recuerdos destacados por ficha. Notas de hasta 5 000 caracteres.
- Los cambios en fichas desde dos dispositivos a la vez se fusionan por archivo (gana el último que guarda): para cambios simultáneos sobre la misma ficha, recarga antes de editar.
- Una entrada borrada o desvinculada deja su recuerdo destacado "dormido" en la ficha (no se ve); si vuelves a vincularla, reaparece.
- Las sugerencias solo reconocen nombres, apodos y nombres de pila de **tus fichas**, como palabras enteras; no entienden pronombres ni apodos que no hayas guardado.

### Comprobaciones manuales de la fase 4
- [ ] *Personas → Nueva persona*: solo con el nombre se guarda; con relación, apodo, fecha y avatar también.
- [ ] Crear una segunda ficha "Lucía" sin relación avisa; con otra relación se admite.
- [ ] En el editor, escribir "Quedé con Marcos…": aparece la propuesta y **no** se vincula hasta pulsar *Vincular*.
- [ ] *Personas* → buscar por apodo, elegir a dos personas en la misma entrada, crear una ficha nueva desde el diálogo, quitar una con la ×.
- [ ] Guardar y leer la página: las personas son enlaces; en la ficha aparece el fragmento completo con su fecha y *Abrir la página original*.
- [ ] Renombrar una ficha: las entradas siguen vinculadas y muestran el nombre nuevo.
- [ ] *Destacar* un fragmento lo sube a *Recuerdos destacados*.
- [ ] Borrar una ficha: confirma, y las entradas conservan su texto y su ánimo.
- [ ] *Diario → Más filtros → Persona* filtra; en el inicio aparece *Personas recientes*.

## Fase 5A: personaje y atributos (RPG)

**Qué hay:** la ficha del personaje (nombre, avatar, nivel general con barra de XP, últimas recompensas), un radar con **cinco atributos** y sus subcategorías. Las misiones, logros, títulos y colección llegan en las siguientes fases (5B–5D).

### Reglas de la experiencia
- La XP **solo** entra por acciones explícitas: en esta fase, **«Apuntar actividad»** (tamaño Pequeña 15 / Normal 30 / Difícil 60 / Épica 100 XP) y **«Corregir experiencia»**. El diario, los estados de ánimo y las emociones **no dan ni quitan XP**; editar una entrada tampoco.
- Nivel general: para pasar del nivel *n* al *n+1* hacen falta `100 + 25·(n−1)` XP (el sobrante se conserva). Subcategorías: `80 + 20·(n−1)`.
- Al apuntar, la XP se reparte entre subcategorías por porcentajes (suman 100). Sin subcategorías, solo sube el nivel general. Los atributos principales no tienen XP propia: su valor es la media del progreso de sus subcategorías.
- **Nada se cuenta dos veces:** cada apunte lleva una clave única; reintentar, hacer doble clic o abrir la app en otro dispositivo no lo duplica. La recompensa solo se anuncia cuando GitHub ha confirmado el guardado.
- **Correcciones:** solo con un ajuste visible (con motivo) en el historial. Nunca se borra nada en silencio. El total no baja de 0.

### Atributos y subcategorías (personalizables)
Vitalidad (Fuerza, Salud, Resistencia, Descanso, Autocuidado) · Espíritu (Conocimiento, Disciplina, Brujería) · Vínculos (Amistad, Amor, Familia, Conexión) · Aventura (Experiencias, Valentía, Exploración) · Creatividad (Arte, Lectura, Películas). Puedes crear, renombrar, describir, cambiar el icono, reordenar y archivar subcategorías, y renombrar los cinco atributos. Archivar o renombrar conserva su XP e historial (se identifican por un id fijo). Brujería tiene una tarjeta propia, más mágica y misteriosa.

### El radar
Fondo de estrella de cinco puntas con las puntas unidas por un pentágono; el progreso es un polígono relleno translúcido. Las puntas son botones (ratón, táctil y teclado) y enseñan sus subcategorías. La escala (2, 3, 5, 10, 15…) crece sola y se indica bajo el gráfico. Mientras no cambies la estructura, ganar XP nunca encoge el polígono. **Ojo:** crear una subcategoría nueva baja un poco la media de su atributo (cuenta como una más a nivel 1); archivarla (con XP) no cambia nada.

### Dónde se guarda (repositorio de datos, sin cifrar)
`rpg/profile.json`, `rpg/attributes.json` y `rpg/ledger-AAAA.json` (solo se añaden apunte). El nivel nunca se guarda: se calcula del registro.

### Pruebas
`tests/rpg.test.js` (14 pruebas: niveles, reparto, idempotencia, fallo al guardar, validación, ajustes, subcategorías, radar). Comprobado además en Chromium con GitHub simulado, en escritorio y móvil (390 px, sin scroll horizontal). **No** se ha probado contra tu GitHub real.

### Límites conocidos
No hay misiones ni logros todavía. «Registrar actividades» es un apunte manual rápido. No hay deshacer: se corrige con un ajuste.
