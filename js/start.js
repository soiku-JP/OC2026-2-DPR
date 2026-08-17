/* ===========================================================
   start.js  スタート画面の動き
   ※ 何かの拍子に他の処理が失敗しても「スタートする」だけは
      必ず押せるよう、ボタンの登録をいちばん先に行っています。
   =========================================================== */

let pickedRoute = null;   // 選ばれたルート（'A' か 'B'）
const checked = [];       // 安全確認のチェック状態

const forcedRoute = String(getParam('route') || '').toUpperCase();

/* --- 0. 受付の順路QRで、空いている順路を埋める -------------
   当日は3段階です。
     ① 入口のQR   … index.html（順路の指定なし）を開く
     ② 安全確認   … 4つ押す
     ③ 順路のQR   … index.html?route=A / B を読む
   ここは③で戻ってきた場合の入口です。②まで済ませた人が順路QRを読むと、
   その場で順路が決まり、そのまま出発します。

   ★ routeSet がすでに true のときは、何もしません。
     そのときの ?route= は「別の人がこれから始める」合図で、
     この下のほうにある「新しく始める」の案内が受け持ちます。
     ここで黙って上書きすると、前の人の進捗に別の順路が乗ります。 */
(function fillRouteFromQr() {
  if (!ROUTES[forcedRoute]) return;
  const s = loadSave();
  if (!s.safetyDone || s.routeSet) return;
  s.route = forcedRoute;
  s.routeSet = true;
  if (!s.startedAt) s.startedAt = Date.now();
  writeSave(s);
  location.replace('result.html');
})();

/* --- 1. まずボタンを動くようにする ----------------------- */

document.getElementById('startBtn').addEventListener('click', function () {
  // 名前は既定では聞きません（GAME.askName が false のとき）
  const team = GAME.askName ? document.getElementById('team').value.trim() : '';
  const teamErr = document.getElementById('teamError');
  const routeErr = document.getElementById('routeError');
  const checkErr = document.getElementById('checkError');
  const allChecked = checked.length === GAME.safetyChecks.length &&
                     checked.every(Boolean);

  checkErr.style.display = allChecked ? 'none' : 'block';
  if (GAME.askName) teamErr.style.display = team ? 'none' : 'block';
  routeErr.style.display = 'none';   // 順路はこのあと③のQRで決まります

  if (!allChecked) {
    document.getElementById('checklist').scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (GAME.askName && !team) { document.getElementById('team').focus(); return; }

  /* ★チェックポイントのQRから直接入った人が、あとから安全確認をした場合だけ、
     その人の進捗を残します。それ以外は、まっさらな記録で始めます。
     ★ autoStarted を見るのが要点です。これが無い記録（前の人のものや、
       この印を入れる前に作られた古い記録）まで残すと、同じスマホを使う
       次の人が、前の人のクリア済みを引き継いでしまいます。 */
  const prev = loadSave();
  const keep = !!prev.startedAt && !prev.safetyDone && !!prev.autoStarted;
  const s = keep ? prev : newSave();
  if (!keep) s.team = team;
  s.safetyDone = true;
  if (!s.startedAt) s.startedAt = Date.now();

  if (pickedRoute) {
    s.route = pickedRoute;
    s.routeSet = true;        // 受付QRか、自分で選んだか。どちらでも「決まった」
    writeSave(s);
    location.href = 'result.html';
    return;
  }

  /* 順路がまだ決まっていない場合。①の入口QRから入った人はここに来ます。
     安全確認だけを記録し、③の順路QRを読み取ってもらいます。 */
  writeSave(s);
  showAwaitRoute();
});

/* 「安全確認おわり。つぎは順路のQR」の案内を出す ---------- */
function showAwaitRoute() {
  const box = document.getElementById('awaitRoute');
  box.style.display = 'block';
  box.innerHTML =
    '<div class="routefixed">' +
      '<span class="big">✓ 安全確認</span>' +
      '<span class="ord">おわりました</span>' +
    '</div>' +
    '<p class="note" style="margin:0 0 10px">' +
      '<strong>つぎに、受付の順路QRコード（Aルート・Bルート）を読み取ってください。</strong>' +
      '読み取ると順路が決まり、そのまま出発になります。' +
      '<br>QRが読み取れないときは、下のボタンで選んでください。' +
    '</p>';
  document.getElementById('startBtn').style.display = 'none';
  const sn = document.getElementById('startNote');
  if (sn) sn.style.display = 'none';
  // 同じ案内が2つ並ばないよう、下の説明は短い見出しに変えます
  document.getElementById('routeLead').textContent = 'QRが読み取れないときは、こちらから';
  box.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ボタンの文字は、順路が決まっているかどうかで変わります */
function refreshStartLabel() {
  const btn = document.getElementById('startBtn');
  const note = document.getElementById('startNote');
  if (pickedRoute) {
    btn.textContent = 'スタートする';
    if (note) note.textContent = '';
  } else {
    btn.textContent = '安全確認おわり';
    if (note) note.textContent = 'このあと、受付の順路QR（AルートかBルート）を読み取ります。';
  }
}

// 名前を聞く設定のときだけ、入力欄を出す
if (GAME.askName) {
  document.getElementById('nameBlock').style.display = 'block';
  document.getElementById('routeHead').textContent = '受付番号とルート';
  // Enterキーでもスタートできるようにする
  document.getElementById('team').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') document.getElementById('startBtn').click();
  });
}

/* --- 2. 安全確認のチェック欄をつくる --------------------- */

const clist = document.getElementById('checklist');

// 「あと◯つ」を出し、全部そろうまでスタートボタンを薄くしておく
function refreshCheckCount() {
  const done = checked.filter(Boolean).length;
  const all = GAME.safetyChecks.length;
  const el = document.getElementById('checkCount');
  const btn = document.getElementById('startBtn');
  const ok = done === all;
  el.textContent = ok ? '✓ ' + all + 'つとも確認できました。スタートできます。'
                      : 'あと ' + (all - done) + ' つ　（' + done + ' / ' + all + '）';
  el.classList.toggle('done', ok);
  btn.classList.toggle('notready', !ok);
  btn.setAttribute('aria-disabled', ok ? 'false' : 'true');
  if (ok) document.getElementById('checkError').style.display = 'none';
}

GAME.safetyChecks.forEach(function (item, i) {
  checked[i] = false;
  const b = document.createElement('button');
  b.className = 'checkitem';
  b.type = 'button';
  b.innerHTML =
    '<span class="box"></span>' +
    '<span class="txt"><strong>' + item.title + '</strong>' +
    (item.note ? '<span>' + item.note + '</span>' : '') + '</span>';
  b.addEventListener('click', function () {
    checked[i] = !checked[i];
    b.classList.toggle('on', checked[i]);
    b.querySelector('.box').textContent = checked[i] ? '✓' : '';
    b.setAttribute('aria-pressed', checked[i] ? 'true' : 'false');
    refreshCheckCount();
  });
  b.setAttribute('aria-pressed', 'false');
  clist.appendChild(b);
});
refreshCheckCount();

/* --- 3. ルート選択ボタンをつくる -------------------------
   ★ 受付でルートを指定できます。
     …/index.html?route=A のように開くと、そのルートが選ばれた状態で始まります。
     受付にAとBの掲示（QR）を並べておけば、押しまちがいが起きません。
     押しまちがえたときのために、もう一方も押せるままにしてあります。 */

const pick = document.getElementById('routePick');
Object.keys(ROUTES).forEach(function (key) {
  const r = ROUTES[key];
  const b = document.createElement('button');
  b.className = 'routebtn';
  b.innerHTML =
    '<span class="rname">' + r.label + '</span>' +
    '<span class="rorder">' + r.order.map(cpMark).join(' → ') + '</span>';
  b.addEventListener('click', function () {
    /* 安全確認まで済んでいて順路だけが空のときは、③のQRの代わりです。
       押した時点で決まりとして、そのまま出発します。 */
    const s = loadSave();
    if (s.safetyDone && !s.routeSet) {
      s.route = key;
      s.routeSet = true;
      if (!s.startedAt) s.startedAt = Date.now();
      writeSave(s);
      location.href = 'result.html';
      return;
    }
    pickedRoute = key;
    document.querySelectorAll('.routebtn').forEach(function (x) { x.classList.remove('on'); });
    b.classList.add('on');
    document.getElementById('routeError').style.display = 'none';
    refreshStartLabel();
  });
  pick.appendChild(b);
  if (key === forcedRoute) {           // 受付で指定されたルート
    pickedRoute = key;
    b.classList.add('on');
  }
});
refreshStartLabel();

if (ROUTES[forcedRoute]) {
  /* 受付のQRから開いた場合。順路はもう決まっているので、
     「選ぶもの」ではなく「決まっているもの」として見せます。
     押しまちがいが起きないよう、選択ボタンは初期状態では畳んでおきます。 */
  const fx = document.getElementById('routeFixed');
  fx.style.display = 'block';
  fx.innerHTML =
    '<div class="routefixed">' +
      '<span class="big">' + ROUTES[forcedRoute].label + '</span>' +
      '<span class="ord">' + ROUTES[forcedRoute].order.map(cpMark).join(' → ') + '</span>' +
    '</div>' +
    '<p class="note" style="margin:0 0 10px">' +
      '受付で読み取ったQRコードで、<strong>この順路に決まりました。</strong>' +
      '<strong>上の安全確認</strong>をおえてから、スタートしてください。' +
    '</p>' +
    '<button class="btn sub" id="routeSwap" style="margin:0 0 4px">' +
      '順路を選びなおす（受付の指示とちがうとき）</button>';
  document.getElementById('routeLead').style.display = 'none';
  document.getElementById('routePick').style.display = 'none';
  document.getElementById('routeSwap').addEventListener('click', function () {
    document.getElementById('routeLead').style.display = 'block';
    document.getElementById('routeLead').innerHTML = '受付で指定されたほうを押してください。';
    document.getElementById('routePick').style.display = '';
    this.style.display = 'none';
  });
}

/* --- 4. 画面の飾りつけ ----------------------------------- */

mountHeader(true);
document.getElementById('limit').textContent = GAME.standardMin;

// 企画表題の後半（矢印つき）
if (GAME.tagline) {
  document.getElementById('heroTag').textContent =
    (GAME.taglineMark ? GAME.taglineMark + ' ' : '') + GAME.tagline;
}

// マスコットのふきだし（画像がなければ文字だけ出します）
// トップ画面は実写。data.js の mascot.start を見ます。
renderSpeech('mascotSpeech', 'mascotImg', 'mascotText', GAME.mascotStart, 'start');
document.getElementById('cpTotal').textContent = CHECKPOINTS.length;
document.getElementById('cpTotal2').textContent = CHECKPOINTS.length;
document.getElementById('checkTotal').textContent = GAME.safetyChecks.length;

// タイマーの起点を参加者に伝える（時計を出す設定のときだけ）
if (GAME.showTimer && GAME.timerStartsAt === 'first-cp') {
  const first = findCp(ROUTES.A.order[0]);
  document.getElementById('timerNote').innerHTML =
    '※ 時間の計測は<strong>「' + (first ? first.name : '最初のポイント') +
    '」のクイズに正解した時点から</strong>始まります。' +
    'それまでは席で説明・発表を聞いてください（画面は「待機中」と表示されます）。';
}

/* 端末の記録を消す（2段階） ---------------------------------
   ★ふだん使うものではありません。
     同じ端末を別の人が使うことは原則としてなく、必要になるのは
     テスト機と、まれな引き継ぎのときだけです。そのため、
     ページのいちばん下に小さく置き、記録があるときだけ出します。
   ★1回押しただけでは消えません。
     押すと、何が消えるかを書いた確認が開き、そこで「消す」を
     もう一度押してはじめて消えます。巡回中の人が指を滑らせても、
     1段目で止まります。 */
(function () {
  // ここは save の定義より前に走るので、自分で読み直します
  const s = loadSave();
  const done = Object.keys(s.cleared || {}).length;
  if (!s.startedAt && !done) return;      // 消すものが無ければ出しません
  const line = document.getElementById('wipeLine');
  const box = document.getElementById('wipeBox');
  if (!line || !box) return;
  line.style.display = 'block';

  document.getElementById('wipeLink').addEventListener('click', function (e) {
    e.preventDefault();
    document.getElementById('wipeMsg').innerHTML =
      'この端末の記録を消しますか。<br>' +
      (done ? '<strong>クリア済み ' + done + ' か所と、集めた文字が消えます。</strong>'
            : '<strong>出発前の記録が消えます。</strong>') +
      (s.goalDone ? '<strong>完走記録も消えます。</strong>' : '') +
      '<br>元にはもどせません。';
    line.style.display = 'none';
    box.style.display = 'block';
    box.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  document.getElementById('wipeCancel').addEventListener('click', function () {
    box.style.display = 'none';
    line.style.display = 'block';
  });

  document.getElementById('wipeGo').addEventListener('click', function () {
    resetSave();
    location.href = 'index.html';
  });
})();

renderFloors('floorBox');
renderStack('stackBox');
renderCredit('creditCard');
renderVersion('versionNote');

const save = loadSave();

/* すでに始めている場合は「進行中」の表示に切り替える。
   ★ ただし、受付のQR（?route=…）から来たときは話が別です。
     受付QRを読むのは「これから始める」合図なので、
     前の記録が残っていると安全確認にたどり着けなくなります。
     （同じスマホで友だちが続けて回るときなどに起きます） */
/* ★「進行中」に切り替えてよいのは、安全確認を済ませた人だけです。
   チェックポイントのQRを直接読んだ人にも startedAt は入りますが、
   その人はまだ安全確認を見ていません。ここで進行中の画面に切り替えると、
   安全確認のカードごと隠れてしまい、二度と出てこなくなります。
   安全確認が未了なら、下の説明カード（安全確認つき）をそのまま出します。 */
if (save.startedAt && save.safetyDone) {
  /* 説明のカードより上に「進行中」を出します。
     途中の人に、ロゲイニングの説明を読み直させないためです。 */
  document.getElementById('startCard').style.display = 'none';
  document.getElementById('startBlock').style.display = 'none';
  document.getElementById('resumeCard').style.display = 'block';
  document.getElementById('resumeBlock').style.display = 'block';
  /* ★自動でスクロールはしません。
     大多数はここで初めて開く人で、その人たちがページの途中から
     始まるほうが不自然です。途中から戻ってきた人が下へたぐるのは、
     自分で戻ってきた以上、自然な動作です。 */
  /* ★「進行中」と書いてよいのは、チェックポイントを1つでも通った後です。
     スタートを押しただけの人に「進行中」と出すと、何も読み取っていないのに
     先へ進んだように読めます。通過数で言いかたを分けます。 */
  const doneCp = clearedCount(save);
  const who = (save.team ? save.team + '（' + ROUTES[routeKey(save)].label + '）'
                         : ROUTES[routeKey(save)].label);
  if (save.goalDone) {
    /* ★ゴールまで終わっている端末に「つづきから…進行中」と出してはいけません。
       続きはもうありません。前に回った人の記録がそのまま残っている状態
       （同じスマホを次の人が使うときなど）で、そう書くと、
       これから始める人が「自分はもう5か所回ったことになっている」と読みます。
       終わっていることをそのまま伝え、やり直しは下のボタンに任せます。 */
    document.getElementById('resumeHead').textContent = 'この端末は、ゴールまで終わっています';
    document.getElementById('resumeLead').innerHTML =
      '<strong>' + who + '</strong>　' + doneCp + ' / ' + CHECKPOINTS.length + ' か所　' +
      '<strong>ゴール済み</strong>です。完走記録はいつでも見返せます。';
    document.getElementById('resumeBtn').textContent = '完走記録をみる';
  } else if (doneCp === 0) {
    document.getElementById('resumeHead').textContent = 'いよいよ、スタートです';
    document.getElementById('resumeLead').innerHTML =
      '出発の準備はできています。<strong>' + who + '</strong> の1か所目へ進んでください。';
    // まだ何も読み取っていないので「つづき」ではありません
    document.getElementById('resumeBtn').textContent = '1か所目へ進む';
  } else {
    document.getElementById('resumeHead').textContent = 'つづきから';
    document.getElementById('resumeLead').innerHTML =
      '<strong>' + who + '</strong> で進行中　' +
      doneCp + ' / ' + CHECKPOINTS.length + ' か所';
  }
  renderRoute('progress');

  if (ROUTES[forcedRoute]) {
    const sameRoute = routeKey(save) === forcedRoute;
    const fb = document.getElementById('freshBox');
    fb.style.display = 'block';
    fb.innerHTML =
      '<p class="note" style="margin:0 0 10px">' +
        'いま読み取ったのは <strong>' + ROUTES[forcedRoute].label + '</strong> の受付QRですが、' +
        '<strong>この端末には前の記録が残っています</strong>（' +
        ROUTES[routeKey(save)].label + '・' + clearedCount(save) + ' / ' + CHECKPOINTS.length + ' か所）。' +
        (sameRoute ? '' :
          '<br><strong style="color:#d9600f">前の記録とは順路がちがいます。</strong>') +
      '</p>' +
      '<button class="btn" id="freshBtn">' +
        ROUTES[forcedRoute].label + 'で新しく始める（前の記録を消します）</button>' +
      '<p class="note" style="margin:10px 0 0">前の人の続きでなければ、こちらを押してください。' +
        '出発前の安全確認から始まります。</p>';
    document.getElementById('freshBtn').addEventListener('click', function () {
      resetSave();
      location.href = 'index.html?route=' + forcedRoute;
    });
    // 「つづきをみる」は控えめにする（新しく始めるほうが主）
    document.getElementById('resumeBtn').className = 'btn sub';
  }
}

// 保存先が弱い場合はその場で知らせる
if (STORAGE_KIND !== 'local') {
  const w = document.getElementById('storageWarn');
  w.style.display = 'block';
  w.textContent = (STORAGE_KIND === 'session')
    ? '⚠ このブラウザでは進捗がタブを閉じるまでしか保存されません。タブを閉じずに進めてください。'
    : '⚠ このブラウザでは進捗を保存できません（シークレットモードの可能性）。'
      + '通常モードで開き直すことをおすすめします。このままでも遊べますが記録は残りません。';
}
