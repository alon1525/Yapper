import type { Copy } from './en';

/**
 * Русский.
 *
 * Russian counts in three forms and this file has one, so the phrasings are
 * chosen to survive that: «сообщений» and «дней» are the genitive plural, which
 * is what the overwhelming majority of counts in a chat export take. Where a
 * count would too often land on the awkward form, the sentence is written to
 * avoid needing the noun at all.
 */
export const RU: Partial<Copy> = {
  'deck.next': 'Дальше',
  'deck.prev': 'Назад',
  'deck.restart': 'К первому слайду',
  'deck.mute': 'Выключить звук',
  'deck.unmute': 'Включить звук',

  'welcome.fallbackName': 'Ваш чат',
  'welcome.poster': 'Yapped.',
  'welcome.punchline':
    'Рег прочитал все {messages} сообщений, чтобы вам не пришлось. {days} этого. Листайте. Звук погромче.',

  'total.eyebrow': 'Общий ущерб',
  'total.unit': 'сообщений · {people} человек',
  'total.punchline':
    'Это {perDay} в день, каждый день, на протяжении {days}. Включая годы, когда вы уверяли, что «заняты».',
  'total.words': 'Слов',
  'total.emoji': 'Эмодзи',
  'total.media': 'Медиа',

  'talker.eyebrow': 'Рейтинг болтунов',
  'talker.punchline': '{share} всех сообщений в этом чате написал один человек.',
  'talker.punchlineRunnerUp': 'Это в {times} раза больше, чем у {name}, и это даже не близко.',

  'hours.eyebrow': 'Когда вы говорите',
  'hours.peak': 'Час пик: {hour}',
  'hours.punchline':
    '{count} сообщений отправлено между полуночью и пятью утра. Никто их не просил. Они пришли всё равно.',
  'hours.tag': 'Ночная смена: {name} · {count} после полуночи',

  'fastest.eyebrow': 'Самый быстрый палец',
  'fastest.punchline':
    'На протяжении {count} ответов этот человек успевал ответить раньше, чем остальные дочитывали.',
  'fastest.fastest': 'Быстрее всех',
  'fastest.slowest': 'Медленнее всех · {name}',

  'ghost.eyebrow': 'Сертифицированное привидение',
  'ghost.punchline': 'Столько времени без единого сообщения.',
  'ghost.stillGone': 'И не вернулся. Группа продолжила без него.',
  'ghost.returned': 'А потом вернулся как ни в чём не бывало.',
  'ghost.lastSeen': 'В последний раз',
  'ghost.stillGoneLabel': 'Всё ещё нет',
  'ghost.resurfaced': 'Вернулся',

  'emoji.eyebrow': 'Пьедестал эмодзи',
  'emoji.punchline':
    '{emoji} использован {count} раз. Ни один серьёзный разговор здесь не продержался достаточно долго, чтобы понадобился второй.',
  'emoji.punchlineRunnerUp':
    '{emoji} использован {count} раз — в {times} раза чаще, чем {other}. Ни один серьёзный разговор здесь не продержался достаточно долго, чтобы понадобился второй.',

  'chaos.eyebrow': 'Пик хаоса',
  'chaos.unit': '{count} сообщений за один день',
  'chaos.punchline':
    'В {times} раза больше обычного дня. Что-то случилось. Все помнят, что именно.',

  'streak.eyebrow': 'Самая длинная серия',
  'streak.days': 'дней',
  'streak.punchline': 'Ни одного молчаливого дня между {from} и {to}.',
  'streak.silence':
    'Другая крайность: {days} полной тишины, наконец прерванной словами «{quote}».',
  'streak.tag': 'Здесь никто никогда не оставлял чат непрочитанным',

  'final.eyebrow': 'Приговор группе',
  'final.headline': 'Отправьте это в группу',
  'final.punchline':
    '{messages} сообщений, {span}, и до сих пор никто не вышел. Технически это любовь.',
  'final.privacy': 'Ваш чат никуда не загружался. Закройте вкладку — и его нет.',
  'final.restart': 'Попробовать другой чат',

  'share.open': 'Сделать карточку',
  'share.title': 'Выберите, что опубликовать',
  'share.lede':
    'Каждая — карточка 9:16, собранная на вашем устройстве. Ничего не загружается: изображение создаётся здесь и передаётся сразу в выбранное приложение.',
  'share.count': 'Выбрано: {n}',
  'share.none': 'Выберите хотя бы одну',
  'share.share': 'Поделиться',
  'share.sharing': 'Открываем…',
  'share.save': 'Сохранить в фото',
  'share.saveDesktop': 'Скачать',
  'share.saving': 'Сохраняем…',
  'share.copyCaption': 'Скопировать подпись',
  'share.captionCopied': 'Подпись скопирована',
  'share.caption': '{messages} наших сообщений. Yapped прочитал их все.',
  'share.hint':
    'В меню «Поделиться» живут WhatsApp, Instagram и TikTok. В Instagram и TikTok выберите карточку из фотографий и опубликуйте её как историю.',
  'share.hintDesktop':
    'Браузеры на компьютере не умеют открывать меню «Поделиться», поэтому карточки просто скачиваются. Отправьте их на телефон или опубликуйте отсюда.',
  'share.failed': 'Не получилось. Карточки всё равно сохранены на вашем устройстве.',
  'share.close': 'Закрыть',
  'share.watermark': 'yapped',

  'card.total.label': 'СООБЩЕНИЙ',
  'card.total.caption': '{days} болтовни. Никто ещё не вышел.',
  'card.talker.label': 'ГЛАВНЫЙ БОЛТУН',
  'card.talker.caption': '{share} всего сказанного здесь',
  'card.leaderboard.label': 'РЕЙТИНГ',
  'card.hours.label': 'ЧАС ПИК',
  'card.hours.caption': '{count} сообщений после полуночи',
  'card.ghost.label': 'ПРИВИДЕНИЕ',
  'card.ghost.caption': '{days} без единого слова',
  'card.emoji.label': 'ЧАЩЕ ВСЕГО',
  'card.emoji.caption': 'Использован {count} раз',
  'card.chaos.label': 'ПИК ХАОСА',
  'card.chaos.caption': '{count} сообщений за день',
  'card.fastest.label': 'САМЫЙ БЫСТРЫЙ ОТВЕТ',
  'card.fastest.caption': 'Медиана по {count} ответам',
  'card.verdict.label': 'ПРИГОВОР',
  'card.verdict.caption': '{people} человек · {span}',

  'time.midnight': 'полночь',
  'time.noon': 'полдень',
  // 24-hour clock.
  'time.am': '{h24}:00',
  'time.pm': '{h24}:00',
  'duration.underMinute': 'меньше минуты',
  'duration.underSecond': 'меньше секунды',
  'duration.seconds': '{n} с',
  'duration.minutes': '{n} мин',
  'duration.hours': '{n} ч',
  'duration.hoursMinutes': '{n} ч {m} мин',
  'span.hours': '{n} часов',
  'span.days': '{n} дней',
  'span.months': '{n} месяцев',
  'span.years': '{n} лет',
};
