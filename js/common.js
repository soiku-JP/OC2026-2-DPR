/* ===========================================================
   common.js  すべてのページで使う共通の道具
   =========================================================== */

// URLの ?cp=9024 のような値を取り出す
function getParam(name) {
  return new URLSearchParams(location.search).get(name);
}

// id からチェックポイントを探す
function findCp(id) {
  return CHECKPOINTS.find(function (c) { return c.id === Number(id); });
}

/* ルート関連 ---------------------------------------------- */

function routeKey(save) {
  return ROUTES[save.route] ? save.route : 'A';
}

function routeOrder(save) {
  return ROUTES[routeKey(save)].order;
}

// 次に行くべきチェックポイント（全部終わっていれば null）
function nextCp(save) {
  const order = routeOrder(save);
  for (let i = 0; i < order.length; i++) {
    if (!save.cleared[order[i]]) return findCp(order[i]);
  }
  return null;
}

// 直前にクリアしたチェックポイント（まだ1つも回っていなければ null）
// 「いま自分がどこにいるか」の手がかりとして、地図の矢印の起点に使います。
function prevCp(save) {
  const order = routeOrder(save);
  let prev = null;
  for (let i = 0; i < order.length; i++) {
    if (!save.cleared[order[i]]) return prev;
    prev = findCp(order[i]);
  }
  return prev;
}

/* いま自分がいる場所。
   -----------------------------------------------------------
   ★「順路の1つ前」ではなく、「いちばん最後に読み取った場所」です。
     順番を飛ばして読み取った人（テスト中や、まちがえて別のQRを
     読んだ人）に対して、順路上の1つ前を「いまいる場所」として
     扱うと、地下1階にいる人に「いまホームにいます」と言うことに
     なります。時刻で見れば、そういう取りちがえは起きません。   */
function lastCleared(save) {
  let best = null, at = -1;
  Object.keys(save.cleared || {}).forEach(function (id) {
    const c = save.cleared[id];
    const t = (c && c.at) || 0;
    if (t >= at) { at = t; best = findCp(Number(id)); }
  });
  return best;
}

function whereAmI(save) {
  return lastCleared(save) || GAME.goal || null;   // まだなら集合場所のホーム
}

// ルートの中で何番目かを返す（1から数える。見つからなければ 0）
function stepNo(save, cpId) {
  return routeOrder(save).indexOf(Number(cpId)) + 1;
}

/* 呼び名の統一 --------------------------------------------
   画面では略さず「チェックポイント3」と書きます。
   「CP3」では参加者に伝わらないためです。
   順路など、横に長くできない場所だけ ③ の丸数字を使います
   （平面図に書かれている ①②③ とそろえてあります）。      */
const CIRCLED = ['', '①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨'];
function cpMark(id) { return CIRCLED[id] || ('(' + id + ')'); }
// 「チェックポイント①」。丸数字にすると、地図のピンと形がそろって見つけやすくなります。
function cpLabel(id) { return 'チェックポイント' + cpMark(id); }

/* ミステリースポット --------------------------------------
   クリアするまで名前と場所を伏せるポイント。            */
function isHidden(cp, save) {
  return !!(cp && cp.mystery && !(save || loadSave()).cleared[cp.id]);
}
/* 平面図にピンを出さないポイント。
   名前（isHidden）はクリアすれば出しますが、位置は最後まで出しません。
   data.js に座標そのものを持たせていないためです（公開ファイル対策）。 */
function isPinHidden(cp) { return !!(cp && cp.mystery); }
function cpName(cp, save) {
  return isHidden(cp, save) ? '？？？　ミステリースポット' : cp.name;
}
function cpPlace(cp, save) {
  return isHidden(cp, save)
    ? (cp.mysteryText || '場所は伏せてあります。現地で探してください。')
    : cp.place;
}

/* 画面部品 ------------------------------------------------ */

// ヘッダーのタイマーを1秒ごとに更新する（showTimer: true のときだけ動きます）
function startTimer(elId) {
  const el = document.getElementById(elId);
  if (!el || !GAME.showTimer) return;
  function tick() {
    const save = loadSave();
    if (!save.startedAt) { el.textContent = '--:--'; return; }
    // 最初のチェックポイントを終えるまでは計測を始めない設定のとき
    if (!timerBase(save)) { el.textContent = '待機中'; return; }
    const sec = elapsedSec(save);
    const limit = GAME.timeLimitMin * 60;
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    el.textContent = m + ':' + s;
    if (limit > 0 && sec > limit) el.classList.add('over');
  }
  tick();
  setInterval(tick, 1000);
}

// ルートの順路を「④→①→②→③→⑤」のように描く（済んだ所には✓）
function renderRoute(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const save = loadSave();
  const order = routeOrder(save);
  const next = nextCp(save);
  el.innerHTML = '';
  order.forEach(function (id, i) {
    if (i > 0) {
      const arrow = document.createElement('span');
      arrow.className = 'arrow';
      arrow.textContent = '→';
      el.appendChild(arrow);
    }
    const cp = findCp(id);
    const d = document.createElement('div');
    let cls = 'dot';
    if (save.cleared[id]) cls += ' done';
    else if (next && next.id === id) cls += ' next';
    d.className = cls;
    d.textContent = save.cleared[id] ? '✓' : id;
    d.title = cp ? cp.name : '';
    el.appendChild(d);
  });
}

// 集めた文字を「き き か ん り」の並び（CP番号順）で描く
function renderLetters(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  const save = loadSave();
  el.innerHTML = '';
  CHECKPOINTS.forEach(function (cp) {
    const d = document.createElement('div');
    const got = !!save.cleared[cp.id];
    d.className = 'letter' + (got ? ' got' : '');
    d.textContent = got ? cp.letter : '?';
    el.appendChild(d);
  });
}

// 「つぎに行く場所」のカードを埋める
// すべて回り終えたら、同じ場所に「ゴールへ」の案内を出します
function renderNext(boxId, textId) {
  const box = document.getElementById(boxId);
  if (!box) return;
  const save = loadSave();
  const cp = nextCp(save);
  const head = box.querySelector('h2');
  box.style.display = 'block';

  /* ★ 順番が大事です。
       ① どこへ行くか → ② どう行くか（地図）→ ③ 着いたら何をするか
     「着いたらQRを読む」を地図より先に出すと、行き方を知る前に
     到着後の指示を読まされることになり、案内として成り立ちません。

     ★ そして「移動があるかどうか」で言い方を変えます。
       ホームは集合場所で、④⑤とゴールは同じ部屋の中にあります。
       そこを「つぎに行く場所」「着いたら」と案内するのは誤りです。 */
  const doBox = document.getElementById('nextDo');
  const warn = box.querySelector('.walkwarn');

  /* ★ルートが決まっていない人には、先に決めてもらいます。
     受付のQRを読まずにチェックポイントのQRを読むと、既定値の
     Aルートで案内が始まります。Bと言われた人がそれに従うと、
     順番が食い違ったまま最後まで進みます。               */
  if (!save.routeSet && typeof ROUTES !== 'undefined') {
    if (head) head.textContent = 'はじめに、順路を選んでください';
    box.classList.remove('goal-card');
    document.getElementById(textId).innerHTML =
      '<span class="nextplace">受付で「Aルート」「Bルート」のどちらかを指定されています。' +
      '指定されたほうを押してください。</span>';
    const pick = document.createElement('div');
    pick.className = 'routepick';
    Object.keys(ROUTES).forEach(function (key) {
      const b = document.createElement('button');
      b.className = 'routebtn';
      b.innerHTML = '<span class="rname">' + ROUTES[key].label + '</span>' +
                    '<span class="rorder">' + ROUTES[key].order.map(cpMark).join(' → ') + '</span>';
      b.addEventListener('click', function () {
        const s = loadSave();
        s.route = key; s.routeSet = true;
        writeSave(s);
        location.reload();
      });
      pick.appendChild(b);
    });
    const mapBox = document.getElementById('nextMap');
    if (mapBox) { mapBox.innerHTML = ''; mapBox.appendChild(pick); }
    if (doBox) doBox.style.display = 'none';
    if (warn) warn.style.display = 'none';
    return;
  }
  const here = whereAmI(save);
  const started = clearedCount(save) > 0;   // 1つでも読み取っていれば「出発ずみ」
  function inSameRoom(target) {
    return !!(here && here.room && target && target.room && here.room === target.room);
  }

  if (!cp) {
    const same = inSameRoom(GAME.goal);
    if (head) head.textContent = same ? '🏁 ゴール（この部屋です）' : '🏁 ゴールへ';
    box.classList.add('goal-card');
    document.getElementById(textId).innerHTML =
      '<span class="steplabel">' + CHECKPOINTS.length + ' / ' + CHECKPOINTS.length + '　すべて通過</span>' +
      '<span class="nextname">' + GAME.goal.place + '</span>' +
      '<span class="nextplace">' + GAME.goal.text + '</span>' +
      '<span class="nextstep">' +
        (same ? '移動はありません。いまいる部屋です。' : '① 行き方（下の地図）') + '</span>';
    if (typeof renderGoalMap === 'function') renderGoalMap('nextMap');
    if (doBox) {
      doBox.style.display = 'block';
      doBox.innerHTML = (same ? '' : '<strong>② 着いたら</strong>　') +
        'ゴール確認に答えると、完走記録が出ます。受付に見せてください。参加賞をお渡しします。';
    }
    /* 移動がないなら、歩きスマホの注意は出しません。
       全部まわり終えて同じ部屋にいる人に、歩く注意は要りません。 */
    if (warn) warn.style.display = same ? 'none' : '';
    return;
  }

  const same = inSameRoom(cp);
  if (head) head.textContent = same ? (started ? 'つぎは、この部屋の中' : 'まず、ここから')
                                    : 'つぎに行く場所';
  box.classList.remove('goal-card');
  document.getElementById(textId).innerHTML =
    '<span class="steplabel">' + ROUTES[routeKey(save)].label + '　' +
    stepNo(save, cp.id) + ' / ' + routeOrder(save).length + '</span>' +
    '<span class="nextname">' + cpLabel(cp.id) + '　' + cpName(cp, save) + '</span>' +
    '<span class="nextplace">' + cpPlace(cp, save) + '</span>' +
    '<span class="nextstep">' +
      (same ? (started ? '移動はありません。いまいる部屋の中です。'
                       : 'いまいる部屋です。ここから始めます。')
            : '① 行き方（下の地図）') + '</span>';
  if (typeof renderMap === 'function') renderMap('nextMap', cp);
  if (doBox) {
    doBox.style.display = 'block';
    doBox.innerHTML = (same ? '' : '<strong>② 着いたら</strong>　') +
      (cp.arrive || 'その場の<strong>QRコード</strong>をスマホのカメラで読み取ってください。');
  }
  /* ゴールの案内と同じ扱いです。移動がないなら、歩きスマホの注意は出しません。
     とくに出発時。④は席にいるホームの中にあるので、まだ誰も歩いていません。
     そこで「立ち止まって確認してください」と出すと、指示と場面が噛み合わず、
     この先ほんとうに歩き出したときの同じ注意まで軽く読まれます。 */
  if (warn) warn.style.display = same ? 'none' : '';
}

// あいことばの進み具合をバーで見せる（画像は使いません）
function renderLettersBar(elId, save) {
  const el = document.getElementById(elId);
  if (!el) return;
  const done = clearedCount(save || loadSave());
  // 一拍おいてから伸ばすと、増えたことが目で分かります
  setTimeout(function () {
    el.style.width = Math.round(done / CHECKPOINTS.length * 100) + '%';
  }, 60);
}

// マスコットのふきだしを出す（画像がなくても文字だけ出ます）
/* 場面ごとのマスコット画像を取り出します。
   GAME.mascot に文字列を1つだけ入れる古い書きかたでも動きます。 */
function mascotFor(scene) {
  const m = (typeof GAME !== 'undefined') ? GAME.mascot : null;
  if (!m) return null;
  if (typeof m === 'string') return { src: m };
  const one = m[scene];
  if (!one) return null;
  return (typeof one === 'string') ? { src: one } : one;
}

function renderSpeech(boxId, imgId, textId, words, scene) {
  const box = document.getElementById(boxId);
  if (!box || !words) return;
  box.style.display = 'flex';
  document.getElementById(textId).textContent = words;
  const mi = document.getElementById(imgId);
  const pic = mascotFor(scene);
  if (pic && pic.src) {
    mi.src = pic.src;
    mi.alt = pic.alt || '';
    // 2体そろった絵は丸く切らず、横長のまま大きめに出します
    if (pic.wide) box.classList.add('wide');
    mi.onerror = function () { mi.remove(); };
  } else { mi.remove(); }
}

// 生成AI使用クレジットを差し込む（GAME.credit が空なら何も出しません）
function renderCredit(elId) {
  const el = document.getElementById(elId);
  const c = GAME.credit;
  if (!el || !c || !c.body) return;
  el.innerHTML =
    '<h2 style="font-size:15px">' + (c.title || '生成AI使用クレジット') + '</h2>' +
    (c.maker ? '<p class="note" style="margin:0 0 8px"><strong>制作：' + c.maker + '</strong></p>' : '') +
    '<p class="note" style="margin:0;white-space:pre-line">' + c.body + '</p>';
  el.style.display = 'block';
}

/* 「この校舎の3つの階を行き来します」の囲み ------------------
   空間の全体像を、歩き出す前に一度だけ見せます。
   参加者は平面図に慣れていないので、
   「上下移動がある」「1つは外にある」を先に知らせておかないと、
   いざ移動の案内が出たときに面食らいます。
   数と階は data.js から数えるので、場所を増減しても文がずれません。 */
function renderFloors(elId) {
  const el = document.getElementById(elId);
  if (!el || typeof FLOORS === 'undefined') return;
  const keys = Object.keys(FLOORS).reverse();     // 上の階から
  const rows = keys.map(function (k) {
    const list = CHECKPOINTS.filter(function (c) { return c.floor === k; });
    if (!list.length) return '';
    const notes = [];
    if (GAME.goal && GAME.goal.floor === k) notes.push('スタートとゴールもこの階');
    if (list.some(function (c) { return c.outdoor; })) notes.push('1つは建物の外');
    return '<li><span class="fl">' + FLOORS[k].label + '</span>' +
           '<span class="fn">チェックポイント ' + list.length + ' つ</span>' +
           (notes.length ? '<span class="fx">' + notes.join('／') + '</span>' : '') + '</li>';
  }).join('');
  const floors = keys.filter(function (k) {
    return CHECKPOINTS.some(function (c) { return c.floor === k; });
  }).length;
  el.innerHTML =
    '<p class="floorhead">この校舎の<strong>' + floors + 'つの階</strong>を行き来します</p>' +
    '<ul class="floorlist">' + rows + '</ul>' +
    '<p class="note" style="margin:10px 0 0">' +
      '上下の移動は、建物の<strong>中央にある吹き抜けの横の階段</strong>を使います。' +
      '<strong>階段を使用できない場合は付き添いますので、申し出てください。</strong></p>';
  el.style.display = 'block';
}

// 版の目印を、画面のいちばん下に小さく出す
function renderVersion(elId) {
  const el = document.getElementById(elId);
  if (!el || !GAME.version) return;
  el.textContent = '版：' + GAME.version;
  el.style.display = 'block';
}

// 共通ヘッダーを差し込む
function mountHeader(showTimer) {
  const withTimer = showTimer && GAME.showTimer;   // 時計を出さない設定なら常に非表示
  const h = document.createElement('header');
  h.className = 'bar';
  h.innerHTML =
    '<span class="logo">🧯 ' + GAME.title + '</span><span class="spacer"></span>' +
    (withTimer ? '<span class="timer" id="timer">--:--</span>' : '');
  document.body.prepend(h);
  if (withTimer) startTimer('timer');
}
