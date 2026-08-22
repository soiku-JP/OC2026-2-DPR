/* ===========================================================
   map.js  平面図の表示（ルート図）
   -----------------------------------------------------------
   ★ 歩きスマホ防止の考えかた
     地図は「立ち止まっている間に、次の行き先を確かめる」ためのものです。
     移動中に見るものではないので、
       ・チェックポイントのクイズに正解したあと
       ・進捗画面
     の2か所だけに出し、画面には常に注意書きを添えています。

   ★ 矢印は引きません（rev.40 で廃止）
     通路にそった折れ線を描くには、曲がり角の座標を現地で測る必要があり、
     図面からの推定で線を出すと「壁を突き抜けた線」になります。
     まちがった線は、無い線より悪いと判断しました。
     行きかたは、地図の下の説明文で伝えます。

   ★ 目印のつけかた
     参加者は平面図に慣れていません。そこで、どのフロアにも共通する
     目印を2つ、必ず同じ色で置いています。
       ・吹き抜け（黄）… 建物の中央。いま自分がどこにいるかの基準
       ・階段（青）  … 上下階の移動に使う階段
     この2つと、目的地のオレンジの丸。見るものを3つに絞っています。
   =========================================================== */

/* 共通部品 ------------------------------------------------ */

// 平面図1枚ぶんの土台（画像＋吹き抜け＋階段）をつくる
function mapBase(floor) {
  const wrap = document.createElement('div');
  wrap.className = 'mapwrap';

  const img = document.createElement('img');
  img.src = floor.image;
  img.alt = floor.label + 'の平面図';
  img.className = 'mapimg';
  wrap.appendChild(img);

  if (floor.atrium) {
    const at = document.createElement('span');
    at.className = 'pin atrium';
    at.style.left = floor.atrium.x + '%';
    at.style.top = floor.atrium.y + '%';
    at.textContent = '吹き抜け';
    at.title = '建物の中央にある吹き抜け。どの階からも見えます';
    wrap.appendChild(at);
  }

  if (floor.stairs) {
    const st = document.createElement('span');
    st.className = 'pin stairs';
    st.style.left = floor.stairs.x + '%';
    st.style.top = floor.stairs.y + '%';
    st.textContent = '階段';
    st.title = '上下階の移動に使う階段';
    wrap.appendChild(st);
  }

  return { wrap: wrap, img: img };
}

/* いまいる場所から目的地までの「行き方」を1〜3行で作ります。
   -----------------------------------------------------------
   ★ 屋外のチェックポイント（かまどベンチ）を、階の移動と同じ
     扱いにすると案内が破綻します。
       ・そこへ向かうとき … 階を移動したうえで、さらに外へ出る
       ・そこから出るとき … 外にいるので、まず建物の中に戻る
     この2つを必ず言うようにしてあります。
   ★ 同じ部屋のとき（出発時・ゴール）は、移動の案内を出しません。 */
function floorHint(target, save) {
  const here = whereAmI(save);
  if (!here || !here.floor || !target || !target.floor) return '';

  // 同じ部屋の中なら、移動はありません
  if (here.room && target.room && here.room === target.room) {
    return '<br><strong>移動はありません。いまいる部屋の中です。</strong>';
  }

  let s = '';
  // ① いま外にいるなら、まず建物へ
  if (here.outdoor) s += '<br><strong>まず、建物の中に戻ってください。</strong>';

  // ② 階の移動
  if (here.floor !== target.floor) {
    s += '<br><strong>' + (here.outdoor ? 'そのあと、' : 'まず、') +
         '中央の吹き抜け横の階段で' + FLOORS[target.floor].label +
         'へ移動してください。</strong>';
  } else if (!here.outdoor) {
    s += '<br><strong>いまいる階と同じです。</strong>階段は使いません。';
  }

  // ③ 目的地が外なら、外へ出る
  if (target.outdoor) {
    s += '<br><strong style="color:#d9600f">' + FLOORS[target.floor].label +
         'に着いたら、建物の外に出てください。</strong>' +
         (target.access ? target.access : '');
  }
  return s;
}

/* 地図の下に添える説明文（見出しは「ルート図」で統一）
   mode … 'move'    ふつうの移動。目印と歩きかたを添える
          'outdoor' 目的地が建物の外。外に出てから探す言いかたにする
          'search'  ミステリースポット。目印は出すが「探す」で締める
          'plain'   移動しない場面（出発時・同じ部屋）。何も足さない */
function mapCaption(floor, body, mode) {
  const m = mode || 'move';
  const cap = document.createElement('p');
  cap.className = 'mapcap';
  const marks = (m !== 'plain' && floor.atrium)
    ? '<br>目印：建物の中央が<strong style="color:#c99a00">吹き抜け（黄）</strong>。' +
      '上下階の移動は、そのすぐ横の<strong style="color:#3f7fc4">階段（青）</strong>です。'
    : '';
  let tail = '';
  if (m === 'move') {
    tail = '<br><span class="mapnote">地図に順路の線は引いていません。' +
           '<strong>吹き抜けと階段を目印に、通路を通って向かってください。</strong>' +
           '分からないときは、前のポイントに戻って学生スタッフに聞いてください。</span>';
  } else if (m === 'outdoor') {
    tail = '<br><span class="mapnote">地図に順路の線は引いていません。' +
           '<strong>建物の外に出てから、地図のオレンジの丸のあたりを探してください。</strong>' +
           '分からないときは、前のポイントに戻って学生スタッフに聞いてください。</span>';
  } else if (m === 'search') {
    tail = '<br><span class="mapnote">' + floor.label +
           'に着いたら、<strong>現地の案内表示と学生スタッフをたよりに探してください。</strong>' +
           '分からないときは、前のポイントに戻って聞いてください。</span>';
  }
  cap.innerHTML =
    '<span class="maptag">ルート図</span><strong>' + floor.label + '</strong>　' + body + marks + tail;
  return cap;
}

/* 3つの階を重ねた立体図 -------------------------------------
   平面図を3枚、少し傾けて積み上げます。
   ねらいは1つだけ、「上下に移動する企画だ」と体で分かること。
   細かい部屋の形を読ませる図ではないので、平面図はうすく敷き、
   ・中央をつらぬく階段の柱
   ・チェックポイントの番号
   ・ホームから出てホームへ戻る一周であること
   の3つだけがはっきり見えるようにしてあります。          */
function renderStack(elId) {
  const el = document.getElementById(elId);
  if (!el || typeof FLOORS === 'undefined') return;

  /* 3枚に共通で使う位置（実測値の平均）。
     階段も吹き抜けも、上下階で同じ場所にあるものなので、
     3枚とも同じ座標に置いて、まっすぐ串刺しに見えるようにします。 */
  function axis(kind) {
    const list = Object.keys(FLOORS).map(function (k) { return FLOORS[k][kind]; }).filter(Boolean);
    if (!list.length) return null;
    return {
      x: list.reduce(function (s, p) { return s + p.x; }, 0) / list.length,
      y: list.reduce(function (s, p) { return s + p.y; }, 0) / list.length
    };
  }
  const keys = Object.keys(FLOORS).reverse();           // 上の階から積む
  const scene = document.createElement('div');
  scene.className = 'stackscene';

  keys.forEach(function (k, i) {
    const floor = FLOORS[k];
    const plane = document.createElement('div');
    plane.className = 'plane';
    plane.style.setProperty('--i', i);

    const img = document.createElement('img');
    img.src = floor.image;
    img.alt = '';
    plane.appendChild(img);

    /* 階段（青）… 上下移動の軸。
       同じ階段なので、3枚とも<strong>同じ位置</strong>に置きます。
       階ごとの実測値には数％のばらつきがあり、そのまま使うと
       串刺しの線が折れ曲がって見えます。 */
    /* ★面の上には「位置の目印」だけを置きます（見えません）。
       番号や札は、傾いていない板の上に水平に描きます。
       面に直接文字を置くと、番号だけが寝ていて、階や設備の札は
       立っている、という不統一な見た目になるためです。 */
    const sx = axis('stairs');
    if (sx) {
      const st = document.createElement('span');
      st.className = 'anchor';
      st.dataset.kind = 'stair';
      st.style.left = sx.x + '%';
      st.style.top = sx.y + '%';
      plane.appendChild(st);
    }

    /* 吹き抜け（黄）… 階段のすぐ横にある、建物の中央の目印。
       ゲーム中の地図では、この2つを「いまどこにいるか」の基準にします。
       最初の説明の時点で並べて見せておかないと、参加者は
       ゲームが始まってからはじめて吹き抜けに出会うことになります。 */
    const ax = axis('atrium');
    if (ax) {
      const at = document.createElement('span');
      at.className = 'anchor';
      at.dataset.kind = 'atrium';
      at.style.left = ax.x + '%';
      at.style.top = ax.y + '%';
      plane.appendChild(at);
    }
    CHECKPOINTS.forEach(function (cp) {
      if (cp.floor !== k) return;
      // ミステリースポットは、場所を出さずに「？」だけ置きます
      const my = cp.mystery ? (cp.mysteryPin || { x: 26, y: 30 }) : null;
      const a = document.createElement('span');
      a.className = 'anchor';
      a.dataset.kind = 'cp';
      a.dataset.label = my ? '？' : String(cp.id);
      a.dataset.color = my ? '#6b6560' : (cp.theme || '#d9600f');
      if (my) a.dataset.mystery = '1';
      if (cp.outdoor) a.dataset.outdoor = '1';
      a.style.left = (my ? my.x : cp.x) + '%';
      a.style.top = (my ? my.y : cp.y) + '%';
      plane.appendChild(a);
    });

    scene.appendChild(plane);

    // 階の名前は、傾けない別の札で出します（読みにくくならないように）
    const tag = document.createElement('span');
    tag.className = 'planetag';
    tag.style.setProperty('--i', i);
    tag.innerHTML = floor.label +
      (GAME.goal && GAME.goal.floor === k ? '<b>ホーム</b>' : '');
    scene.appendChild(tag);
  });

  el.innerHTML = '';
  el.appendChild(scene);

  /* 階段の点どうしを線でつなぎ、屋外のポイントに札を出します。
     傾いた面の上に線や文字を置くと読めなくなるので、
     画面上の座標を測って、傾いていない板の上に描きます。 */
  const over = document.createElement('div');
  over.className = 'stackover';
  scene.appendChild(over);
  function decorate() {
    const box = scene.getBoundingClientRect();
    if (!box.width) return;
    over.innerHTML = '';
    const at = function (s) {
      const r = s.getBoundingClientRect();
      return [r.left + r.width / 2 - box.left, r.top + r.height / 2 - box.top];
    };
    const pts = [];
    scene.querySelectorAll('.anchor[data-kind="stair"]').forEach(function (s) {
      pts.push(at(s));
    });
    if (pts.length > 1) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
      svg.setAttribute('aria-hidden', 'true');
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      line.setAttribute('points', pts.map(function (p) { return p[0] + ',' + p[1]; }).join(' '));
      svg.appendChild(line);
      over.appendChild(svg);
      // 「階段」の札は、いちばん上の点のそばに
      const tag = document.createElement('span');
      tag.className = 'stairtag';
      tag.textContent = '階段';
      tag.style.left = pts[0][0] + 'px';
      tag.style.top = pts[0][1] + 'px';
      over.appendChild(tag);
    }
    // 階段の丸
    pts.forEach(function (p) {
      const d = document.createElement('span');
      d.className = 'sdot';
      d.style.left = p[0] + 'px';
      d.style.top = p[1] + 'px';
      over.appendChild(d);
    });
    /* 吹き抜けの軸線（黄の破線）・丸・札。
       吹き抜けは上下階を貫く穴なので、階段と同じように、
       3階ぶんを1本の線でつないで「まっすぐ抜けている」ことを見せます。 */
    const apts = [];
    scene.querySelectorAll('.anchor[data-kind="atrium"]').forEach(function (s) {
      apts.push(at(s));
    });
    if (apts.length > 1) {
      const asvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      asvg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
      asvg.setAttribute('aria-hidden', 'true');
      const aline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
      aline.setAttribute('class', 'atriumline');
      aline.setAttribute('points', apts.map(function (p) { return p[0] + ',' + p[1]; }).join(' '));
      asvg.appendChild(aline);
      over.appendChild(asvg);
    }
    apts.forEach(function (p) {
      const d = document.createElement('span');
      d.className = 'adot';
      d.style.left = p[0] + 'px';
      d.style.top = p[1] + 'px';
      over.appendChild(d);
    });
    // チェックポイントの番号（すべて水平）
    scene.querySelectorAll('.anchor[data-kind="cp"]').forEach(function (s) {
      const p = at(s);
      const badge = document.createElement('span');
      badge.className = 'cpbadge' + (s.dataset.mystery ? ' mystery' : '');
      badge.textContent = s.dataset.label;
      badge.style.background = s.dataset.color;
      badge.style.left = p[0] + 'px';
      badge.style.top = p[1] + 'px';
      over.appendChild(badge);
      if (s.dataset.outdoor) {
        const tag = document.createElement('span');
        tag.className = 'outtag';   // 置き場所は css の .stackover .outtag（③の左）
        tag.textContent = '屋外';
        tag.style.background = s.dataset.color;
        tag.style.left = p[0] + 'px';
        tag.style.top = p[1] + 'px';
        over.appendChild(tag);
      }
    });

    /* 「吹き抜け」の札は、いちばん最後に置きます。
       -----------------------------------------------------------
       札は丸の左に出します（上に出すと「階段」の札とぶつかるため）。
       ただし、どの階に出すかは画面の幅で変わります。図は横幅に合わせて
       縮むので、狭い画面では階と階の間隔がつまり、決め打ちにすると
       番号や「屋外」の札に重なります。実際に置いてみて、重ならない階を
       選びます。真ん中の階から順に試し、どこも空いていなければ真ん中に
       戻します（重なっても、いちばん見やすい位置のため）。 */
    if (apts.length) {
      const tag = document.createElement('span');
      tag.className = 'atriumtag';
      tag.textContent = '吹き抜け';
      over.appendChild(tag);

      const others = [];
      over.querySelectorAll('.cpbadge, .stairtag, .outtag').forEach(function (e) {
        others.push(e.getBoundingClientRect());
      });
      // 重なっている面積。0 なら、どことも重なっていません
      const overlap = function (r) {
        return others.reduce(function (sum, o) {
          const w = Math.min(r.right, o.right) - Math.max(r.left, o.left);
          const h = Math.min(r.bottom, o.bottom) - Math.max(r.top, o.top);
          return sum + (w > 0 && h > 0 ? w * h : 0);
        }, 0);
      };
      const order = [Math.floor(apts.length / 2)];
      for (let i = apts.length - 1; i >= 0; i--) {
        if (order.indexOf(i) < 0) order.push(i);
      }
      const put = function (idx, dy) {
        tag.style.left = apts[idx][0] + 'px';
        tag.style.top = (apts[idx][1] + dy) + 'px';
      };
      /* いちばん重なりの小さい置きかたを選びます。
         階を変えるだけでは、狭い画面で番号の下端をかすめることがあるので、
         上下に少しずらす手も試します。「重なっていない場所が無い」で
         投げ出さず、いちばんましな場所に置くための書き方です。
         同点なら、先に試したもの（真ん中の階・ずらさない）が残ります。 */
      const nudges = [0, 9, -9];
      let bestI = order[0], bestD = 0, min = Infinity;
      for (let j = 0; j < order.length && min > 0; j++) {
        for (let k = 0; k < nudges.length && min > 0; k++) {
          put(order[j], nudges[k]);
          const v = overlap(tag.getBoundingClientRect());
          if (v < min) { min = v; bestI = order[j]; bestD = nudges[k]; }
        }
      }
      put(bestI, bestD);
    }
  }
  const imgs = scene.querySelectorAll('img');
  let left = imgs.length;
  imgs.forEach(function (im) {
    if (im.complete) { if (--left === 0) requestAnimationFrame(decorate); }
    else im.addEventListener('load', function () { if (--left === 0) requestAnimationFrame(decorate); });
  });
  if (!imgs.length) requestAnimationFrame(decorate);
  window.addEventListener('resize', function () { requestAnimationFrame(decorate); });

  const cap = document.createElement('p');
  cap.className = 'note stackcap';
  // 図の注記なので、3つとも行の頭に ※ をつけます
  /* 注記は1行ずつ別の箱にします。※をぶら下げて、
     2行目以降を文字の位置にそろえるためです（<br> だとそろいません）。 */
  const lines = [
    '※ 建物の中央が<strong style="color:#a87c00">吹き抜け（黄）</strong>。' +
      '上下の移動に使う<strong style="color:#3f7fc4">中央の階段（青）</strong>は、そのすぐ横です。' +
      '<strong>ゲーム中の地図でも、この2つが目印になります。</strong>',
    '※ 2本の破線が、上下に貫いている吹き抜けと階段です。' +
      '<strong>2階のホームを出て、下の階をまわり、またホームへ戻ってくる</strong>一周になります。',
    '※ <strong style="color:' + (findCp(3) && findCp(3).theme || '#c0421f') + '">' +
      '③ かまどベンチだけは建物の外</strong>です。' +
      'メインエントランスを出て、右手すぐにあります。',
    '※ <strong>「？」はミステリースポット。</strong>' +
      '地下1階のどこかにありますが、<strong>場所は示していません。</strong>' +
      '現地の案内表示と学生スタッフをたよりに探してください。'
  ];
  cap.innerHTML = lines.map(function (t) {
    return '<span class="nline">' + t + '</span>';
  }).join('');
  el.appendChild(cap);
  el.style.display = 'block';
}

/* 出発時（ホームに全員が座っている場面）の説明 ---------------
   ここは「次の場所へ行く案内」ではありません。
   いま自分がどこにいて、これから何をするのかの全体像を伝えます。
   階ごとのチェックポイント数は data.js から数えるので、
   場所を増減しても文がずれません。 */
function departureCaption(here, last) {
  const byFloor = {};
  CHECKPOINTS.forEach(function (c) { byFloor[c.floor] = (byFloor[c.floor] || 0) + 1; });
  /* いまいる階を先に、残りは上の階から順に並べます
     （FLOORS は地下→上の順で書いてあるので、ひっくり返します） */
  const keys = Object.keys(FLOORS).reverse();
  const idx = keys.indexOf(here.floor);
  if (idx > 0) keys.unshift(keys.splice(idx, 1)[0]);
  const counts = keys.filter(function (k) { return byFloor[k]; }).map(function (k) {
    return (k === here.floor ? 'この' : '') + FLOORS[k].label + 'に' + byFloor[k] + 'つ';
  }).join('、');

  return '皆さんがいまいる場所は、<strong style="color:#d9600f">オレンジの丸（' +
           cpLabel(here.id) + '）</strong>です。' +
         '他のポイントをまわってから再びここに戻り、<strong style="color:#3f7fc4">青い丸（' +
           cpLabel(last.id) + '）</strong>が最終目的地となります。' +
         '<br>チェックポイントは全部で' + CHECKPOINTS.length + 'つ。' + counts + 'あります。' +
         '上下階の移動は、吹き抜けの横の<strong style="color:#3f7fc4">階段（青）</strong>を使用してください。' +
         '<br><span class="mapnote">分からないときは、' +
         '前のポイントに戻って学生スタッフに聞いてください。</span>';
}

/* 目的地の平面図 ------------------------------------------ */

function renderMap(elId, cp) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = '';
  if (!cp || !cp.floor || !FLOORS[cp.floor]) { el.style.display = 'none'; return; }

  const floor = FLOORS[cp.floor];
  const save = loadSave();
  const hide = isHidden(cp, save);   // ミステリースポットは位置を出さない
  el.style.display = 'block';

  /* ★出発時（ホームに全員が座っている場面）かどうか。
     まだ1か所も回っておらず、最初の行き先がいまいる部屋そのもの、
     という状態です。ここは「次の場所への案内」ではなく、
     これから何をするのかの全体像を伝える場面になります。 */
  const lastCp = findCp(routeOrder(save)[routeOrder(save).length - 1]);
  const isDeparture = !prevCp(save) && !hide &&
                      cp.room && lastCp && lastCp.room && cp.room === lastCp.room &&
                      cp.floor === lastCp.floor;

  const base = mapBase(floor);
  base.img.onerror = function () {
    // 平面図をまだ入れていない場合は、地図ごと隠す（アプリは止めない）
    el.style.display = 'none';
  };

  // 同じフロアにある他のチェックポイントを薄く置く（位置関係が分かるように）
  CHECKPOINTS.forEach(function (other) {
    if (other.floor !== cp.floor) return;
    // 伏せているポイントは描かない。ミステリースポットは、クリア後も描きません
    if (isPinHidden(other) || isHidden(other, save)) return;
    const pin = document.createElement('span');
    const isTarget = (other.id === cp.id);
    // 出発時だけ、最後のチェックポイントを青くして「最終目的地」を示します
    const isLast = isDeparture && lastCp && other.id === lastCp.id;
    pin.className = 'pin' + (isTarget ? ' target' : (isLast ? ' lastpin' : ' dim'));
    pin.style.left = other.x + '%';
    pin.style.top = other.y + '%';
    pin.textContent = other.id;
    pin.title = cpLabel(other.id) + '　' + other.name;
    base.wrap.appendChild(pin);
  });

  // ゴール（ホーム）も同じフロアなら、薄く置いておく
  // ただし出発時は、④と⑤の説明に集中させるため出しません
  if (!isDeparture && GAME.goal && GAME.goal.floor === cp.floor) {
    const gp = document.createElement('span');
    gp.className = 'pin homepin';
    gp.style.left = GAME.goal.x + '%';
    gp.style.top = GAME.goal.y + '%';
    gp.textContent = 'ホーム';
    base.wrap.appendChild(gp);
  }

  el.appendChild(base.wrap);
  if (isDeparture) {
    el.appendChild(mapCaption(floor, departureCaption(cp, lastCp), 'plain'));
  } else {
    const here = whereAmI(save);
    const sameRoom = !!(here && here.room && cp.room && here.room === cp.room);
    const body = (hide
      ? '<strong style="color:#d9600f">この場所は地図に出していません。</strong>'
      : '<strong style="color:#d9600f">オレンジの丸（' + cpLabel(cp.id) + '）が目的地</strong>です。')
      + floorHint(cp, save);
    el.appendChild(mapCaption(floor, body,
      sameRoom ? 'plain' : (hide ? 'search' : (cp.outdoor ? 'outdoor' : 'move'))));
  }
}

/* ゴール（ホーム）の場所 ---------------------------------- */

function renderGoalMap(elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  el.innerHTML = '';
  const g = GAME.goal;
  if (!g || !g.floor || !FLOORS[g.floor]) { el.style.display = 'none'; return; }
  const floor = FLOORS[g.floor];
  el.style.display = 'block';

  const save = loadSave();
  const base = mapBase(floor);
  base.img.onerror = function () { el.style.display = 'none'; };

  const pin = document.createElement('span');
  pin.className = 'pin target goalpin';
  pin.style.left = g.x + '%';
  pin.style.top = g.y + '%';
  pin.textContent = 'ゴール';
  base.wrap.appendChild(pin);

  el.appendChild(base.wrap);
  const ghere = whereAmI(save);
  const gsame = !!(ghere && ghere.room && g.room && ghere.room === g.room);
  el.appendChild(mapCaption(floor,
    '<strong style="color:#d9600f">オレンジがゴール（' + g.place + '）</strong>です。'
    + floorHint(g, save), gsame ? 'plain' : 'move'));
}

/* 出発前の説明用：1つのルートを全フロア分まとめて描く ------ */

function renderRouteMap(elId, routeKeyName) {
  const el = document.getElementById(elId);
  if (!el) return;
  const route = ROUTES[routeKeyName];
  el.innerHTML = '';

  Object.keys(FLOORS).forEach(function (fkey) {
    const floor = FLOORS[fkey];
    const onThisFloor = route.order
      .map(function (id, i) { return { cp: findCp(id), step: i + 1 }; })
      .filter(function (o) { return o.cp && o.cp.floor === fkey; });
    if (!onThisFloor.length) return;

    const box = document.createElement('div');
    box.className = 'mapfloor';

    const h = document.createElement('h3');
    h.textContent = 'ルート図　' + floor.label;
    box.appendChild(h);

    const base = mapBase(floor);

    onThisFloor.forEach(function (o) {
      if (o.cp.mystery) return;            // ミステリースポットは説明シートにも出さない
      const pin = document.createElement('span');
      pin.className = 'pin target';
      pin.style.left = o.cp.x + '%';
      pin.style.top = o.cp.y + '%';
      // 番号は平面図に書かれている ①②③ とそろえる（順番は下の一覧で示す）
      pin.textContent = o.cp.id;
      pin.title = cpLabel(o.cp.id) + '　' + o.cp.name;
      base.wrap.appendChild(pin);
    });

    if (GAME.goal && GAME.goal.floor === fkey) {
      const gp = document.createElement('span');
      gp.className = 'pin homepin';
      gp.style.left = GAME.goal.x + '%';
      gp.style.top = GAME.goal.y + '%';
      gp.textContent = 'ホーム';
      base.wrap.appendChild(gp);
    }

    box.appendChild(base.wrap);

    const list = document.createElement('p');
    list.className = 'mapcap';
    list.textContent = 'この階のチェックポイント　' + onThisFloor.map(function (o) {
      return cpMark(o.cp.id) + ' ' +
        (o.cp.mystery ? '？？？（ミステリースポット）' : o.cp.name) +
        '（このルートの' + o.step + '番目）';
    }).join('　／　');
    box.appendChild(list);

    el.appendChild(box);
  });
}
