(function () {
  var css = document.createElement('style');
  css.textContent =
    '.kv{display:flex;justify-content:space-between;align-items:baseline;padding:4px 0;font-size:14px}' +
    '.kv b{font-size:16px}.kv.sub{font-size:12px;color:#aaa;padding:1px 0 1px 14px}.kv.mute{color:#888}' +
    '.sep{border-top:1px solid #EEE9DE;margin:8px 0}' +
    '.bar{height:6px;border-radius:3px;background:#EEE9DE;margin:3px 0 8px}.bar i{display:block;height:6px;border-radius:3px;background:var(--sel)}' +
    '.bar.out i{background:#C8C2B4}.mtitle{font-size:16px;font-weight:700;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center}' +
    '.mtitle small{font-size:11px;color:#aaa;font-weight:400}' +
    '.legend{font-size:11px;color:#999;margin-bottom:6px}' +
    '.pager{display:flex;align-items:center;gap:8px;background:#fff;border-radius:14px;padding:6px;margin-bottom:12px;box-shadow:0 1px 2px rgba(0,0,0,.05)}' +
    '.pager button{border:0;background:#ECE8DD;border-radius:10px;width:48px;height:40px;font-size:24px;color:#333;font-family:inherit;flex:none}' +
    '.pager button:disabled{opacity:.3}' +
    '.pager select{flex:1;height:40px;border:1px solid #E6E2D8;border-radius:10px;background:#FAFAF7;font-size:17px;font-weight:700;text-align:center;text-align-last:center;color:#222;font-family:inherit;-webkit-appearance:none;appearance:none}';
  document.head.appendChild(css);

  var app = document.getElementById('app');
  var nav = document.createElement('div');
  nav.className = 'seg'; nav.id = 'view';
  nav.innerHTML = '<button class="on" data-v="0">記帳</button><button data-v="1">月報</button>';
  app.insertBefore(nav, app.firstChild);
  var mv = document.createElement('div');
  mv.className = 'hide'; mv.id = 'monthView';
  app.appendChild(mv);

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function curYM() { var d = new Date(); return d.getFullYear() + '/' + pad(d.getMonth() + 1); }
  function shift(ym, n) { var p = ym.split('/'); var d = new Date(+p[0], +p[1] - 1 + n, 1); return d.getFullYear() + '/' + pad(d.getMonth() + 1); }
  function store(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }

  var YM = curYM();
  var MEM = {};
  var FIRST = store('mFirst') || shift(curYM(), -3);

  function cached(ym) { return MEM[ym] || store('m_' + ym); }
  function save(ym, m) {
    MEM[ym] = m; store('m_' + ym, m);
    if (m.first && m.first !== FIRST) { FIRST = m.first; store('mFirst', FIRST); }
  }
  function fetchMonth(ym, ok, fail) {
    if (!KEY) return fail && fail();
    fetch(API + '?api=month&ym=' + encodeURIComponent(ym) + '&k=' + encodeURIComponent(KEY) + '&t=' + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j.ok) throw new Error(j.error || '發生錯誤'); save(ym, j.data); ok && ok(j.data); })
      .catch(function (e) { fail && fail(e); });
  }

  function show(v) {
    Array.prototype.forEach.call(nav.children, function (b) { b.className = b.getAttribute('data-v') == v ? 'on' : ''; });
    Array.prototype.forEach.call(app.children, function (el) {
      if (el === nav) return;
      if (el === mv) el.className = v == 0 ? 'hide' : '';
      else el.style.display = v == 0 ? '' : 'none';
    });
    if (v != 0) { YM = curYM(); load(YM); }
  }
  nav.onclick = function (e) { var b = e.target.closest('button'); if (b) show(b.getAttribute('data-v')); };

  function pager() {
    var now = curYM(), opts = '', y = now, first = FIRST < now ? FIRST : now;
    if (YM < first) first = YM;
    while (y >= first) {
      var lab = y + (y === now ? '（本月）' : y === shift(now, -1) ? '（上月）' : '');
      opts += '<option value="' + y + '"' + (y === YM ? ' selected' : '') + '>' + lab + '</option>';
      y = shift(y, -1);
    }
    return '<div class="pager"><button data-d="-1">‹</button><select id="ymSel">' + opts + '</select>' +
      '<button data-d="1"' + (YM >= now ? ' disabled' : '') + '>›</button></div>';
  }
  mv.onclick = function (e) {
    var b = e.target.closest('.pager button'); if (!b || b.disabled) return;
    var n = shift(YM, Number(b.getAttribute('data-d'))); if (n > curYM()) return;
    YM = n; load(YM);
  };
  mv.onchange = function (e) { if (e.target.id === 'ymSel') { YM = e.target.value; load(YM); } };

  function load(ym) {
    var c = cached(ym);
    if (c) render(c, true); else mv.innerHTML = pager() + '<div class="load">載入中…</div>';
    fetchMonth(ym, function (m) {
      if (ym === YM) render(m, false);
      var prev = shift(ym, -1);
      if (prev >= FIRST && !MEM[prev]) fetchMonth(prev);
    }, function (e) {
      if (ym !== YM) return;
      if (c) render(c, false, true); else { mv.innerHTML = pager(); toast((e && e.message) || '連線失敗', true); }
    });
  }

  function m$(n) { return (n < 0 ? '-' : '') + fmt(n, 'TWD'); }
  function kv(k, v, cls, vcol) {
    return '<div class="kv ' + (cls || '') + '"><span>' + k + '</span><span' + (vcol ? ' style="color:' + vcol + '"' : '') + '>' + v + '</span></div>';
  }

  function render(m, updating, offline) {
    var isNow = m.ym === curYM();
    var tag = updating ? '更新中…' : offline ? '離線資料' : '';
    var h = pager() + '<div class="card"><div class="mtitle"><span>📊 ' + esc(m.ym) + ' 收支</span><small>' + tag + '</small></div>';
    h += kv('實際總花費', '<b>' + m$(m.total) + '</b>');
    if (m.outCats.length) {
      h += kv('－ 不計入每月可花', m$(m.outBudget), 'mute');
      m.outCats.forEach(function (c) { h += kv(esc(c.name), m$(c.amount), 'sub'); });
    }
    h += '<div class="sep"></div>' + kv('計入每月可花', '<b>' + m$(m.inBudget) + '</b>');
    if (m.target > 0 && m.items.length) {
      var left = m.target - m.inBudget;
      h += kv('目標', m$(m.target), 'mute');
      h += kv(left >= 0 ? (isNow ? '還能花' : '省下') : '超支', '<b>' + m$(Math.abs(left)) + '</b>', '', left >= 0 ? 'var(--green)' : 'var(--red)');
    }
    var bal = m.income - m.total;
    h += '<div class="sep"></div>' + kv('收入', m$(m.income), '', 'var(--blue)');
    h += kv('結餘（收入－實際總花費）', m$(bal), '', bal >= 0 ? 'var(--green)' : 'var(--red)') + '</div>';

    if (m.cats.length) {
      h += '<div class="card"><div class="lbl"><b>支出分類</b><span>灰＝不計入</span></div>';
      m.cats.forEach(function (c) {
        var p = m.total > 0 ? Math.max(0, Math.round(c.amount / m.total * 100)) : 0;
        h += kv(esc(c.name) + (c.out ? '（不計）' : ''), m$(c.amount) + '　' + p + '%', c.out ? 'mute' : '');
        h += '<div class="bar' + (c.out ? ' out' : '') + '"><i style="width:' + Math.min(100, p) + '%"></i></div>';
      });
      h += '</div>';
    }

    h += '<div class="card"><div class="lbl"><b>明細（' + m.items.length + ' 筆，最新在前）</b></div>' +
      '<div class="legend">藍＝收入　綠＝退款　紅＝單筆≥1,000　灰＝不計入</div>';
    if (!m.items.length) h += '<div style="color:#aaa;font-size:13px">這個月還沒有記錄</div>';
    m.items.forEach(function (r) {
      var inc = r.type === '收入', ref = !inc && r.amount < 0, big = !inc && !ref && Math.abs(r.base) >= 1000;
      var col = inc ? 'var(--blue)' : ref ? 'var(--green)' : big ? 'var(--red)' : r.out ? '#aaa' : '#222';
      var name = (inc ? '💰 ' : ref ? '↩ 退款・' : '') + r.cat + (r.out ? '（不計）' : '');
      var note = r.note && !/^退款／/.test(r.note) ? r.note : '';
      h += '<div class="rec"' + (r.out ? ' style="color:#aaa"' : '') + '><div class="d">' + esc(r.date.slice(5)) + '</div>' +
        '<div class="n">' + esc(name) + (note ? '<i>' + esc(note) + '</i>' : '') + '<i>' + esc(r.from) + (r.who ? '・' + esc(r.who) : '') + '</i></div>' +
        '<div class="a" style="color:' + col + '">' + (inc || ref ? '+' : '-') + fmt(r.amount, r.cur) + '</div></div>';
    });
    h += '</div>';
    mv.innerHTML = h;
  }

  // 開 App 後先在背景抓好本月，點「月報」時就能馬上顯示
  setTimeout(function () { fetchMonth(curYM()); }, 2500);
})();
