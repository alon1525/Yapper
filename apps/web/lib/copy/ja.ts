import type { Copy } from './en';

/**
 * 日本語.
 *
 * Written the way a group chat is written, not the way a press release is:
 * plain form throughout, no keigo, and the roast left in. A polite translation
 * of a rude report is a different report.
 */
export const JA: Partial<Copy> = {
  'deck.next': '次のスライド',
  'deck.prev': '前のスライド',
  'deck.restart': '最初のスライドに戻る',
  'deck.mute': 'サウンドをオフ',
  'deck.unmute': 'サウンドをオン',

  'welcome.fallbackName': 'あなたのチャット',
  'welcome.poster': 'Yapped.',
  'welcome.punchline':
    'レグが{messages}件のメッセージを全部読んだ。あなたが読まなくていいように。{days}分の記録。タップして進もう。音量は上げて。',

  'total.eyebrow': '被害総額',
  'total.unit': '件 · {people}人',
  'total.punchline':
    '1日あたり{perDay}件、それを{days}間ずっと。「忙しい」と言い張っていた年も含めて。',
  'total.words': '単語',
  'total.emoji': '絵文字',
  'total.media': 'メディア',

  'talker.eyebrow': 'おしゃべりランキング',
  'talker.punchline': 'このチャットの全メッセージの{share}が、たった一人から出ている。',
  'talker.punchlineRunnerUp': '{name}の{times}倍。勝負にすらなっていない。',

  'hours.eyebrow': '何時に喋るのか',
  'hours.peak': 'ピークは{hour}',
  'hours.punchline':
    '深夜0時から朝5時のあいだに{count}件。誰も頼んでいない。それでも届いた。',
  'hours.tag': '夜勤: {name} · 深夜に{count}件',

  'fastest.eyebrow': '反応が一番速い人',
  'fastest.punchline': '{count}件の返信を通して、他の全員が読み終わる前に返してきた。',
  'fastest.fastest': '最速',
  'fastest.slowest': '最遅 · {name}',

  'ghost.eyebrow': '公認ゴースト',
  'ghost.punchline': 'その間、一件のメッセージもなし。',
  'ghost.stillGone': 'そして戻ってこなかった。グループはそのまま進んだ。',
  'ghost.returned': 'そして何事もなかったように戻ってきた。',
  'ghost.lastSeen': '最後の目撃',
  'ghost.stillGoneLabel': '現在も行方不明',
  'ghost.resurfaced': '再登場',

  'emoji.eyebrow': '絵文字の表彰台',
  'emoji.punchline':
    '{emoji}が{count}回。ここで真面目な会話が二つ目を必要とするまで続いたことはない。',
  'emoji.punchlineRunnerUp':
    '{emoji}が{count}回 — {other}の{times}倍。ここで真面目な会話が二つ目を必要とするまで続いたことはない。',

  'chaos.eyebrow': '最大の混沌',
  'chaos.unit': '1日で{count}件',
  'chaos.punchline': '普段の{times}倍。何かがあった。全員が何かを覚えている。',

  'streak.eyebrow': '最長連続記録',
  'streak.days': '日',
  'streak.punchline': '{from}から{to}まで、沈黙した日はゼロ。',
  'streak.silence': '逆の極端: {days}の完全な沈黙。破ったのは「{quote}」。',
  'streak.tag': 'ここに未読を残せる人間はいない',

  'final.eyebrow': 'グループへの判決',
  'final.headline': 'グループに送りつけよう',
  'final.punchline': '{messages}件、{span}、それでもまだ誰も抜けていない。技術的には、これが愛。',
  'final.privacy': 'チャットは一度もアップロードされていない。タブを閉じれば消える。',
  'final.restart': '別のチャットを試す',

  'share.open': 'シェア用カードを作る',
  'share.title': '投稿するものを選ぶ',
  'share.lede':
    'どれも9:16のカードで、あなたの端末の中で作られる。アップロードは一切なし。画像はここで作られ、選んだアプリにそのまま渡される。',
  'share.count': '{n}枚選択中',
  'share.none': '1枚以上選んでください',
  'share.share': 'シェア',
  'share.sharing': '開いています…',
  'share.save': '写真に保存',
  'share.saveDesktop': 'ダウンロード',
  'share.saving': '保存中…',
  'share.copyCaption': 'キャプションをコピー',
  'share.captionCopied': 'コピーしました',
  'share.caption': '私たちの{messages}件のメッセージ。Yappedが全部読んだ。',
  'share.hint':
    'シェアシートにLINE、WhatsApp、Instagram、TikTokが並びます。InstagramとTikTokでは、写真からこのカードを選んでストーリーに投稿してください。',
  'share.hintDesktop':
    'パソコンのブラウザはシェアシートを開けないので、カードはダウンロードされます。スマホに送るか、ここから投稿してください。',
  'share.failed': 'うまくいきませんでした。カードは端末に保存されています。',
  'share.close': '閉じる',
  'share.watermark': 'yapped',

  'card.total.label': 'メッセージ',
  'card.total.caption': '{days}分のおしゃべり。まだ誰も抜けていない。',
  'card.talker.label': 'おしゃべり王',
  'card.talker.caption': 'ここで言われたことの{share}',
  'card.leaderboard.label': 'ランキング',
  'card.hours.label': 'ピーク時間',
  'card.hours.caption': '深夜に{count}件',
  'card.ghost.label': '公認ゴースト',
  'card.ghost.caption': '{days}、一言もなし',
  'card.emoji.label': '最多使用',
  'card.emoji.caption': '{count}回',
  'card.chaos.label': '最大の混沌',
  'card.chaos.caption': '1日で{count}件',
  'card.fastest.label': '最速の返信',
  'card.fastest.caption': '{count}件の返信の中央値',
  'card.verdict.label': '判決',
  'card.verdict.caption': '{people}人 · {span}',

  'time.midnight': '深夜0時',
  'time.noon': '正午',
  'time.am': '午前{h}時',
  'time.pm': '午後{h}時',
  'duration.underMinute': '1分未満',
  'duration.underSecond': '1秒未満',
  'duration.seconds': '{n}秒',
  'duration.minutes': '{n}分',
  'duration.hours': '{n}時間',
  'duration.hoursMinutes': '{n}時間{m}分',
  'span.hours': '{n}時間',
  'span.days': '{n}日',
  'span.months': '{n}か月',
  'span.years': '{n}年',
};
