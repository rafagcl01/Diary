// Configuración del balance del personaje: TODOS los valores de XP, topes y curvas de nivel están aquí.
// Para ajustar el juego basta con cambiar estos números; la lógica (model.js, activities.js, todos.js…) los lee de aquí.
// Ojo: lo ya ganado no cambia (cada apunte del registro guarda la XP que dio en su momento); las curvas sí se aplican a todo.
(function (App) {
  var R = App.rpg = App.rpg || {};

  R.CONFIG = {
    // ---- Curvas de nivel: XP para pasar del nivel n al n+1 = round(base × factor × n^exp) ----
    // Con uso medio (~120 XP/día): nivel 2 el primer día, nivel 10 en un mes y nivel 30 en un año.
    levels: {
      general: { base: 55, exp: 1.2, factor: 1, max: 30 },   // personaje: nivel 2 con 55 XP, 10 con 3.531, 30 (el máximo) con 42.801
      main: { base: 55, exp: 1.2, factor: 0.3 },              // atributos: su XP es la SUMA de la de sus subcategorías (también archivadas), así solo sube
      sub: { base: 55, exp: 1.2, factor: 0.2 }                // subcategorías: la misma forma, a la escala de lo que reciben
    },
    // Pasado el nivel máximo, la XP sigue sumando «constelaciones»: una estrella en el marco por cada `xp`. Sin reinicio.
    constellation: { xp: 3000 },

    // ---- Diario ----
    diary: { xp: 10 },                                // primer bloque con texto del día (solo la página de hoy), solo al nivel general

    // ---- Actividades ----
    activity: { xp: 5, perDay: 10, daysBack: 1 },     // 5 XP; solo las 10 primeras del día dan XP; se pueden apuntar hoy o ayer

    // ---- Tareas (una lista por día) ----
    tasks: {
      sizes: [{ id: 'pequena', label: 'Pequeña', xp: 2 }, { id: 'normal', label: 'Normal', xp: 5 }, { id: 'grande', label: 'Grande', xp: 10 }],
      perDay: 40,                                     // tope de XP por tareas al día (el bonus de la lista va aparte)
      listBonus: 20,                                  // completar la lista del día
      listMin: 3                                      // tareas mínimas para que cuente el bonus
    },

    // ---- Misiones ----
    questSizes: [
      { id: 'pequena', label: 'Pequeña', xp: 15 },
      { id: 'normal', label: 'Normal', xp: 30 },
      { id: 'dificil', label: 'Difícil', xp: 60 },
      { id: 'epica', label: 'Épica', xp: 100 }
    ],
    daily: { sizes: ['pequena', 'normal'], bonus: 15 },   // misiones diarias: 15 o 30; +15 por hacer las tres
    weekly: { maxActive: 5 },                             // misiones semanales activas a la vez

    // ---- Jefes ----
    bosses: {
      stepXp: 5,
      // El premio grande solo se cobra cuando han pasado `days` días desde que creas el jefe (los jefes son para metas grandes).
      tiers: [{ id: 'jefe', label: 'Jefe', xp: 250, days: 7 }, { id: 'mayor', label: 'Jefe mayor', xp: 400, days: 14 }, { id: 'final', label: 'Jefe final', xp: 600, days: 30 }]
    },

    // ---- XP descansada: tras `gapDays` días o más sin apuntar nada, las `count` primeras actividades de los `windowDays`
    // días siguientes (el de la vuelta y el siguiente) dan `xp` extra cada una. Apunte aparte: no gasta el cupo de 10 al día.
    rested: { gapDays: 3, count: 3, xp: 5, windowDays: 2 },

    // ---- Atributo dormido: el que menos XP ha recibido en los últimos `days` días (si esos días hay algo) ----
    dormant: { days: 7 },

    // ---- Rasgos: salen solos del historial; conseguido una vez, es para siempre. Solo decoración (no dan XP). ----
    //  kind: 'hours' (actividades apuntadas entre las horas from–to), 'days' (días distintos con algo apuntado),
    //  'variety' (actividades distintas), 'hoursSub' (actividades de la subcategoría `sub` entre from–to),
    //  'purified' (sombras purificadas). window: días seguidos en los que contar (0 = en total).
    //  Secretos (`secret: true`): en «Ver rasgos» salen como «???» hasta conseguirlos. 'fullday' (el mismo día: diario, las
    //  tres diarias y la lista del día completa), 'comeback' (volver a apuntar algo tras `gap` días o más sin nada),
    //  'midnight' (apuntar algo entre las 0:00 y las 0:`minutes`).
    // Textos con tres formas (Configuración → Tu personaje): f = femenina, m = masculina, n = neutra.
    traits: [
      { id: 'noctambula', names: { f: 'Noctámbula', m: 'Noctámbulo', n: 'Noctámbule' }, icon: 'moon', kind: 'hours', from: 22, to: 3, n: 10, window: 30, desc: '10 actividades apuntadas entre las 22:00 y las 3:00 en 30 días.' },
      { id: 'madrugadora', names: { f: 'Madrugadora', m: 'Madrugador', n: 'Madrugadore' }, icon: 'sun', kind: 'hours', from: 3, to: 8, n: 10, window: 30, desc: '10 actividades apuntadas antes de las 8:00 en 30 días.' },
      { id: 'hilo_firme', names: { f: 'Hilo firme', m: 'Hilo firme', n: 'Hilo firme' }, icon: 'bow', kind: 'days', n: 20, window: 30, desc: 'Algo apuntado 20 días distintos en 30 días.' },
      { id: 'exploradora', names: { f: 'Exploradora', m: 'Explorador', n: 'Exploradore' }, icon: 'compass', kind: 'variety', n: 10, window: 30, desc: '10 actividades distintas en 30 días.' },
      { id: 'bruja_alba', names: { f: 'Bruja del alba', m: 'Brujo del alba', n: 'Bruje del alba' }, icon: 'tarot', kind: 'hoursSub', sub: 'brujeria', from: 3, to: 9, n: 5, window: 0, desc: '5 rituales (Brujería) apuntados antes de las 9:00.' },
      { id: 'corazon_remendado', names: { f: 'Corazón remendado', m: 'Corazón remendado', n: 'Corazón remendado' }, icon: 'mended', kind: 'purified', n: 5, window: 0, desc: '5 sombras purificadas.' },
      { id: 'luna_llena', secret: true, names: { f: 'Luna llena', m: 'Luna llena', n: 'Luna llena' }, icon: 'moon', kind: 'fullday', n: 1, window: 0, desc: 'Un mismo día: escribir en el diario, hacer las tres misiones diarias y completar la lista de tareas.' },
      { id: 'hilo_de_vuelta', secret: true, names: { f: 'Hilo de vuelta', m: 'Hilo de vuelta', n: 'Hilo de vuelta' }, icon: 'mended', kind: 'comeback', gap: 14, n: 1, window: 0, desc: 'Volver a apuntar algo después de 14 días o más sin apuntar nada. Bienvenida de vuelta.' },
      { id: 'criatura_medianoche', secret: true, names: { f: 'Criatura de medianoche', m: 'Criatura de medianoche', n: 'Criatura de medianoche' }, icon: 'eye', kind: 'midnight', minutes: 5, n: 1, window: 0, desc: 'Apuntar algo entre las 0:00 y las 0:05.' }
    ],

    // ---- Decoración por nivel general (no dan XP). Calendario de premios (octubre de 2026): ----
    //  1 marco Puntada · 2 título · 5 marco Hilo suelto · 8 fondo · 12 título · 15 marco Collar de botones · 19 título ·
    //  23 fondo y marco Lacitos de encaje · 27 título · 30 marco Cabeza de muñeca rota · ✦ constelaciones (animación especial, pendiente).
    // `soon: true` = premio reservado que aún no está diseñado: se ve en «Tu camino» y en la pantalla de nivel como
    // «próximamente», pero no se gana nada todavía (ni se puede elegir). Al diseñarlo, se le pone nombre y se quita `soon`.
    frames: [
      { id: 'puntada', name: 'Puntada', level: 1 },
      { id: 'hilo_suelto', name: 'Hilo suelto', level: 5 },
      { id: 'collar_botones', name: 'Collar de botones', level: 15 },
      { id: 'lacitos_encaje', name: 'Lacitos de encaje', level: 23 },
      { id: 'cabeza_rota', name: 'Cabeza de muñeca rota', level: 30 }
    ],
    // Títulos (si tenías elegido uno que ya no existe, se ve el más alto que tengas). En el nivel 1 todavía no hay título.
    titles: [
      { id: 'muneca_olvidada', names: { f: 'Muñeca olvidada', m: 'Muñeco olvidado', n: 'Muñeque olvidade' }, level: 2 },
      { id: 'juguete_susurrante', names: { f: 'Juguete susurrante', m: 'Juguete susurrante', n: 'Juguete susurrante' }, level: 12 },
      { id: 'muneca_inquieta', names: { f: 'Muñeca inquieta', m: 'Muñeco inquieto', n: 'Muñeque inquiete' }, level: 19 },
      { id: 'gran_posesion', names: { f: 'Gran posesión', m: 'Gran posesión', n: 'Gran posesión' }, level: 27 }
    ],
    // Fondos de la ficha (detrás del avatar y el nombre), se eligen en Configuración → Tu personaje.
    backgrounds: [
      { id: 'papel', name: 'Papel', level: 1 },
      { id: 'fondo_8', name: 'Fondo nuevo', level: 8, soon: true },
      { id: 'fondo_23', name: 'Fondo nuevo', level: 23, soon: true }
    ]
  };
})(window.App = window.App || {});
