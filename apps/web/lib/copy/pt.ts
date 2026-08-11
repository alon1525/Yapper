import type { Copy } from './en';

/** Português (Brasil). */
export const PT: Partial<Copy> = {
  'deck.next': 'Próximo',
  'deck.prev': 'Anterior',
  'deck.restart': 'Voltar ao começo',
  'deck.mute': 'Desligar o som',
  'deck.unmute': 'Ligar o som',

  'welcome.fallbackName': 'Seu chat',
  'welcome.poster': 'Yapped.',
  'welcome.punchline':
    'O Reg leu todas as {messages} mensagens pra você não precisar. {days} disso. Vai passando. Aumenta o volume.',

  'total.eyebrow': 'Estrago total',
  'total.unit': 'mensagens · {people} pessoas',
  'total.punchline':
    'São {perDay} por dia, todo dia, durante {days}. Incluindo os anos em que vocês juravam estar «ocupados».',
  'total.words': 'Palavras',
  'total.emoji': 'Emojis',
  'total.media': 'Mídia',

  'talker.eyebrow': 'Ranking da tagarelice',
  'talker.punchline': '{share} de todas as mensagens desse chat saíram de uma pessoa só.',
  'talker.punchlineRunnerUp': 'Isso é {times} vezes mais que {name}, que nem chega perto.',

  'hours.eyebrow': 'A que horas vocês falam',
  'hours.peak': 'Horário de pico: {hour}',
  'hours.punchline':
    '{count} mensagens enviadas entre meia-noite e cinco da manhã. Ninguém pediu. Chegaram assim mesmo.',
  'hours.tag': 'Turno da noite: {name} · {count} depois da meia-noite',

  'fastest.eyebrow': 'O dedo mais rápido',
  'fastest.punchline':
    'Ao longo de {count} respostas, respondeu antes de todo mundo terminar de ler.',
  'fastest.fastest': 'Mais rápido',
  'fastest.slowest': 'Mais lento · {name}',

  'ghost.eyebrow': 'Fantasma oficial',
  'ghost.punchline': 'Sumido todo esse tempo sem uma única mensagem.',
  'ghost.stillGone': 'E não voltou. O grupo seguiu sem essa pessoa.',
  'ghost.returned': 'E voltou como se nada tivesse acontecido.',
  'ghost.lastSeen': 'Visto pela última vez',
  'ghost.stillGoneLabel': 'Ainda sumido',
  'ghost.resurfaced': 'Reapareceu',

  'emoji.eyebrow': 'Pódio dos emojis',
  'emoji.punchline':
    '{emoji} foi usado {count} vezes. Nenhuma conversa séria aqui durou o suficiente pra precisar de um segundo.',
  'emoji.punchlineRunnerUp':
    '{emoji} foi usado {count} vezes — {times} vezes mais que {other}. Nenhuma conversa séria aqui durou o suficiente pra precisar de um segundo.',

  'chaos.eyebrow': 'Caos máximo',
  'chaos.unit': '{count} mensagens em um dia',
  'chaos.punchline': '{times} vezes um dia normal. Aconteceu alguma coisa. Todo mundo lembra qual.',

  'streak.eyebrow': 'Maior sequência',
  'streak.days': 'dias',
  'streak.punchline': 'Nenhum dia em silêncio entre {from} e {to}.',
  'streak.silence': 'O outro extremo: {days} de silêncio total, quebrado por «{quote}».',
  'streak.tag': 'Ninguém aqui nunca deixou um chat sem ler',

  'final.eyebrow': 'Veredito do grupo',
  'final.headline': 'Manda no grupo',
  'final.punchline':
    '{messages} mensagens, {span}, e mesmo assim ninguém saiu. Isso é amor, tecnicamente.',
  'final.privacy': 'Seu chat nunca foi enviado pra lugar nenhum. Feche a aba e ele some.',
  'final.restart': 'Testar outro chat',

  'share.open': 'Criar um card',
  'share.title': 'Escolha o que postar',
  'share.lede':
    'Cada um é um card 9:16 feito no seu aparelho. Nada é enviado — a imagem é criada aqui e vai direto pro app que você escolher.',
  'share.count': '{n} selecionados',
  'share.none': 'Escolha pelo menos um',
  'share.share': 'Compartilhar',
  'share.sharing': 'Abrindo…',
  'share.save': 'Salvar nas fotos',
  'share.saveDesktop': 'Baixar',
  'share.saving': 'Salvando…',
  'share.copyCaption': 'Copiar legenda',
  'share.captionCopied': 'Legenda copiada',
  'share.caption': '{messages} mensagens nossas. O Yapped leu todas.',
  'share.hint':
    'O menu de compartilhar é onde ficam WhatsApp, Instagram e TikTok. No Instagram e no TikTok, escolha o card nas suas fotos e poste como story.',
  'share.hintDesktop':
    'Navegadores de computador não abrem o menu de compartilhar, então os cards são baixados. Mande pro celular ou poste daqui.',
  'share.failed': 'Não deu certo. Os cards continuam salvos no seu aparelho.',
  'share.close': 'Fechar',
  'share.watermark': 'yapped',

  'card.total.label': 'MENSAGENS',
  'card.total.caption': '{days} de conversa. Ninguém saiu ainda.',
  'card.talker.label': 'REI DA TAGARELICE',
  'card.talker.caption': '{share} de tudo que foi dito aqui',
  'card.leaderboard.label': 'O RANKING',
  'card.hours.label': 'HORÁRIO DE PICO',
  'card.hours.caption': '{count} mensagens de madrugada',
  'card.ghost.label': 'FANTASMA OFICIAL',
  'card.ghost.caption': '{days} sem dizer uma palavra',
  'card.emoji.label': 'MAIS USADO',
  'card.emoji.caption': 'Usado {count} vezes',
  'card.chaos.label': 'CAOS MÁXIMO',
  'card.chaos.caption': '{count} mensagens em um dia',
  'card.fastest.label': 'RESPOSTA MAIS RÁPIDA',
  'card.fastest.caption': 'Mediana de {count} respostas',
  'card.verdict.label': 'O VEREDITO',
  'card.verdict.caption': '{people} pessoas · {span}',

  'time.midnight': 'meia-noite',
  'time.noon': 'meio-dia',
  'time.am': '{h}h da manhã',
  'time.pm': '{h}h da tarde',
  'duration.underMinute': 'menos de um minuto',
  'duration.underSecond': 'menos de um segundo',
  'duration.seconds': '{n} s',
  'duration.minutes': '{n} min',
  'duration.hours': '{n} h',
  'duration.hoursMinutes': '{n} h {m} min',
  'span.hours': '{n} horas',
  'span.days': '{n} dias',
  'span.months': '{n} meses',
  'span.years': '{n} anos',
};
