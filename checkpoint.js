/* ===========================================================
   checkpoint.js  チェックポイント画面の動き
   URL の例: checkpoint.html?cp=9024
   ※ ?cp= に入るのは CP番号ではなく、data.js の code（4桁）です。
     連番にすると「数字を打ち替えれば現地に行かずに開ける」ため、
     わざと規則性のない番号にしてあります。
   -----------------------------------------------------------
   ★ 出題の考えかた
     ・まちがえても「正解」はすぐには見せません。
       選んだ選択肢だけを消し、ヒントを出して考え直してもらいます。
     ・3択なので、外れを消していけば必ず正解にたどり着けます。
       誰ひとり先に進めなくなることはありません。
     ・2回目のまちがいでは「学生スタッフに聞いてみよう」と案内します。
     ・★（一発正解ボーナス）は1回目で当てたときだけ。
   =========================================================== */

mountHeader(true);

// ?cp= の値は「4桁のcode」。CP番号ではありません。
const cpCode = String(getParam('cp') || '').trim();
const cp = CHECKPOINTS.find(function (c) { return c.code === cpCode; });

let wrongCount = 0;               // このページで何回まちがえたか
const eliminated = [];            // 消した（まちがえた）選択肢の番号

function showError(title, html) {
  document.getElementById('errorCard').style.display = 'block';
  document.getElementById('errorTitle').textContent = title;
  document.getElementById('errorMsg').innerHTML = html;
}

if (!cp) {
  /* ここに来るのは2通り。
     ① QRがうまく読めなかった → スタッフを呼んでもらう
     ② URLの数字を打ち替えて開こうとした → 「封じてある」と正直に伝える
     どちらの人が見ても筋が通る文面にしてあります。 */
  showError('このページは開きません',
    'URLのうしろの数字を打ち替えてみた人へ。<strong>その手に気づいたのは鋭いです。</strong>' +
    'ただ、この数字はチェックポイントの番号とは一致しておらず、規則性もありません。' +
    '<strong>行って、見て、聞いてはじめてわかること。' +
    'これが「防災ロゲイニング」です。</strong>' +
    '<br><br>' +
    'QRコードを読み取ったのにこの画面が出た場合は、近くの学生スタッフに知らせてください。');
} else {
  const save = loadSave();
  if (!save.startedAt) {
    // スタートしていない場合も遊べるようにしておく（自動スタート）
    save.startedAt = Date.now();
    save.autoStarted = true;   // あとで安全確認をしたとき、この進捗を残す目印
    // 名前を聞く設定のときだけ、仮の名前を入れます
    if (GAME.askName && !save.team) save.team = 'ゲスト';
    writeSave(save);
  }
  render();
}

/* 画面をつくる ------------------------------------------- */

function render() {
  document.getElementById('main').style.display = 'block';

  /* 安全確認をしていない人（受付を通らず、ここから始めた人）に知らせます。
     止めはしません。ここで進めなくすると、スタッフのいない場所で
     行き止まりになる人が出ます。 */
  const sw = document.getElementById('safetyWarn');
  if (sw && !loadSave().safetyDone) {
    document.getElementById('swCount').textContent = GAME.safetyChecks.length;
    sw.style.display = 'block';
  }

  // ルートの順番どおりか、やんわり知らせる（進むのは止めません）
  const s = loadSave();
  const expect = nextCp(s);
  if (expect && expect.id !== cp.id && !s.cleared[cp.id]) {
    const w = document.getElementById('orderWarn');
    w.style.display = 'block';
    /* ★短くしています。名前や場所は、すぐ下の「つぎに行く場所」に
       もう一度出るので、ここで繰り返しません。 */
    w.textContent = '⚠ 順番が前後しています。' + ROUTES[routeKey(s)].label +
      'のつぎは' + cpLabel(expect.id) + 'です。このまま進めます。';
  }

  // その場所の色と絵文字（画像は増えません。色と文字だけです）
  if (cp.theme) {
    document.documentElement.style.setProperty('--cp', cp.theme);
    document.documentElement.style.setProperty('--cp-soft', cp.themeSoft || '#fff1e4');
  }
  if (cp.emoji) {
    const em = document.getElementById('cpEmoji');
    em.style.display = 'block';
    em.textContent = cp.emoji;
  }

  document.getElementById('cpPlace').textContent = cpLabel(cp.id) + '　' + cp.place;
  document.getElementById('cpName').textContent = cp.name;
  // 混みやすい場所では「見たらすぐ移動」を、写真より先に出す
  if (cp.moveNote) {
    const mv = document.getElementById('cpMove');
    mv.style.display = 'block';
    mv.innerHTML = cp.moveNote;
  }
  // 写真（images が書いてあれば複数、なければ image を1枚）
  const box = document.getElementById('cpPhotos');
  box.className = 'photos';
  const list = cp.images || (cp.image ? [cp.image] : []);
  box.classList.toggle('two', list.length > 1);
  list.forEach(function (src) {
    const img = document.createElement('img');
    img.className = 'photo';
    img.src = src;
    img.alt = cp.imageAlt || cp.name;
    img.loading = 'lazy';
    img.onerror = function () { img.remove(); };
    box.appendChild(img);
  });
  document.getElementById('cpDesc').textContent = cp.description;
  /* ★「まちがっているものを選ぶ」問題の合図。
     ほかの4問はすべて「正しいものを選ぶ」形です。1問だけ向きが逆だと、
     読み流した人がそのまま引っかかります。問題の難しさではなく、
     出題形式の不統一で外させるのは、この企画の趣旨に合いません。 */
  if (cp.quiz.negative) {
    const neg = document.getElementById('qNeg');
    if (neg) {
      neg.textContent = 'この問題だけ、まちがっているものを選びます';
      neg.style.display = 'block';
    }
  }
  document.getElementById('qText').textContent = cp.quiz.text;
  buildChoices();

  // すでにクリア済みなら、答えと解説を最初から見せる
  if (s.cleared[cp.id]) showAnswer(false);
}

function buildChoices() {
  const box = document.getElementById('choices');
  box.innerHTML = '';
  cp.quiz.choices.forEach(function (text, i) {
    const b = document.createElement('button');
    const dead = eliminated.indexOf(i) >= 0;
    b.className = 'choice' + (dead ? ' eliminated' : '');
    b.textContent = '　' + (i + 1) + '.　' + text;
    b.disabled = dead;
    b.addEventListener('click', function () { answer(i); });
    box.appendChild(b);
  });
}

/* 回答 ---------------------------------------------------- */

function answer(i) {
  if (i === cp.quiz.answer) { showAnswer(true); return; }

  // まちがえたとき：選んだものだけ消して、ヒントを出す
  wrongCount++;
  eliminated.push(i);
  buildChoices();
  showHint();
}

function showHint() {
  const box = document.getElementById('hintBox');
  box.style.display = 'block';
  const msg = document.getElementById('hintMsg');
  const txt = document.getElementById('hintText');

  const remaining = cp.quiz.choices.length - eliminated.length;

  if (wrongCount === 1) {
    msg.textContent = 'おしい！　もう一度考えてみよう';
    txt.innerHTML = '<strong>ヒント</strong>　' +
      (cp.quiz.hint || '説明文をもう一度読んでみましょう。答えのてがかりが書いてあります。');
  } else {
    msg.textContent = remaining > 1 ? 'もう一歩。' : 'あと1つです。';
    txt.innerHTML = '<strong>ヒント</strong>　' +
      (cp.quiz.hint || '説明文をもう一度読んでみましょう。') +
      '<br><br>分からなければ、<strong>近くの学生スタッフに聞いてみてください。</strong>' +
      'このポイントの担当者が教えてくれます。';
  }
  box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

/* 正解したとき -------------------------------------------- */

function showAnswer(justAnswered) {
  const save = loadSave();
  const already = !!save.cleared[cp.id];
  const firstTry = justAnswered && wrongCount === 0 && !already;

  if (justAnswered && !already) {
    save.cleared[cp.id] = { firstTry: firstTry, at: Date.now() };
    writeSave(save);
  }

  // 選択肢を確定表示にする
  document.querySelectorAll('.choice').forEach(function (b, i) {
    b.disabled = true;
    b.classList.remove('eliminated');
    if (i === cp.quiz.answer) b.classList.add('correct');
    else if (eliminated.indexOf(i) >= 0) b.classList.add('wrong');
  });

  document.getElementById('hintBox').style.display = 'none';
  /* ★順番の注意は消しません。
     消してしまうと、飛ばして読み取った人の画面に
     「つぎに行く場所＝飛ばしたポイント」だけが残り、
     なぜそこへ戻されるのか分からなくなります。 */

  const fb = document.getElementById('feedback');
  fb.style.display = 'block';
  const msg = document.getElementById('resultMsg');
  if (!justAnswered) {
    msg.textContent = 'このポイントはクリア済みです';
    msg.className = 'result-msg ok';
  } else if (firstTry) {
    msg.textContent = '★ 正解！　一発正解ボーナス';
    msg.className = 'result-msg ok';
  } else {
    msg.textContent = '正解！　よく考えました';
    msg.className = 'result-msg ok';
  }

  document.getElementById('explain').textContent = cp.quiz.explain;
  // 画面では出典の「名前」だけを出します（URLは data.js と資料に残しています）
  document.getElementById('source').textContent =
    cp.source ? '出典：' + cp.source.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim() : '';
  document.getElementById('rewardBlock').style.display = 'block';
  document.getElementById('rewardLetter').textContent = cp.letter;
  // 集めた文字と、あと何文字かを、その場で見せる
  const after = loadSave();
  renderLetters('rewardLetters');
  renderLettersBar('rewardBar', after);
  const left = CHECKPOINTS.length - clearedCount(after);
  // 「↓ 下につぎの行き先がある」ことを、ここで一言。
  // 正解を見て歩き出してしまう人を、この1行で引き止めます。
  document.getElementById('rewardLeft').innerHTML =
    (left > 0 ? 'あと ' + left + ' 文字' : CHECKPOINTS.length + '文字そろいました！') +
    '<br><span style="color:var(--accent-dark);font-weight:700">' +
    '↓ このあと、' + (left > 0 ? 'つぎに行く場所' : 'ゴール') + 'が出ます</span>';
  /* 1回目で正解した人にだけ、バンザイの絵と別のことばを出します。
     まちがえてから正解した人に同じ絵を出すと、ほめ言葉が軽くなります。 */
  if (justAnswered) {
    renderSpeech('cpSpeech', 'cpMascotImg', 'cpMascotText',
                 firstTry ? (GAME.mascotStar || GAME.mascotCorrect) : GAME.mascotCorrect,
                 firstTry ? 'correctStar' : 'correct');
  }

  renderNext('nextBox', 'nextText');
  // ボタンの文字も、次にすることに合わせて変えます
  const remain = nextCp(loadSave());
  document.getElementById('nextBtn').textContent =
    remain ? 'この地図をもう一度みる（進捗画面）' : 'ゴールへ進む';
  fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

document.getElementById('nextBtn').addEventListener('click', function () {
  location.href = 'result.html';
});
