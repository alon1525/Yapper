import type { Copy } from './en';

/** Español. Tuteo throughout — this is a group chat, not a bank. */
export const ES: Partial<Copy> = {
  'deck.next': 'Siguiente',
  'deck.prev': 'Anterior',
  'deck.restart': 'Volver al principio',
  'deck.mute': 'Silenciar la música',
  'deck.unmute': 'Poner la música',

  'welcome.fallbackName': 'Vuestro chat',
  'welcome.poster': 'Yapped.',
  'welcome.punchline':
    'Reg se leyó los {messages} mensajes para que vosotros no tengáis que hacerlo. {days} de esto. Id pasando. Subid el volumen.',

  'total.eyebrow': 'Daños totales',
  'total.unit': 'mensajes · {people} personas',
  'total.punchline':
    'Son {perDay} al día, todos los días, durante {days}. Incluidos los años en los que decíais estar «ocupados».',
  'total.words': 'Palabras',
  'total.emoji': 'Emojis',
  'total.media': 'Multimedia',

  'talker.eyebrow': 'Ranking de cháchara',
  'talker.punchline': 'El {share} de todos los mensajes de este chat salió de una sola persona.',
  'talker.punchlineRunnerUp': 'Eso es {times} veces más que {name}, que ni se acerca.',

  'hours.eyebrow': 'A qué hora habláis',
  'hours.peak': 'Hora punta: {hour}',
  'hours.punchline':
    '{count} mensajes enviados entre medianoche y las 5 de la mañana. Nadie los pidió. Llegaron igual.',
  'hours.tag': 'Turno de noche: {name} · {count} después de medianoche',

  'fastest.eyebrow': 'El gatillo más rápido',
  'fastest.punchline':
    'A lo largo de {count} respuestas, contestó antes de que los demás terminaran de leer.',
  'fastest.fastest': 'Más rápido',
  'fastest.slowest': 'Más lento · {name}',

  'ghost.eyebrow': 'Fantasma certificado',
  'ghost.punchline': 'Desaparecido todo ese tiempo sin un solo mensaje.',
  'ghost.stillGone': 'Y no ha vuelto. El grupo siguió sin él.',
  'ghost.returned': 'Y luego volvió como si nada.',
  'ghost.lastSeen': 'Visto por última vez',
  'ghost.stillGoneLabel': 'Sigue sin aparecer',
  'ghost.resurfaced': 'Reapareció',

  'emoji.eyebrow': 'Podio de emojis',
  'emoji.punchline':
    '{emoji} se usó {count} veces. Aquí ninguna conversación seria ha durado lo suficiente como para necesitar un segundo.',
  'emoji.punchlineRunnerUp':
    '{emoji} se usó {count} veces, {times} veces más que {other}. Aquí ninguna conversación seria ha durado lo suficiente como para necesitar un segundo.',

  'chaos.eyebrow': 'Caos máximo',
  'chaos.unit': '{count} mensajes en un solo día',
  'chaos.punchline': '{times} veces un día normal. Algo pasó. Todos se acuerdan de qué.',

  'streak.eyebrow': 'Racha más larga',
  'streak.days': 'días',
  'streak.punchline': 'Ni un solo día en silencio entre el {from} y el {to}.',
  'streak.silence': 'El otro extremo: {days} de silencio absoluto, roto por fin con «{quote}».',
  'streak.tag': 'Aquí nadie ha dejado nunca un chat sin leer',

  'final.eyebrow': 'Veredicto del grupo',
  'final.headline': 'Mándaselo al grupo',
  'final.punchline':
    '{messages} mensajes, {span}, y aun así nadie se ha ido. Eso es amor, técnicamente.',
  'final.privacy': 'Tu chat nunca se subió a ningún sitio. Cierra la pestaña y desaparece.',
  'final.restart': 'Probar otro chat',

  'share.open': 'Crear una tarjeta',
  'share.title': 'Elige qué publicar',
  'share.lede':
    'Cada una es una tarjeta 9:16 creada en tu dispositivo. No se sube nada: la imagen se hace aquí y pasa directamente a la app que elijas.',
  'share.count': '{n} seleccionadas',
  'share.none': 'Elige al menos una',
  'share.share': 'Compartir',
  'share.sharing': 'Abriendo…',
  'share.save': 'Guardar en fotos',
  'share.saveDesktop': 'Descargar',
  'share.saving': 'Guardando…',
  'share.copyCaption': 'Copiar texto',
  'share.captionCopied': 'Texto copiado',
  'share.caption': '{messages} mensajes nuestros. Yapped se los leyó todos.',
  'share.hint':
    'En el menú de compartir están WhatsApp, Instagram y TikTok. En Instagram y TikTok, elige la tarjeta desde tus fotos y publícala como historia.',
  'share.hintDesktop':
    'Los navegadores de escritorio no pueden abrir el menú de compartir, así que las tarjetas se descargan. Pásalas al móvil o publícalas desde aquí.',
  'share.failed': 'No ha funcionado. Las tarjetas siguen guardadas en tu dispositivo.',
  'share.close': 'Cerrar',
  'share.watermark': 'yapped',

  'card.total.label': 'MENSAJES',
  'card.total.caption': '{days} hablando. Todavía no se ha ido nadie.',
  'card.talker.label': 'REY DE LA CHÁCHARA',
  'card.talker.caption': 'El {share} de todo lo dicho aquí',
  'card.leaderboard.label': 'EL RANKING',
  'card.hours.label': 'HORA PUNTA',
  'card.hours.caption': '{count} mensajes de madrugada',
  'card.ghost.label': 'FANTASMA CERTIFICADO',
  'card.ghost.caption': '{days} sin decir una palabra',
  'card.emoji.label': 'MÁS USADO',
  'card.emoji.caption': 'Usado {count} veces',
  'card.chaos.label': 'CAOS MÁXIMO',
  'card.chaos.caption': '{count} mensajes en un día',
  'card.fastest.label': 'RESPUESTA MÁS RÁPIDA',
  'card.fastest.caption': 'Mediana de {count} respuestas',
  'card.verdict.label': 'EL VEREDICTO',
  'card.verdict.caption': '{people} personas · {span}',

  'time.midnight': 'medianoche',
  'time.noon': 'mediodía',
  'time.am': '{h} de la mañana',
  'time.pm': '{h} de la tarde',
  'duration.underMinute': 'menos de un minuto',
  'duration.underSecond': 'menos de un segundo',
  'duration.seconds': '{n} s',
  'duration.minutes': '{n} min',
  'duration.hours': '{n} h',
  'duration.hoursMinutes': '{n} h {m} min',
  'span.hours': '{n} horas',
  'span.days': '{n} días',
  'span.months': '{n} meses',
  'span.years': '{n} años',
};
