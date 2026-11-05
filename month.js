(function () {
  var css = document.createElement('style');
  css.textContent =
    '.kv{display:flex;justify-content:space-between;align-items:baseline;padding:4px 0;font-size:14px}' +
    '.kv b{font-size:16px}.kv.sub{font-size:12px;color:#aaa;padding:1px 0 1px 14px}.kv.mute{color:#888}' +
    '.sep{border-top:1px solid #EEE9DE;margin:8px 0}' +
    '.bar{height:6px;border-radius:3px;background:#EEE9DE;margin:3px 0 8px}.bar i{display:block;height:6px;border-radius:3px;background:var(--sel)}' +
    '.bar.out i{background:#C8C2B4}.mtitle{font-size:16px;font-weight:700;margin-bottom:6px}' +
    '.legend{font-size:11px;color:#999;margin-bottom:6px}' +
    '.pager{display:flex;align-items:center;justify-content:space-between;background:#fff;border-radius:14px;padding:6px;margin-bottom:12px;box-shadow:0 1px 2px rgba(0,0,0,.05)}' +
    '.pager button{border:0;background:#ECE8DD;border-radius:10px;width:48px;height:40px;font-size:24px;color:#333;font-family:inherit}' +
    '.pager button:disabled{opacity:.3}.pager span{font-size:17px;font-weight:700}' +
    '.pager small{font-size:11px;color:#888;font-weight:400;margin-left:6px}';
  document.head.appendChild(css);

  var app = document.getElementById('app');
  var nav = document.createElement('div');
  nav.className = 'seg'; nav.id = 'view';
  nav.innerHTML = '<button class="on" data-v="0">記帳</button><button data-v="1">月報</button>';
  var OFF = 0;
  app.insertBefore(nav, app.firstChild);
  var mv = document.createElement('div');
  mv.className = 'hide'; mv.id = 'monthView';
  app.appendChild(mv);

  function show(v) {
    Array.prototype.forEach.call(nav.children, function (b) { b.className = b.getAttribute('data-v') == v ? 'on' : ''; });
    Array.prototype.forEach.call(app.children, function (el) {
      if (el === nav) return;
      if (el === mv) el.className = v == 0 ? 'hide' : '';
      else el.style.display = v == 0 ? '' : 'none';
    });
    if (v != 0) { OFF = 0; load(OFF); }
  }
  nav.onclick = function (e) { var b = e.target.closest('button'); if (b) show(b.getAttribute('data-v')); };

  function m$(n) { return (n < 0 ? '-' : '') + fmt(n, 'TWD'); }
  function kv(k, v, cls, vcol) {
    return '<div class="kv ' + (cls || '') + '"><span>' + k + '</span><span' + (vcol ? ' style="color:' + vcol + '"' : '') + '>' + v + '</span></div>';
  }

  function ymOf(off) {
    var d = new Date(); d = new Date(d.getFullYear(), d.getMonth() + off, 1);
    var mm = d.getMonth() + 1; return d.getFullYear() + '/' + (mm < 10 ? '0' : '') + mm;
  }
  function pager(off) {
    return '<div class="pager"><button data-d="-1">‹</button><span>' + ymOf(off) +
      (off === 0 ? '<small>本月</small>' : off === -1 ? '<small>上月</small>' : '') +
      '</span><button data-d="1"' + (off >= 0 ? ' disabled' : '') + '>›</button></div>';
  }
  mv.onclick = function (e) {
    var b = e.target.closest('.pager button'); if (!b || b.disabled) return;
    OFF = Math.min(0, OFF + Number(b.getAttribute('data-d'))); load(OFF);
  };

  function load(off) {
    mv.innerHTML = pager(off) + '<div class="load">載入中…</div>';
    api({ api: 'month', off: off }, function (m) { if (off === OFF) render(m, off); }, function () { mv.innerHTML = pager(off); });
  }

  function render(m, off) {
    var h = pager(off) + '<div class="card"><div class="mtitle">📊 ' + esc(m.ym) + ' 收支</div>';
    h += kv('實際總花費', '<b>' + m$(m.total) + '</b>');
    if (m.outCats.length) {
      h += kv('－ 不計入每月可花', m$(m.outBudget), 'mute');
      m.outCats.forEach(function (c) { h += kv(esc(c.name), m$(c.amount), 'sub'); });
    }
    h += '<div class="sep"></div>' + kv('計入每月可花', '<b>' + m$(m.inBudget) + '</b>');
    if (m.target > 0) {
      var left = m.target - m.inBudget;
      h += kv('目標', m$(m.target), 'mute');
      h += kv(left >= 0 ? (off === 0 ? '還能花' : '省下') : '超支', '<b>' + m$(Math.abs(left)) + '</b>', '', left >= 0 ? 'var(--green)' : 'var(--red)');
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
})();
