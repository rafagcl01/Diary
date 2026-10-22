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

No se pierde XP ni nivel como castigo: nada penaliza rachas ni ausencias, el ánimo negativo no da menos XP que el positivo, y la longitud de una entrada no da más XP. **Escribir en el diario sí da XP:** 10 XP al guardar el primer bloque con texto del día (una vez por página, solo en la página de **hoy o de ayer**, sin mínimo de palabras; las páginas más antiguas se escriben igual, sin XP), solo al nivel general. Una vez ganados se quedan fijos: editar o quitar párrafos no los toca ni pregunta nada; solo se quitan si borras esa página. El ánimo y las emociones no dan XP. Nada se cuenta dos veces y el nivel se calcula siempre a partir del registro.

**Cambio de curva (rebalanceo de octubre de 2026):** la curva de niveles cambió y se aplica a todo el registro, así que con la misma XP el nivel puede ser distinto del que tenías (se decidió así, sin compensación). La XP de cada apunte no cambia: guarda lo que dio en su momento.

**Única excepción, decidida a propósito: deshacer.** Quitar algo que registraste tú (la × de una actividad, desmarcar una tarea, un paso de jefe o una misión diaria, quitar una actividad o tarea de una entrada del diario y guardar, o borrar la página) quita la XP que eso dio, y por tanto el nivel puede bajar. Por eso **siempre se pregunta antes**, en la misma fila y diciendo cuánta XP se quita (`App.ui.askRow` / `App.ui.askUncheck` en `js/components.js`). Lo que ya está fijo (un jefe derrotado, una lista completada, el día con las tres diarias hechas) no se puede deshacer.


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
- **Escribir:** en el Diario, *Escribir una entrada hoy*, *Escribir una entrada de ayer* y una fecha con *Escribir en esa fecha*; también desde el calendario. Solo hoy y ayer dan la XP del diario. Las entradas se pueden añadir, subir, bajar y quitar. Ctrl+Intro guarda.
- **Leer:** cada entrada con su texto, su estado (con nombre, no solo color), sus emociones y sus etiquetas. Encima de la hoja, *Escribir una entrada*, *Editar la página*, *Volver al diario* y el menú **⋯** (*Marcar como favorita* y *Eliminar la página*). Para **pasar la hoja** (página anterior y siguiente) hay dos flechas dentro del papel, sobre la fecha.
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
- Se crean **desde el editor**: botón *Emociones* de la entrada → todas tus emociones como cápsulas que se iluminan al pulsarlas (otra pulsación las desmarca) → el círculo **«+»** al final de las cápsulas → nombre (hasta 30 caracteres) y un símbolo de la galería única (ver *Galería de símbolos*). La nueva queda marcada, y **nada se añade a la entrada hasta pulsar *Aceptar*** (cerrar con Esc descarta la selección).
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
Solo muestran números calculados con tus entradas, para el periodo elegido arriba (**Semana / Mes / Año**, con flechas para ir hacia atrás):
- **Línea del ánimo:** un punto por día (semana, mes) o por mes (año), con el porcentaje de la página o la media del mes. Donde no hay estados no hay punto y el hueco es discontinuo: no se inventa ningún valor. Al pasar el ratón, el valor del punto.
- **Tus emociones:** gráfica circular con el porcentaje de veces que marcaste cada emoción (las 6 más frecuentes y «otras»). Va aparte: las emociones nunca cambian el porcentaje de ánimo.
- **Reparto de estados**, **ánimo medio** (media de los porcentajes de las páginas), el **calendario** (en la vista de mes) y pistas por etiqueta (solo con al menos 15 entradas con estado en 12 meses y 5 por etiqueta). Son asociaciones, no causas.
- Los colores de las gráficas (`--ch-*` en `css/tokens.css`) están comprobados para daltonismo y contraste, en claro y en oscuro.

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
- **Inicio:** ya no muestra personas; en su lugar están las *Tareas de hoy* (ver *Tareas* en la fase 5A).

### Relaciones, cumpleaños, foto y emociones (ampliación)
- **Relaciones:** varias por persona, con **el mismo menú que las emociones** pero sin símbolos: botón *Relaciones* en la ficha → cápsulas que se iluminan al pulsarlas (otra pulsación las quita), círculo **«+»** al final para crear una nueva, *Editar* (renombra la última que marcaste, y el cambio se aplica a todas las fichas que la usan) y *Aceptar* (hasta pulsarlo no se añade nada; Esc descarta). Las elegidas se ven como etiquetas en la ficha. Las fichas antiguas con una sola relación se convierten solas.
- **Cumpleaños:** día y mes (el año es opcional). El día de su cumpleaños, la hoja de hoy del inicio lo dice («Hoy es el cumpleaños de Lucía (31)», con la edad si sabes el año); el 29 de febrero se avisa el 28 en los años no bisiestos. El día y el año se escriben a mano (sin flechas) y el mes es un desplegable propio, con esquinas suaves y colores pastel, que también se maneja con el teclado (flechas, Intro, Esc). Se ve en la tarjeta y en la ficha, y se puede buscar por el mes.
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
- [ ] *Diario → Más filtros → Persona* filtra.

## Fase 5A: personaje y atributos (RPG)

**Qué hay:** la ficha del personaje (nombre, avatar, nivel general con barra de XP), un radar con **cinco atributos** y sus subcategorías. Las misiones, logros, títulos y colección llegan en las siguientes fases (5B–5D).

### Reglas de la experiencia
- La XP **solo** entra por acciones explícitas: escribir en el diario, actividades, tareas, misiones y jefes. («Corregir experiencia» existió y se quitó; las correcciones que ya se hicieron siguen contando en el registro.) Los estados de ánimo y las emociones **no dan ni quitan XP**.
- Nivel general: para pasar del nivel *n* al *n+1* hacen falta `round(55 · n^1,2)` XP (el sobrante se conserva): nivel 2 con 55 XP, 5 con 677, 10 con 3.531 y **30, el máximo, con 42.801**. Pasado el 30, la XP sigue sumando **constelaciones**: una estrella cada 3.000 XP (sin reinicio). Subcategorías: la misma forma × 0,2. Atributos: × 0,3. Ver *Balance* más abajo.
- Al apuntar, la XP se reparte entre subcategorías por porcentajes (suman 100). Sin subcategorías, solo sube el nivel general. Los atributos suben con la **suma** de la XP de todas sus subcategorías (también las archivadas, para no perder nada), con su propia curva: crear o archivar una subcategoría no les cambia el nivel, solo pueden subir.
- **Nada se cuenta dos veces:** cada apunte lleva una clave única; reintentar, hacer doble clic o abrir la app en otro dispositivo no lo duplica. La recompensa solo se anuncia cuando GitHub ha confirmado el guardado.
- **Correcciones:** solo con un ajuste visible (con motivo) en el historial. Nunca se borra nada en silencio. El total no baja de 0.

### Atributos y subcategorías (personalizables)
Vitalidad (Fuerza, Salud, Resistencia, Descanso, Autocuidado) · Espíritu (Conocimiento, Disciplina, Brujería) · Vínculos (Amistad, Amor, Familia, Conexión) · Aventura (Experiencias, Valentía, Exploración) · Creatividad (Arte, Lectura, Películas). Puedes crear, renombrar, describir, cambiar el icono, reordenar y archivar subcategorías, y renombrar los cinco atributos. Archivar o renombrar conserva su XP e historial (se identifican por un id fijo). Brujería tiene una tarjeta propia, más mágica y misteriosa.

### La ficha
Arriba a la izquierda, el personaje (el lápiz que aparece al pasar el ratón lleva a *Configuración → Tu personaje*) y debajo **Actividades**; a la derecha, el radar. Abajo, **Tareas** y **Misiones semanales**, y los jefes a lo ancho.
- **Nivel con toda tu XP:** «Nivel 2 · 70 / 218 XP» (la XP que llevas y la que hace falta para el siguiente nivel, sin la línea «en total»). La barra se llena dentro del nivel y debajo se ven sus extremos («Nivel 2 · 60» y «Nivel 3 · 218»). Igual en las subcategorías y en el inicio.
- **Tu camino** (botón al pie de la ficha): lo próximo que consigues y cuánta XP te falta; cada nivel con premio (marcos, títulos y fondos), marcando lo conseguido y dónde estás; las constelaciones; y la tabla de cómo se gana XP. Todo sale de `config.js`: si cambias niveles o recompensas, la ventana cambia sola.
- **Fondos de la ficha** (detrás del avatar y el nombre): Papel (siempre), **Acolchado ciruela** (nivel 10: rombos cosidos en ciruela con un halo lavanda) y **Cielo bordado** (nivel 20: noche ciruela con estrellas en punto de cruz y una luna). Se eligen en *Configuración → Tu personaje*.
- **Constelaciones:** en el nivel 30 (el máximo), cada 3.000 XP suma una estrella alrededor del marco (se ven 12 como mucho y, desde ahí, el número).
- **Al subir de nivel:** una pantalla breve con el avatar, «¡Nivel N!» y los premios (si hay marco nuevo, se cose alrededor). Se cierra con «Seguir», tocando fuera o con Esc; si subes varios de golpe, enseña el último con todos los premios. Se quita en *Configuración → Tu personaje* («Pantalla al subir de nivel») y, con *Efectos* apagado, sale sin animación (`js/views/rpg/levelup.js`).
- **Configuración → Tu personaje:** además del nombre, título y avatar, la **forma de los textos** (femenina, masculina o neutra, para títulos y rasgos), el **fondo** y la pantalla al subir de nivel. Se guarda en `rpg/profile.json`.
- **Estado actual** (en la ficha, bajo el nivel): como mucho **3 chips**, solo de lo que pide algo, por este orden: sombra sin purificar, misiones diarias pendientes, XP descansada, tareas pendientes y «Escribe hoy». Lo demás (lo ya hecho, actividades de hoy, atributo dormido…) va en «Ver todo». Si no hay nada pendiente: «Nada pendiente por hoy ✦».
- **Actividades:** el día y «Registrar actividad»; debajo, las **2 últimas** sin scroll interno (el resto en «Ver historial»), cada una con el icono y el nombre de su atributo (el de la subcategoría que más XP se llevó).
- **Evolución en el radar:** «Último mes» (por defecto) dibuja en punteado cómo estaba hace 30 días; el hueco entre las dos formas es lo que has crecido. «Desde el principio» dibuja anillos de crecimiento, uno por mes (los 12 últimos), más claros cuanto más antiguos. Se calcula del registro de XP (`R.radarHistory` en `js/rpg/model.js`), no se guarda nada aparte.

### Sombras (`rpg/shadows.json`)
Una sombra es algo que vuelve y no quieres que mande (insomnio, rumiar, el móvil a deshoras). Su bloque va entre *Tareas · Misiones semanales* y *Jefes*.
- **Nunca quita XP, ni da.** Las sombras no tocan el registro de XP. Purificarlas tampoco da XP extra: el contrahechizo da sus 5 XP de siempre.
- **Contrahechizos:** cada sombra tiene una o varias actividades. Una aparición queda **purificada** si ese día o el siguiente registras uno de ellos. No se guarda: se calcula del registro de XP, así que si borras el contrahechizo vuelve a «sin purificar».
- **Apuntarla:** «Apareció hoy» en su tarjeta (una vez por día; el día acaba a las 3:00), con «Deshacer». Desde el diario, en la ventana de Actividades de una entrada, la fila **«Sombras de hoy»**: al guardar la página quedan apuntadas para ese día, y quitarlas de la entrada (o borrar la página) las borra. Como no hay XP en juego, no se pregunta. Para días pasados, la tira de su tarjeta.
- **Glitch en el avatar:** mientras haya una aparición de hoy o de ayer sin purificar, el avatar de la ficha tiene un glitch oscuro (franjas desplazadas, bordes desdoblados en magenta y lavanda, líneas de barrido y píxeles muertos), con tirones cortos. Al purificarla con un contrahechizo de hoy se calma: rayas quietas y suaves, hasta el final del día. Con *Efectos* apagado se ve quieto. También sale en *Estado actual*.
- **Tarjeta:** contrahechizos, tira de los últimos 14 días cosida (hoy y los 13 anteriores; hilo vacío / puntada oscura si apareció / puntada cerrada lavanda si se purificó). **Cada día de la tira se puede pulsar:** pregunta «¿Apareció el …?» para apuntarla ese día, o «¿Quitar la del …?» si ya estaba (también la desvincula de la página del diario de ese día). Los días futuros no se aceptan y recuento del mes. Con **4 apariciones en 14 días** ofrece *Convertir en jefe* (abre *Nuevo jefe* ya relleno: su nombre y un paso «contrahechizo × 5» por cada uno) o *Ahora no* (se esconde hasta que vuelva a pasar).
- **Frecuencia:** barras de los últimos 6 meses (purificadas y sin purificar), de todas o de una. Sin rachas ni castigos.
- Editar (lápiz, o «⋯» en táctil): nombre, icono, contrahechizos y *Archivar* (se esconde; su historial se queda). Las archivadas se recuperan desde su lista.
- En el registro de apariciones: una por sombra y día (`sh:<sombra>:<día>`), con `from: 'ficha' | 'diario'`. En las entradas del diario se guardan como `shadows: [{ id, name }]`.

### XP descansada, atributo dormido y rasgos (`js/rpg/growth.js`)
Tres extras suaves. Ninguno castiga: no hay rachas que se rompan ni XP que se pierda. Todo se calcula del registro; no se guarda nada aparte. Valores en `config.js`.
- **XP descansada:** tras **3 días o más sin apuntar nada**, las **3 primeras actividades** del día en que vuelves y del siguiente dan **+5 extra** cada una, a las mismas subcategorías. Es un apunte aparte (`rested:<clave de la actividad>`): no gasta el cupo de 10 actividades al día y nunca se da dos veces. Si borras la actividad, su extra se va con ella (y la confirmación lo cuenta). Se ve en *Estado actual* y encima de las últimas actividades («Bienvenida de vuelta…»).
- **Atributo dormido:** el que menos XP ha recibido en los **últimos 7 días** (solo si esos días has apuntado algo; con empate, el primero de la ficha). En el radar su nombre brilla en lavanda con un «zZ», y sale en *Estado actual*. Una de las tres **misiones diarias** es suya, con el sello **«Despierta»**: da la misma XP que las demás. Si la cambias con el dado, sale otra del mismo atributo.
- **Rasgos:** salen solos del historial y, una vez conseguidos, son **para siempre** (solo decoración). Noctámbula (10 actividades apuntadas entre las 22:00 y las 3:00 en 30 días), Madrugadora (10 antes de las 8:00 en 30 días), Hilo firme (algo apuntado 20 días distintos en 30), Exploradora (10 actividades distintas en 30 días), Bruja del alba (5 rituales de Brujería antes de las 9:00) y Corazón remendado (5 sombras purificadas). Cuenta la hora a la que lo apuntas. Tienen forma femenina, masculina y neutra. Hay tres **secretos**, que en «Ver rasgos» salen como «???» hasta conseguirlos: Luna llena (el mismo día: diario, las tres diarias y la lista completa), Hilo de vuelta (volver a apuntar algo tras 14 días o más sin nada) y Criatura de medianoche (apuntar algo entre las 0:00 y las 0:05). En la ficha, los 3 más recientes junto al título; «Ver rasgos» enseña todos, con lo que piden y cómo vas.

### Tareas (`rpg/todos.json`)
**Una sola lista del día**, «Tareas de hoy». Cada tarea es Pequeña (+2), Normal (+5) o Grande (+10) y da su XP al marcarla, con un **tope de 40 XP al día** por tareas: la que lo cruza da lo que queda y las siguientes se marcan igual, con 0 XP (la tarjeta enseña «XP de tareas hoy: 25 / 40»). **Completar la lista da +20** si tiene al menos 3 tareas (aparte del tope). Toda la XP de tareas (y el +20) va **solo al nivel general**: no se reparte entre subcategorías (el reparto que pudiera traer un archivo antiguo se ignora). Desmarcar quita la XP de esa tarea (y volver a marcarla la da una sola vez); con la lista completada, lo marcado queda fijo, pero se pueden añadir y marcar tareas nuevas. Las tareas se añaden escribiendo en la tarjeta (Intro) y cada una se puede editar en su fila, subir, bajar y quitar (al pasar el ratón; en táctil, en el «⋯»). Claves en el registro: `todo:<lista>:<tarea>` y `todo:<lista>` (el +20).
- **Cada día, una lista:** a las **3:00** (lo de después de medianoche cuenta como el mismo día) lo hecho se borra y lo pendiente pasa a la lista del día siguiente. La XP ganada se queda.
- **Desde el inicio:** la tarjeta *Tareas de hoy* enseña la misma lista (hasta 5 tareas): se marcan, se desmarcan (con la misma pregunta) y se añaden escribiendo (Intro, tamaño Normal). Editar, ordenar y quitar, en la ficha.
- **Desde el diario:** en la ventana de Actividades de una entrada, «De tus tareas de hoy». Las que marques quedan en la entrada (cápsula clara con visto; se guarda su texto en `"tasks"`) y, al guardar la página, se marcan con su XP, una sola vez.
- **De varias listas a una (migración):** el archivo antiguo (`lists: [...]`) se pasa solo a `{ version: 2, list }` la primera vez que abres Personaje. La lista de hoy conserva sus tareas (también las hechas); lo pendiente de las demás se le añade. Lo hecho en otras listas no pasa: su XP ya está en el registro.

### Misiones diarias (`rpg/daily.json`)
Encima de Tareas y Misiones semanales, **tres misiones al azar cada día** (de atributos distintos si se puede), en fila. Se renuevan a las **3:00**. Cada una es Pequeña (15) o Normal (30) y su XP va a su subcategoría; hacer **las tres da +15** («¡Día completo!»), y entonces quedan fijas. Desmarcar quita su XP. El **dado** cambia una sin hacer por otra: **3 cambios al día**. Las tres del día se guardan, así que recargar no las cambia.
- **La batería:** 51 de fábrica repartidas entre las 24 subcategorías (`R.DAILY_DEFAULTS` en `js/rpg/daily.js`) más las tuyas. En *Configuración → Misiones diarias* se filtran por atributo, se eliminan (las de fábrica se pueden recuperar) y se añaden nuevas (nombre, subcategoría y tamaño).
- En el registro: `daily:<día>:<misión>` y `daily:<día>` (el premio del día).

### Misiones semanales: una semana o todas
Al crear o editar una misión se elige **«Solo esta semana»** (se borra el lunes a las 3:00, con sus casillas) o **«Repetir cada semana»** (vuelve a empezar cada lunes). Las misiones de antes de este cambio repiten. La XP ganada siempre se queda.
- **Como mucho 5 activas** a la vez.
- Las de actividades aceptan **una o varias**: «Hacer ejercicio 3 veces» puede valer con *Ir al gimnasio* o *Caminar o correr*. Cuenta **como mucho una por actividad y día** (gimnasio y correr el mismo día cuentan 2; dos veces el gimnasio el mismo día cuenta 1). Lo mismo en los pasos de jefe de tipo actividad. Las de 0 XP por el tope también cuentan.

### Atributos: siete
Vitalidad, Espíritu, Vínculos, Aventura, Creatividad, **Inteligencia** (Lógica, Idioma, Comunicación) y **Yo futuro** (Finanzas, Carrera profesional, Objetivos personales). Los dos últimos se añadieron después: si ya tenías datos, aparecen solos a nivel 1 y no cambia nada de lo que tenías (nombres, archivados, XP). Usan el mismo sistema de XP y niveles, y salen en el radar, en misiones, jefes, actividades y «Corregir XP». El radar es una estrella de siete puntas {7/3} (cada punta unida con la que está tres más allá).

### Primera prueba con GitHub: en un repositorio de PRUEBA
Antes de usar tu repositorio de verdad:
1. En GitHub, crea un repositorio **privado y vacío** solo para probar (por ejemplo `diario-prueba`), sin README.
2. Crea un token *fine-grained* (Settings → Developer settings → Fine-grained tokens) con acceso **solo a ese repositorio** y permiso *Contents: Read and write*. Pon una caducidad corta.
3. Abre `index.html` y, en *Configuración → Tus datos*, conecta `tu-usuario/diario-prueba` con ese token. La app solo prepara un repositorio vacío (crea `meta.json`): si tiene otras cosas, se niega.
4. Prueba un poco de todo: escribe una página del diario, registra actividades, marca tareas y misiones, apunta una sombra y cambia el avatar. En GitHub deben aparecer `entries/…`, `rpg/ledger-AAAA.json`, `rpg/todos.json`, `rpg/shadows.json`…
5. Abre la app en **otro navegador** (o en una ventana privada), conecta el mismo repositorio y comprueba que ves lo mismo: nivel, XP, tareas y sombras.
6. *Configuración → Copia de seguridad → Descargar copia*: guarda el archivo. Crea un segundo repositorio vacío de prueba, conéctalo, usa *Importar copia…* y comprueba que todo vuelve igual.
7. Desconecta y borra el token cuando acabes. Cuando todo esté bien, conecta tu repositorio real con un token nuevo solo para él.

### Balance (`js/rpg/config.js`)
Todos los valores de XP, topes y curvas están en un solo archivo, `js/rpg/config.js`: se ajustan ahí sin tocar la lógica. Lo ya ganado no cambia (cada apunte guarda su XP); las curvas sí se aplican a todo.

| Fuente | XP | Tope al día |
|---|---|---|
| Escribir en el diario (primer bloque con texto, página de hoy o de ayer) | 10, solo nivel general | 10 |
| Actividades (se apuntan hoy o ayer) | 5 cada una | las 10 primeras: 50 |
| Tareas | 2 / 5 / 10 | 40 |
| Lista del día completa (3 tareas o más) | 20 | 20 |
| Misiones diarias | 15 o 30, +15 por las tres | 105 |
| Misiones semanales (máx. 5 activas) | 15 / 30 / 60 / 100 | — |
| Jefes | 5 por paso; 250 / 400 / 600 (tras 7 / 14 / 30 días) | — |

Con un uso medio (unos 120 XP al día) se llega al nivel 2 el primer día, al 5 en una semana, al 10 en un mes y al 30 (el máximo) en un año; un atributo típico, al 10 en unos dos meses. Marcos, títulos y fondos también están en `config.js`.

### Una sola fuente de verdad para el personaje
La ficha, el inicio y Configuración leen del mismo repositorio (`App.rpg.repo()`: registro de XP, perfil y atributos). Nada se calcula ni se guarda aparte. Cada cambio guardado avisa (`repo.onChange`) y las pantallas abiertas se repintan sin recargar.

### Componentes compartidos (`js/components.js` y el bloque «Componentes compartidos» de `app.css`)
- **Desplegable:** cada `<select>` se convierte solo en el desplegable de la aplicación (el `<select>` sigue debajo, oculto, guardando el valor).
- **Número con − y +:** `App.ui.stepper(...)` (porcentajes de 5 en 5, puntos de 1 en 1; también se escribe). Sin flechas del navegador en ningún número.
- **Casilla:** todas las checkbox comparten estilo y animación.
- **Galería de símbolos única** (`App.SYMBOLS` en `js/icons.js`, 39 símbolos en 4 grupos: corazón y cosas bonitas, cielo y tiempo, magia y misterio, vida diaria) y **una sola caja para elegir** (`App.ui.symbolPicker`). La usan actividades, subcategorías, sombras, emociones, personas y el avatar. Al editar sale cerrada (símbolo actual + «Cambiar»); al crear algo nuevo sale abierta con todos. `R.ICONS`, `R.AVATARS` y `D.EMOTION_SYMBOLS` apuntan a ella, así que los símbolos ya guardados siguen valiendo.
- **Barras de desplazamiento:** el mismo estilo en vertical y horizontal.
- **Lápiz para editar:** `App.ui.editButton(...)` en tarjetas `.has-edit` (ficha, misiones, jefes, listas): aparece al pasar el ratón.
- **Menú «⋯» en pantallas táctiles** (`App.ui.enhanceMenus`): donde no hay ratón (`hover: none`), los controles que solo aparecen al pasar el ratón (lápiz, × de actividades y tareas) se sustituyen por un «⋯» que abre un menú con ellos; mantener pulsada la tarjeta o la fila medio segundo abre el mismo menú. Basta con marcar el anfitrión (`.has-edit` o `data-menu-host`) y sus controles (`data-menu-label`).
- **Títulos** (`titles` en `js/rpg/config.js`), cada uno con forma femenina, masculina y neutra: Muñeca inquieta (nivel 1), Aprendiz de aguja (3), Muñeca susurrante (7), Hilandera de lunas (12), Guardiana del costurero (16), Remendadora de sombras (22), Reina de los alfileres (27) y Gran posesión (30). Se ve el más alto conseguido o el que elijas en *Configuración → Tu personaje* (se guarda en `rpg/profile.json`, junto con la forma de los textos). Solo decoración.
- Pasos de jefe con casilla: marcar da 5 XP; desmarcar los quita (se borra el apunte); nunca se cuentan dos veces. Con el jefe derrotado quedan fijos.

### Avatar y marcos
- El avatar se cambia en *Configuración → Tu personaje* (el botón *Editar personaje* de la ficha lleva ahí): **símbolo** de la galería, **foto** (se recorta cuadrada y se reduce a 320 px en el navegador; se guarda en `rpg/profile.json`, sin cifrar) o **enlace a una imagen o GIF de internet** (clic derecho sobre la imagen → «Copiar dirección de la imagen»; solo se guarda el enlace, no se descarga; si no carga, se ve el símbolo). Sitios admitidos: ver *Seguridad* más abajo.
- Alrededor del avatar hay un **marco que mejora con el nivel**: Puntada (1), Hilo suelto (2), Encaje (5), Puntada doble (9), Encaje lunar (14), Lazo ciruela (18), Espinas de terciopelo (25) y Corona remendada (30). Solo es decoración. La lista está en `frames` (`js/rpg/config.js`) y cada dibujo en `js/views/rpg/avatar.js`.

### La ficha y el radar
La ficha cabe en una pantalla: a la izquierda, nivel y últimas recompensas; a la derecha, el radar (en móvil, todo apilado). Fondo de estrella de cinco puntas con las puntas unidas por un pentágono; el progreso es un polígono relleno translúcido. **Pulsar un atributo convierte el radar en el de sus subcategorías**, con una flecha arriba a la izquierda para volver. Pasar el ratón o enfocar una punta enseña su resumen; pulsar una subcategoría enseña su detalle (nivel, XP, historial, editar). El botón **Gestionar** abre la lista para crear, renombrar, reordenar y archivar subcategorías. Con otro número de ejes el fondo se adapta (triángulo, cuadrado…). Todo es accesible con teclado.
La escala (2, 3, 5, 10, 15…) crece sola y se indica bajo el gráfico. Mientras no cambies la estructura, ganar XP nunca encoge el polígono. **Ojo:** crear una subcategoría nueva baja un poco la media de su atributo (cuenta como una más a nivel 1); archivarla (con XP) no cambia nada.

### Dónde se guarda (repositorio de datos, sin cifrar)
`rpg/profile.json`, `rpg/attributes.json` y `rpg/ledger-AAAA.json` (solo se añaden apunte). El nivel nunca se guarda: se calcula del registro.

### Pruebas
`tests/rpg.test.js` (14 pruebas: niveles, reparto, idempotencia, fallo al guardar, validación, ajustes, subcategorías, radar). Comprobado además en Chromium con GitHub simulado, en escritorio y móvil (390 px, sin scroll horizontal). **No** se ha probado contra tu GitHub real.

### Límites conocidos
No hay misiones ni logros todavía. «Registrar actividades» es un apunte manual rápido. No hay deshacer: se corrige con un ajuste.

## Fase 5B: actividades, misiones semanales y jefes (en la ficha del personaje)

Todo vive en **Personaje**, en tres columnas bajo el radar (la sección «Misiones» ya no existe; `#/misiones` lleva a Personaje).

- **Actividades:** todas dan exactamente **5 XP**, repartidos en puntos enteros entre subcategorías; solo las **10 primeras del día** dan XP (las demás se registran con 0 XP y la ficha lo dice) y se pueden apuntar **hoy o ayer** (en páginas del diario más antiguas, las actividades nuevas se quedan en la página sin apuntarse). Hay 19 predefinidas; puedes crear las tuyas, editarlas y archivarlas. La columna muestra un botón **«Añadir actividad»** y las 3 últimas registradas; el botón abre una ventana con todas (buscador, se marcan una o varias y *Registrar*), **«+ Nueva actividad»** y *Editar*. Al crear una, eliges si **solo se registra esta vez** (puntual, no se guarda) o si **se guarda para repetirla**. Cada registro guarda su copia de puntos. Al pasar el ratón por un registro aparece una **×** para **borrarlo del todo** (se confirma en la misma fila): desaparece de `rpg/ledger-AAAA.json` y sus XP dejan de contar; si venía del diario, también se quita de su entrada. **Ver historial** (abajo a la derecha) enseña todas las actividades registradas por meses, con la misma cruz. Los «anulados» del sistema anterior se quedan en el registro y no se muestran.
- **Actividades desde el diario:** cada entrada tiene un botón **Actividades** (la misma ventana; desde ahí solo actividades guardadas o nuevas guardadas). La entrada guarda sus identificadores (`"activities": ["gimnasio"]`). Al **guardar la página**, cada par entrada + actividad se registra **una sola vez** (clave `act:blk:<entrada>:<actividad>`) con el día de la página, y aparece el aviso *«Tu personaje se ha actualizado»*. Quitar la actividad de la entrada, o borrar la entrada, **no resta XP**. Si algo falla al registrar, la página queda guardada y basta con volver a guardarla. No cuentan para el porcentaje de ánimo.
- **Misiones semanales** (de lunes a domingo, se renuevan solas): XP 15/30/60/100 según tamaño. Dos modos: *ligada a una actividad* («X veces a la semana»: se completa sola al registrarla, sin botón de reclamar) o *casillas* (una o varias, que marcas tú).
- **Jefes finales:** varios pasos (check o actividad × veces). Cada paso da 5 XP; derrotarlo da 250 / 400 / 600 XP. Son para metas grandes: el premio de la derrota solo se cobra a partir de **7 / 14 / 30 días** desde que lo creas (jefe / mayor / final). Si completas los pasos antes, el jefe queda **Derrotado** (fijo) con un **cofre lacrado** («El botín se abre en X días»); ese día la XP se cobra sola y, la primera vez que abres la ficha, el cofre se abre con una animación corta (una vez por jefe y navegador; con *Efectos* apagado, ya abierto). Imagen: dibujo incluido (SVG), o **enlace a una imagen o GIF de internet** de los sitios admitidos (no se descarga ni se guarda en tu repositorio; si no carga, se muestra el dibujo).
- **Eliminar misiones y jefes:** no se archivan; *Editar → Eliminar* (los jefes derrotados, desde su tarjeta) los borra de `rpg/weekly.json` / `rpg/bosses.json`, con las casillas marcadas de la misión. Se confirma en el mismo sitio y no se puede deshacer. **La XP que ya dieron se queda** en el registro. Lo que estuviera archivado con la versión anterior se borra solo al abrir Personaje.
- **Avisos:** al completar una misión, un paso, un jefe o subir de nivel aparece una notificación.
- **Datos:** `rpg/activities.json`, `rpg/weekly.json`, `rpg/bosses.json`; las recompensas van al registro `rpg/ledger-AAAA.json` con claves únicas (`weekly:<id>:<semana>`, `boss:<id>[:<paso>]`), así que nunca se dan dos veces. `rpg/quests.json` (versión anterior) no se toca ni se usa (su código ya no existe en la aplicación).
- **Seguridad:** la política de contenido (`img-src` en `index.html`) solo permite imágenes propias y de una lista de sitios: Giphy, Tenor, Imgur, Pinterest (`i.pinimg.com`), Wikipedia (`upload.wikimedia.org`), Unsplash, Google Fotos (`*.googleusercontent.com`), Reddit (`i.redd.it`, `preview.redd.it`), Tumblr, Flickr y X (`pbs.twimg.com`). Así, aunque se colara código malicioso, no podría sacar datos a otra web a través de una imagen. Para añadir un sitio hay que ponerlo en los dos lados: en `HOSTS` y `R.IMAGE_SITES` (`js/rpg/bosses.js`) y en la política de `index.html` (una prueba comprueba que coinciden). Ojo: la web de la imagen ve tu IP cada vez que se carga.
- **Límites conocidos:** borrar una actividad después de que una misión o paso ya diera su recompensa no la retira. Al crear subcategorías, la media del atributo en el radar baja.

Siguiente: logros, títulos y colección (5C).
