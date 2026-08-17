/* ===========================================================
   fireworks.js  ゴールの花火

   GIF は使いません。理由は3つです。
   ・見栄えのする花火の GIF は 1〜3MB あり、この企画のアプリ全体
     （1人あたり約3MB）と同じくらいの通信量を1枚で使ってしまう
   ・GIF は途中で止められないので、電池を無駄に使う
   ・端末の画面の大きさに合わせられない

   代わりに、その場で点を描いて動かします。追加の通信は 0 バイト、
   ファイルはこの1枚（数KB）だけです。

   使いかた：  startFireworks(canvasElement);
   ・約6秒で自分から止まります（止まったあとは何も描きません）
   ・端末が「動きを減らす」設定のときは、動かさずに1枚だけ描きます
   ・画面を離れると止まり、戻ると再開します
   =========================================================== */

function startFireworks(canvas, options) {
  if (!canvas || !canvas.getContext) return { stop: function () {} };

  const opt = options || {};
  const DURATION = opt.durationMs || 6000;   // 打ち上げをやめるまで
  /* 背景が明るい白なので、白や淡い色は使いません（見えなくなります） */
  const COLORS = opt.colors || ['#ff8a3d', '#f2b705', '#e14b8a', '#3f7fc4', '#2fa76f', '#8a4fe0'];

  const g = canvas.getContext('2d');
  let particles = [];
  let running = true;
  let rafId = 0;
  let lastTime = 0;
  let elapsed = 0;
  let nextShot = 0;
  let W = 0, H = 0;

  /* 画面の大きさに合わせる（細かすぎる解像度は電池の無駄なので2倍まで） */
  function resize() {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const box = canvas.getBoundingClientRect();
    W = Math.max(1, Math.round(box.width));
    H = Math.max(1, Math.round(box.height));
    canvas.width = Math.round(W * ratio);
    canvas.height = Math.round(H * ratio);
    g.setTransform(ratio, 0, 0, ratio, 0, 0);
  }

  /* ひと山ぶんの火花をつくる */
  function burst(cx, cy, color) {
    const n = 34 + Math.floor(Math.random() * 14);
    const power = 1.7 + Math.random() * 1.1;
    for (let i = 0; i < n; i++) {
      // 円形にばらまく。少しゆらぎを入れると花火らしくなります
      const a = (Math.PI * 2 * i) / n + Math.random() * 0.18;
      const v = power * (0.55 + Math.random() * 0.65);
      particles.push({
        x: cx, y: cy,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v,
        life: 1,
        decay: 0.010 + Math.random() * 0.012,
        color: color,
        size: 1.6 + Math.random() * 1.6
      });
    }
  }

  function shoot() {
    const cx = W * (0.15 + Math.random() * 0.7);
    const cy = H * (0.12 + Math.random() * 0.36);   // 画面の上のほうで開かせます
    burst(cx, cy, COLORS[Math.floor(Math.random() * COLORS.length)]);
  }

  function step(now) {
    if (!running) return;
    if (!lastTime) lastTime = now;
    const dt = Math.min(now - lastTime, 50);   // タブが止まっていた分は切り捨てる
    lastTime = now;
    elapsed += dt;
    const k = dt / 16.7;                        // 60分の1秒を1とした進み具合

    // 打ち上げ（だんだん間隔を空けて、静かに終わらせる）
    if (elapsed < DURATION) {
      nextShot -= dt;
      if (nextShot <= 0) {
        shoot();
        if (Math.random() < 0.35) shoot();      // ときどき2発同時
        nextShot = 260 + (elapsed / DURATION) * 700 + Math.random() * 220;
      }
    }

    /* 残像を残します。画面は明るい配色なので、黒を重ねるのではなく
       「少しずつ消していく」やりかたにします（下の文字が暗くなりません）。 */
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = 'rgba(0,0,0,0.20)';
    g.fillRect(0, 0, W, H);

    g.globalCompositeOperation = 'source-over';
    const alive = [];
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.vy += 0.028 * k;          // 重力
      p.vx *= Math.pow(0.985, k); // 空気の抵抗
      p.vy *= Math.pow(0.985, k);
      p.x += p.vx * k;
      p.y += p.vy * k;
      p.life -= p.decay * k;
      if (p.life <= 0) continue;
      // 下の文字が読めるよう、色は少し薄めにします
      g.globalAlpha = Math.max(0, p.life) * 0.7;
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      g.fill();
      alive.push(p);
    }
    particles = alive;
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';

    // 打ち上げが終わり、火花も消えたら止めます（電池を使い続けないため）
    if (elapsed >= DURATION && particles.length === 0) {
      running = false;
      g.clearRect(0, 0, W, H);
      canvas.style.display = 'none';
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisible);
      return;
    }
    rafId = requestAnimationFrame(step);
  }

  function onVisible() {
    if (document.hidden) {
      cancelAnimationFrame(rafId);
      lastTime = 0;
    } else if (running) {
      rafId = requestAnimationFrame(step);
    }
  }

  resize();
  window.addEventListener('resize', resize);

  /* 「動きを減らす」設定の端末では、動かさずに1枚だけ描きます */
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) {
    for (let s = 0; s < 3; s++) {
      const cx = W * (0.25 + s * 0.25);
      const cy = H * (0.3 + (s % 2) * 0.16);
      const color = COLORS[s % COLORS.length];
      for (let i = 0; i < 40; i++) {
        const a = (Math.PI * 2 * i) / 40;
        const r = 26 + (i % 3) * 12;
        g.globalAlpha = 0.85 - (i % 3) * 0.2;
        g.fillStyle = color;
        g.beginPath();
        g.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 2.2, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    return { stop: function () { canvas.style.display = 'none'; } };
  }

  document.addEventListener('visibilitychange', onVisible);
  shoot();
  rafId = requestAnimationFrame(step);

  return {
    stop: function () {
      running = false;
      cancelAnimationFrame(rafId);
      g.clearRect(0, 0, W, H);
      canvas.style.display = 'none';
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisible);
    }
  };
}
