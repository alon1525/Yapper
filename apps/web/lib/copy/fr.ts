import type { Copy } from './en';

/** Français. Tutoiement, and the non-breaking spaces French punctuation wants. */
export const FR: Partial<Copy> = {
  'deck.next': 'Suivant',
  'deck.prev': 'Précédent',
  'deck.restart': 'Revenir au début',
  'deck.mute': 'Couper la musique',
  'deck.unmute': 'Lancer la musique',

  'welcome.fallbackName': 'Votre conversation',
  'welcome.poster': 'Yapped.',
  'welcome.punchline':
    'Reg a lu les {messages} messages pour que vous n’ayez pas à le faire. {days} de tout ça. Continuez. Montez le son.',

  'total.eyebrow': 'Dégâts totaux',
  'total.unit': 'messages · {people} personnes',
  'total.punchline':
    'Soit {perDay} par jour, tous les jours, pendant {days}. Y compris les années où vous étiez soi-disant « occupés ».',
  'total.words': 'Mots',
  'total.emoji': 'Emojis',
  'total.media': 'Médias',

  'talker.eyebrow': 'Le classement des bavards',
  'talker.punchline': '{share} de tous les messages de cette conversation viennent d’une seule personne.',
  'talker.punchlineRunnerUp': 'Soit {times} fois plus que {name}, qui n’est même pas dans la course.',

  'hours.eyebrow': 'Quand vous parlez',
  'hours.peak': 'Heure de pointe : {hour}',
  'hours.punchline':
    '{count} messages envoyés entre minuit et 5 heures du matin. Personne ne les a demandés. Ils sont arrivés quand même.',
  'hours.tag': 'Équipe de nuit : {name} · {count} après minuit',

  'fastest.eyebrow': 'La gâchette la plus rapide',
  'fastest.punchline':
    'Sur {count} réponses, cette personne a répondu avant que les autres aient fini de lire.',
  'fastest.fastest': 'Le plus rapide',
  'fastest.slowest': 'Le plus lent · {name}',

  'ghost.eyebrow': 'Fantôme certifié',
  'ghost.punchline': 'Disparu tout ce temps sans un seul message.',
  'ghost.stillGone': 'Et n’est jamais revenu. Le groupe a continué sans lui.',
  'ghost.returned': 'Puis revenu comme si de rien n’était.',
  'ghost.lastSeen': 'Vu pour la dernière fois',
  'ghost.stillGoneLabel': 'Toujours absent',
  'ghost.resurfaced': 'Réapparu',

  'emoji.eyebrow': 'Podium des emojis',
  'emoji.punchline':
    '{emoji} a été utilisé {count} fois. Aucune conversation sérieuse n’a jamais tenu assez longtemps ici pour en réclamer un deuxième.',
  'emoji.punchlineRunnerUp':
    '{emoji} a été utilisé {count} fois, soit {times} fois plus que {other}. Aucune conversation sérieuse n’a jamais tenu assez longtemps ici pour en réclamer un deuxième.',

  'chaos.eyebrow': 'Chaos maximal',
  'chaos.unit': '{count} messages en une journée',
  'chaos.punchline':
    '{times} fois une journée normale. Il s’est passé quelque chose. Tout le monde se souvient de quoi.',

  'streak.eyebrow': 'Plus longue série',
  'streak.days': 'jours',
  'streak.punchline': 'Pas un seul jour de silence entre le {from} et le {to}.',
  'streak.silence':
    'À l’autre extrême : {days} de silence total, enfin brisé par « {quote} ».',
  'streak.tag': 'Personne ici n’a jamais laissé un message non lu',

  'final.eyebrow': 'Verdict du groupe',
  'final.headline': 'Envoie-le au groupe',
  'final.punchline':
    '{messages} messages, {span}, et personne n’est encore parti. C’est de l’amour, techniquement.',
  'final.privacy': 'Votre conversation n’a jamais été envoyée nulle part. Fermez l’onglet et elle disparaît.',
  'final.restart': 'Essayer une autre conversation',

  'share.open': 'Créer une carte',
  'share.title': 'Choisissez quoi publier',
  'share.lede':
    'Chacune est une carte 9:16 fabriquée sur votre appareil. Rien n’est envoyé : l’image est créée ici et transmise directement à l’application que vous choisissez.',
  'share.count': '{n} sélectionnées',
  'share.none': 'Choisissez-en au moins une',
  'share.share': 'Partager',
  'share.sharing': 'Ouverture…',
  'share.save': 'Enregistrer dans les photos',
  'share.saveDesktop': 'Télécharger',
  'share.saving': 'Enregistrement…',
  'share.copyCaption': 'Copier la légende',
  'share.captionCopied': 'Légende copiée',
  'share.caption': '{messages} messages de nous. Yapped les a tous lus.',
  'share.hint':
    'WhatsApp, Instagram et TikTok se trouvent dans le menu de partage. Sur Instagram et TikTok, choisissez la carte dans vos photos et publiez-la en story.',
  'share.hintDesktop':
    'Les navigateurs de bureau ne peuvent pas ouvrir le menu de partage, les cartes sont donc téléchargées. Envoyez-les sur votre téléphone, ou publiez-les d’ici.',
  'share.failed': 'Ça n’a pas marché. Les cartes sont quand même enregistrées sur votre appareil.',
  'share.close': 'Fermer',
  'share.watermark': 'yapped',

  'card.total.label': 'MESSAGES',
  'card.total.caption': '{days} à bavarder. Personne n’est encore parti.',
  'card.talker.label': 'ROI DU BAVARDAGE',
  'card.talker.caption': '{share} de tout ce qui s’est dit ici',
  'card.leaderboard.label': 'LE CLASSEMENT',
  'card.hours.label': 'HEURE DE POINTE',
  'card.hours.caption': '{count} messages après minuit',
  'card.ghost.label': 'FANTÔME CERTIFIÉ',
  'card.ghost.caption': '{days} sans un mot',
  'card.emoji.label': 'LE PLUS UTILISÉ',
  'card.emoji.caption': 'Utilisé {count} fois',
  'card.chaos.label': 'CHAOS MAXIMAL',
  'card.chaos.caption': '{count} messages en une journée',
  'card.fastest.label': 'RÉPONSE LA PLUS RAPIDE',
  'card.fastest.caption': 'Médiane sur {count} réponses',
  'card.verdict.label': 'LE VERDICT',
  'card.verdict.caption': '{people} personnes · {span}',

  'time.midnight': 'minuit',
  'time.noon': 'midi',
  'time.am': '{h} h',
  'time.pm': '{h} h',
  'duration.underMinute': 'moins d’une minute',
  'duration.underSecond': 'moins d’une seconde',
  'duration.seconds': '{n} s',
  'duration.minutes': '{n} min',
  'duration.hours': '{n} h',
  'duration.hoursMinutes': '{n} h {m}',
  'span.hours': '{n} heures',
  'span.days': '{n} jours',
  'span.months': '{n} mois',
  'span.years': '{n} ans',
};
