/* ===========================================================
   storage.js  進捗の保存・読み出し（スマホの中だけに保存されます）
   サーバーは一切使いません。

   ブラウザの設定やシークレットモードで localStorage が使えない場合でも
   ゲームが止まらないよう、自動的に代わりの保存先へ切り替えます。
   =========================================================== */

const SAVE_KEY = 'bosai_rogaining_v1';

/* 使える保存先を自動で選ぶ ---------------------------------
   ① localStorage（ブラウザを閉じても残る／いちばん良い）
   ② sessionStorage（タブを閉じるまで残る）
   ③ メモリ（ページを移動すると消える／最後の手段）        */
const store = (function () {
  const memory = {};
  function usable(s) {
    try {
      const t = '__test__';
      s.setItem(t, '1');
      s.removeItem(t);
      return true;
    } catch (e) {
      return false;
    }
  }
  try {
    if (typeof localStorage !== 'undefined' && usable(localStorage)) {
      return { kind: 'local', get: function (k) { return localStorage.getItem(k); },
               set: function (k, v) { localStorage.setItem(k, v); },
               del: function (k) { localStorage.removeItem(k); } };
    }
  } catch (e) { /* 参照した時点で例外になるブラウザもある */ }
  try {
    if (typeof sessionStorage !== 'undefined' && usable(sessionStorage)) {
      return { kind: 'session', get: function (k) { return sessionStorage.getItem(k); },
               set: function (k, v) { sessionStorage.setItem(k, v); },
               del: function (k) { sessionStorage.removeItem(k); } };
    }
  } catch (e) { /* 同上 */ }
  return { kind: 'memory', get: function (k) { return memory[k] || null; },
           set: function (k, v) { memory[k] = v; },
           del: function (k) { delete memory[k]; } };
})();

const STORAGE_KIND = store.kind;

function newSave() {
  return {
    team: '',
    route: 'A',      // 受付で指定されたルート（'A' または 'B'）
    /* ★このルートが「本当に指定されたもの」かどうか。
       受付のQR（?route=）を読まずに、いきなりチェックポイントの
       QRを読んだ人は、上の 'A' が既定値のまま使われてしまいます。
       黙ってAルートとして案内すると、Bと指定された人が
       まちがった順番で回ることになるので、印を残します。 */
    routeSet: false,
    /* ★出発前の安全確認を、本人が押して済ませたか。
       「開始した（startedAt）」で代用してはいけません。
       チェックポイントのQRを直接読んだ人にも開始時刻は入るため、
       それを確認済みの印にすると、一度も安全確認を見ていない人に
       「確認済みです」と表示してしまいます（rev.63 で分離）。 */
    safetyDone: false,
    /* ★この記録が、チェックポイントのQRから自動で作られたものか。
       受付を通らずに始めた人が、あとから安全確認をしたときだけ、
       その人の進捗を残すために使います。
       この印が無い古い記録は「前の人のもの」として扱い、残しません
       （同じスマホを次の人が使うときに、前の人の進捗を引き継がないため）。 */
    autoStarted: false,
    startedAt: 0,   // スタート時刻（ミリ秒）
    finishedAt: 0,  // ゴール時刻
    cleared: {},    // { "1": { firstTry: true, at: 12345 }, ... }
    goalDone: false
  };
}

function loadSave() {
  let s;
  try {
    const raw = store.get(SAVE_KEY);
    s = raw ? Object.assign(newSave(), JSON.parse(raw)) : newSave();
  } catch (e) {
    s = newSave();
  }
  /* ★名前を聞かない設定のときは、前に保存された名前を必ず捨てます。
     設定を変える前にこの端末で入力した名前が、そのまま画面に出続けるためです。
     （「チーム名」を廃止したのに「Aチーム（Aルート）で進行中」と出たのがこれ） */
  if (typeof GAME !== 'undefined' && !GAME.askName) s.team = '';
  return s;
}

function writeSave(save) {
  try {
    store.set(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch (e) {
    return false;
  }
}

function resetSave() {
  try { store.del(SAVE_KEY); } catch (e) { /* 無視 */ }
}

/* 便利な計算 --------------------------------------------- */

function clearedCount(save) {
  return Object.keys(save.cleared).length;
}

function starCount(save) {
  // 1回目で正解できたチェックポイントの数
  return Object.values(save.cleared).filter(function (c) { return c.firstTry; }).length;
}

function collectedLetters(save) {
  return CHECKPOINTS
    .filter(function (cp) { return save.cleared[cp.id]; })
    .map(function (cp) { return cp.letter; });
}

// タイマーの起点（0 なら「まだ計測が始まっていない」）
function timerBase(save) {
  if (GAME.timerStartsAt === 'first-cp') {
    const times = Object.values(save.cleared)
      .map(function (c) { return c.at; })
      .filter(Boolean);
    return times.length ? Math.min.apply(null, times) : 0;
  }
  return save.startedAt;
}

function elapsedSec(save) {
  const base = timerBase(save);
  if (!base) return 0;
  const end = save.finishedAt || Date.now();
  return Math.floor((end - base) / 1000);
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m + '分' + String(s).padStart(2, '0') + '秒';
}
