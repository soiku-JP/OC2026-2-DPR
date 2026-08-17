/* ===========================================================
   diag.js  トラブルを画面に出すための仕掛け
   （スマホでは開発者ツールが見られないので、エラーを画面に表示します）
   ※ いちばん最初に読み込んでください
   =========================================================== */

(function () {
  var shown = {};   // 同じ内容を何度も出さない

  function container() {
    var c = document.getElementById('__diag');
    if (c) return c;
    c = document.createElement('div');
    c.id = '__diag';
    c.style.cssText = 'position:fixed;left:0;right:0;top:0;z-index:9999;';
    document.body.appendChild(c);
    return c;
  }

  function banner(title, detail) {
    if (window.__diagOff) return;   // check.html ではエラー表示を止める
    var sig = title + '|' + detail;
    if (shown[sig]) return;
    shown[sig] = true;

    function put() {
      var box = document.createElement('div');
      box.style.cssText =
        'background:#7f1d1d;color:#fff;padding:12px 14px;' +
        'font:14px/1.6 sans-serif;box-shadow:0 2px 10px #0008;border-bottom:1px solid #fff3';
      box.innerHTML =
        '<strong>' + title + '</strong><br>' +
        '<span style="font-size:12px;word-break:break-all">' + detail + '</span>' +
        '<br><a href="check.html" style="color:#ffd166;font-size:12px">ファイル確認ページを開く</a>' +
        '　<button style="padding:4px 10px;border:0;border-radius:6px">閉じる</button>';
      box.querySelector('button').onclick = function () { box.remove(); };
      container().appendChild(box);
    }
    if (document.body) put();
    else document.addEventListener('DOMContentLoaded', put);
  }

  window.addEventListener('error', function (e) {
    // ① ファイルそのものが読み込めなかった場合
    if (e.target && e.target.tagName === 'SCRIPT') {
      banner('ファイルを読み込めませんでした',
        (e.target.getAttribute('src') || '') +
        '<br>zipの中身を直接開いていませんか？ 必ずいったん解凍してから開いてください。');
      return;
    }
    if (e.target && e.target.tagName === 'LINK') {
      banner('css/style.css を読み込めませんでした', 'フォルダの構成が崩れている可能性があります。');
      return;
    }
    if (e.target && e.target.tagName === 'IMG') return;   // 写真の欠けは無視

    // ② プログラムの実行中に起きたエラー
    var d = (e.message || '') + '<br>' + (e.filename || '') + ' ' + (e.lineno || '');
    if (!e.message || e.message === 'Script error.') {
      d = 'js フォルダの中のファイルが読み込めていない可能性があります。';
    }
    banner('うまく起動できませんでした', d);
  }, true);

  window.addEventListener('unhandledrejection', function (e) {
    banner('エラーが発生しました', String(e.reason));
  });

  window.__diagBanner = banner;
})();
