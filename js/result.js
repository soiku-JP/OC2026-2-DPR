/* ===========================================================
   result.js  進捗・フィニッシュ確認・認定証
   =========================================================== */


function draw() {
  const save = loadSave();
  document.getElementById('teamName').textContent =
    (save.team ? save.team + '　/　' : '') + ROUTES[routeKey(save)].label;
  renderLetters('letters');
  renderLettersBar('lettersBar', save);
  renderNext('nextBox', 'nextText');
  /* 順路の「✓→✓→…」の並びはここには出しません（result.html の注記を参照）。
     どのルートで回っているかは、いちばん上の行に出ています。 */

  const done = clearedCount(save);
  document.getElementById('countMsg').textContent =
    done + ' / ' + CHECKPOINTS.length + ' か所クリア　★一発正解 ' + starCount(save) + ' 個';

  // 残りの場所リスト（自分のルートの順番で並べる）
  const todo = document.getElementById('todo');
  todo.innerHTML = '';
  const rest = routeOrder(save)
    .filter(function (id) { return !save.cleared[id]; })
    .map(findCp);
  /* 残りが無いときは、カードごと消します。
     ゴールした人の画面は「完走記録 → アンケート」で終わらせます。
     ここに「スタート画面へ」を残すと、押した先で
     「つづきから」と出て、終わったのか終わっていないのか分からなくなります。 */
  const todoCard = document.getElementById('todoCard');
  if (rest.length === 0) {
    if (todoCard) todoCard.style.display = 'none';
  } else {
    if (todoCard) todoCard.style.display = '';
    rest.forEach(function (cp) {
      const li = document.createElement('li');
      // 名前を太く、場所は細く。ぱっと見て「どこの何か」が拾えるように
      const name = document.createElement('strong');
      name.textContent = cpLabel(cp.id) + '　' + cpName(cp, save);
      const place = document.createElement('span');
      place.className = 'todoplace';
      place.textContent = '（' + cpPlace(cp, save) + '）';
      li.appendChild(name);
      li.appendChild(place);
      todo.appendChild(li);
    });
  }

  if (done === CHECKPOINTS.length) {
    renderSpeech('goalSpeech', 'goalMascotImg', 'goalMascotText', GAME.mascotGoal, 'goal');
    if (save.goalDone) showCertificate(save);
    else showGoalQuiz();
  }
}

/* フィニッシュ確認 ---------------------------------------------
   チェックポイントと同じ考えかた。まちがえても正解はすぐ見せず、
   選んだものを消してヒントを出します。必ずゴールにたどり着けます。 */
let goalWrong = 0;
const goalOut = [];

function showGoalQuiz() {
  const card = document.getElementById('goalCard');
  card.style.display = 'block';
  document.getElementById('finalText').textContent = GAME.finalQuestion.text;
  buildGoalChoices();
  document.getElementById('finalFeedback').style.display = 'none';
}

function buildGoalChoices() {
  const box = document.getElementById('finalChoices');
  box.innerHTML = '';
  GAME.finalQuestion.choices.forEach(function (text, i) {
    const b = document.createElement('button');
    const dead = goalOut.indexOf(i) >= 0;
    b.className = 'choice' + (dead ? ' eliminated' : '');
    b.textContent = '\u3000' + (i + 1) + '.\u3000' + text;
    b.disabled = dead;
    b.addEventListener('click', function () { answerFinal(i); });
    box.appendChild(b);
  });
}

function answerFinal(i) {
  if (i !== GAME.finalQuestion.answer) {
    goalWrong++;
    goalOut.push(i);
    buildGoalChoices();
    const hb = document.getElementById('finalHint');
    hb.style.display = 'block';
    document.getElementById('finalHintMsg').textContent =
      goalWrong === 1 ? 'おしい！　もう一度考えてみよう' : 'あと少しです。';
    document.getElementById('finalHintText').innerHTML =
      '<strong>ヒント</strong>\u3000' +
      (GAME.finalQuestion.hint || '集めた5文字を、声に出して読んでみましょう。') +
      (goalWrong >= 2 ? '<br><br>分からなければ、<strong>受付のスタッフに聞いてみてください。</strong>' : '');
    return;
  }

  // 正解
  document.querySelectorAll('#finalChoices .choice').forEach(function (b, idx) {
    b.disabled = true;
    b.classList.remove('eliminated');
    if (idx === GAME.finalQuestion.answer) b.classList.add('correct');
    else if (goalOut.indexOf(idx) >= 0) b.classList.add('wrong');
  });
  document.getElementById('finalHint').style.display = 'none';
  const fb = document.getElementById('finalFeedback');
  fb.style.display = 'block';
  const msg = document.getElementById('finalMsg');
  msg.textContent = goalWrong === 0 ? 'せいかい！　ゴールです' : 'せいかい！　よく考えました';
  msg.className = 'result-msg ok';
  document.getElementById('finalExplain').textContent = GAME.finalQuestion.explain;

  const save = loadSave();
  save.goalDone = true;
  save.finishedAt = Date.now();
  writeSave(save);
  setTimeout(function () { showCertificate(loadSave()); }, 900);
}

/* ★の数 ---------------------------------------------------
   順位づけも称号もつけません。1回目で正解した数を、そのまま
   「五つ星」「四つ星」と呼ぶだけです。
   （◯個以上を上位とする線引きに根拠がないため）           */
function starName(stars) {
  const names = (GAME.star && GAME.star.names) || [];
  return names[stars] || ('★' + stars);
}
function starWord(stars) {
  const words = (GAME.star && GAME.star.words) || [];
  return words[stars] || '';
}

/* あいことばと★を見せる画面 -------------------------------- */
function showStarPanel(save) {
  const n = CHECKPOINTS.length;
  const stars = starCount(save);
  const card = document.getElementById('starCard');
  if (!card) return;
  card.style.display = 'block';

  const kw = CHECKPOINTS.map(function (cp) { return cp.letter; }).join('');
  document.getElementById('starKeyword').innerHTML =
    kw + '<small>' + (GAME.finalQuestion.choices[GAME.finalQuestion.answer] || '') + '</small>';

  // ★を1つずつ順に出します
  const row = document.getElementById('starRow');
  row.innerHTML = '';
  row.setAttribute('aria-label', '一発正解 ' + stars + ' / ' + n);
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i');
    const on = i < stars;
    s.className = on ? 'on' : '';
    s.textContent = on ? '★' : '☆';
    if (on) s.style.animationDelay = (0.12 * i) + 's';
    row.appendChild(s);
  }

  // 「三つ星」だけ。（3 / 5）は、すぐ上の★の並びを見れば分かります
  document.getElementById('starName').textContent = starName(stars);
  document.getElementById('starWord').textContent = starWord(stars);
  document.getElementById('starNote').textContent = (GAME.star && GAME.star.note) || '';

  // ★がそろった人には花火。data.js の fireworksMin で調整できます
  const min = (GAME.star && GAME.star.fireworksMin) || 0;
  if (min > 0 && stars >= min && typeof startFireworks === 'function') {
    const cv = document.getElementById('fireworks');
    if (cv && !cv.dataset.fired) {
      cv.dataset.fired = '1';
      cv.style.display = 'block';
      // ★の演出が出そろってから上げます
      setTimeout(function () { startFireworks(cv); }, 260 + 120 * n);
    }
  }
}

/* 認定証（canvasに描いて画像として保存できるようにする）--- */
function showCertificate(save) {
  document.getElementById('goalCard').style.display = 'none';
  showStarPanel(save);
  document.getElementById('certCard').style.display = 'block';

  const c = document.getElementById('certCanvas');
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  const stars = starCount(save);
  const sec = elapsedSec(save);
  /* 完走日。data.js の eventDate（開催日）があればそれを使い、
     なければ端末の日付にします。端末の時計ずれで日付が変わらないようにするためです。 */
  const d = new Date(save.finishedAt || Date.now());
  const dateStr = GAME.eventDate ||
    (d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日');
  // 完走ルート（Aルート／Bルート）
  const routeStr = (ROUTES[routeKey(save)] || {}).label || '';
  const F = '"Hiragino Sans","Noto Sans JP","Yu Gothic",Meiryo,sans-serif';

  // 背景
  g.fillStyle = '#12192a'; g.fillRect(0, 0, W, H);
  g.strokeStyle = '#ff8a3d'; g.lineWidth = 8; g.strokeRect(24, 24, W - 48, H - 48);
  g.strokeStyle = '#33405c'; g.lineWidth = 2; g.strokeRect(44, 44, W - 88, H - 88);

  const n = CHECKPOINTS.length;
  const kw = CHECKPOINTS.map(function (cp) { return cp.letter; }).join('');
  const kanji = GAME.finalQuestion.choices[GAME.finalQuestion.answer] || '';

  g.textAlign = 'center';
  g.fillStyle = '#9aa8c0'; g.font = '26px ' + F;
  g.fillText(GAME.title + '　完走記録', W / 2, 108);

  // ★ 中心はあいことば。順位づけになる呼び名は置きません
  g.fillStyle = '#9aa8c0'; g.font = '22px ' + F;
  g.fillText('あいことば', W / 2, 162);
  g.fillStyle = '#eef2f8'; g.font = 'bold 62px ' + F;
  g.fillText(kw, W / 2, 228);
  g.fillStyle = '#ff8a3d'; g.font = 'bold 34px ' + F;
  g.fillText(kanji, W / 2, 286);

  // 名前は聞かない設定のときは、名前の行を出しません
  if (save.team) {
    g.fillStyle = '#eef2f8'; g.font = 'bold 34px ' + F;
    g.fillText(save.team, W / 2, 326);
  }

  // ★の数（1回目で正解した数）
  g.fillStyle = '#ffd166'; g.font = '52px ' + F;
  g.fillText('★'.repeat(stars) + '☆'.repeat(n - stars), W / 2, save.team ? 396 : 372);
  g.fillStyle = '#eef2f8'; g.font = 'bold 30px ' + F;
  g.fillText(starName(stars) + '　一発正解 ' + stars + ' / ' + n +
             (GAME.showTimer ? '　／　所要時間 ' + formatTime(sec) : ''),
             W / 2, save.team ? 446 : 424);

  // ★どのルートで回ったか（完走ルート）は、この一文の中に入れています
  g.fillStyle = '#9aa8c0'; g.font = '22px ' + F;
  g.fillText((save.team ? '上記の参加者は、' : 'あなたは、') +
             (routeStr ? routeStr + 'で' : '') +
             '学内' + n + 'か所の防災設備等を確認し', W / 2, save.team ? 500 : 486);
  g.fillText('あいことば「' + kw + '（' + kanji + '）」を完成させました', W / 2, save.team ? 534 : 520);

  /* ★下3行（完走日・SNS・締めのことば）の位置と色。ここは直したところです。
     以前は 584 / 610 / 636 と、26pxずつで詰めて並べていました。
     22px・20px・26pxの文字を26px間隔で置いていたので、行と行のすきまが
     ほとんど残らず、まん中のSNSの行が上下から押されて窮屈でした。
     さらに SNS の色が #7f8ca6 で、地の色（#12192a）との差が小さく、
     いちばん小さい20pxだったこともあって、ほとんど読めませんでした。
     いまは 566 / 604 / 640 と間隔を広げ、SNSは24pxに上げて明るい色にしています。
     ★下の余白：外枠の内側は y=676、内枠は y=656 です。締めのことばは
       640（文字の下端はおよそ646）なので、内枠まで10pxほど残ります。
     ★右下のマスコットは x=804〜944・下端 y=640 の範囲です。
       この3行はいずれも中央そろえで右端は760ほどなので、掛かりません。
       長い文字列に変えるときは、ここを測り直してください。 */
  // 完走日と名義
  g.fillStyle = '#9aa8c0'; g.font = '22px ' + F;
  g.fillText(dateStr + '　' + (GAME.organizer || '日本大学危機管理学部'), W / 2, 566);

  // 公式SNSのアカウント名（data.js の snsLine）
  if (GAME.snsLine) {
    g.fillStyle = '#dfe8f7'; g.font = '24px ' + F;
    g.fillText(GAME.snsLine, W / 2, 604);
  }

  g.fillStyle = '#ff8a3d'; g.font = 'bold 26px ' + F;
  g.fillText('このキャンパスで、またお会いしましょう。', W / 2, 640);

  /* 画面には動く絵（GIF）を、保存する画像には止まった絵を入れます。
     GIFはcanvasに描くと1コマ目しか入らないので、静止画のほうを使います。 */
  const art = mascotFor('finish');
  /* 保存する画像に入れる絵。ピンクと青の2体（mascot-anime.png）です。
     ★横長なので、高さを詰めてあります。高さ150のままだと幅が200になり、
       すぐ下の「このキャンパスで、またお会いしましょう。」に重なります。 */
  const still = 'img/ui/mascot-anime.png';
  if (art && art.src) {
    const box = document.getElementById('finishArt');
    if (box) box.innerHTML = '<img src="' + art.src + '" alt="' + (art.alt || '') + '">';
  }

  /* 記念の画像にもマスコットを入れます。読み込みを待ってから
     画像に変換します（待たずに変換すると、マスコットが入りません）。 */
  /* ★ここで失敗することがあります。
     canvas に描いた絵を画像（データURL）に変換する処理ですが、
     ブラウザは「別の場所から来た画像を描いた canvas」の書き出しを禁じます。
     フォルダのファイルを直接ひらいた（file:// の）ときは、同じフォルダの
     画像でも「別の場所」とみなされるため、ここで例外が出ます。
     公開したURL（https）から開いたときは起きません。

     以前はこの例外をそのままにしていたため、変換に失敗すると
     完走記録が真っ白になり、保存ボタンも無反応のまま、
     理由がどこにも出ませんでした。ゴールした人が最後に見る画面なので、
     せめて記録は見えるようにし、できないことは書いて伝えます。 */
  function finishCert() {
    let dataUrl = '';
    try {
      dataUrl = c.toDataURL('image/png');
    } catch (e) {
      // 画像にはできないが、canvas はそのまま表示できる
      c.style.display = 'block';
      c.style.width = '100%';
      c.style.height = 'auto';
      c.style.borderRadius = '10px';
      document.getElementById('certImg').style.display = 'none';
      document.getElementById('saveBtn').style.display = 'none';
      /* 「長押しで保存」も、img ではなく canvas になるため使えません。
         できない方法を2つ並べて出さないよう、この案内も消します。 */
      const tip = document.getElementById('saveTip');
      if (tip) tip.style.display = 'none';
      const note = document.getElementById('certNote');
      note.style.display = 'block';
      note.innerHTML =
        '<strong>この開きかたでは、画像として保存できません。</strong><br>' +
        'スクリーンショットを撮って、受付に見せてください。';
      return;
    }
    document.getElementById('certImg').src = dataUrl;
    setupSaveButton(c, dataUrl, save);
  }
  const mi = new Image();
  mi.onload = function () {
    /* 右下に置きます。幅は絵の縦横比から決まるので、
       横長の絵でも文字に重ならないよう、幅のほうに上限を設けます。 */
    /* 幅140は測って決めた値です。これを超えると、絵の左端が
       完走日の行（右端およそ786px）に届いて重なります。 */
    const maxW = 140, maxH = 132;
    let w2 = Math.round(maxH * mi.width / mi.height);
    let h = maxH;
    if (w2 > maxW) { w2 = maxW; h = Math.round(maxW * mi.height / mi.width); }
    g.drawImage(mi, W - 56 - w2, 640 - h, w2, h);
    finishCert();
  };
  mi.onerror = finishCert;   // 画像がなくても記録は出します
  mi.src = still;

  // アンケートのURLが設定されていれば案内を出す
  if (GAME.surveyUrl) {
    document.getElementById('surveyCard').style.display = 'block';
    // Googleフォームの「事前入力したURL」に __TEAM__ を入れておくと、
    // 受付で渡した受付番号が自動で入った状態でフォームが開きます。
    // （参加者はメールアドレスを一切入力しません）
    document.getElementById('surveyBtn').href =
      GAME.surveyUrl.replace('__TEAM__', encodeURIComponent(save.team || ''));
  }
}

/* 保存ボタン ---------------------------------------------
   iPhone と パソコンで保存のしかたが違うため、
   使える方法を順番に試します。                            */
function setupSaveButton(canvas, dataUrl, save) {
  const btn = document.getElementById('saveBtn');
  const fileName = 'bosai_kansou_star' + starCount(save) + '.png';

  btn.onclick = function () {
    // ① 共有シート（iPhone・Android。「"画像"を保存」が選べます）
    canvas.toBlob(function (blob) {
      if (blob && navigator.canShare) {
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: '防災ロゲイニング 完走記録' })
            .catch(function () { fallback(); });
          return;
        }
      }
      fallback();
    }, 'image/png');

    // ② ダウンロード（パソコン向け）／それも無理なら新しいタブで開く
    function fallback() {
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      if (window.__diagBanner) {
        setTimeout(function () {
          document.getElementById('saveHint').style.display = 'block';
        }, 400);
      }
    }
  };
}

/* 画面の初期化（変数の定義より後に呼ぶ必要があります）------ */
mountHeader(true);
draw();
