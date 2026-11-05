(function () {
  var nav = document.getElementById('view');
  var app = document.getElementById('app');
  var mv = document.getElementById('monthView');
  if (!nav || !app) return;

  var css = document.createElement('style');
  css.textContent =
    '.bsum{display:flex;gap:8px;margin-top:10px}.bsum div{flex:1;background:#F6F4EE;border-radius:10px;padding:8px 10px}' +
    '.bsum small{display:block;font-size:11px;color:#888}.bsum b{font-size:15px}' +
    '.bnet{font-size:30px;font-weight:800;line-height:1.2}' +
    '.brow{display:flex;justify-content:space-between;align-items:baseline;padding:7px 0;border-bottom:1px solid #F0EDE5;font-size:14px}' +
    '.brow:last-child{border-bottom:0}.brow i{font-style:normal;font-size:11px;color:#999;margin-left:6px}' +
    '.brow .z{color:#bbb}.bgrp{font-size:12px;color:#888;margin:10px 0 2px;font-weight:700}';
  document.head.appendChild(css);

  var btn = document.createElement('button');
  btn.textContent = '帳戶'; btn.setAttribute('data-v', 'b');
  nav.appendChild(btn);
  var bv = document.createElement('div');
  bv.className = 'hide'; bv.id = 'balView';
  app.appendChild(bv);

  var OWNER = '全部', DATA = null;
  try { DATA = JSON.parse(localStorage.getItem('balCache') || 'null'); } catch (e) {}

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    Array.prototype.forEach.call(nav.children, function (b) { b.className = b === btn ? 'on' : ''; });
    Array.prototype.forEach.call(app.children, function (el) {
      if (el === nav || el === bv) return;
      if (el === mv) el.className = 'hide'; else el.style.display = 'none';
    });
    bv.className = '';
    load();
  });
  nav.addEventListener('click', function (e) {
    if (e.target.closest('button') !== btn) { bv.className = 'hide'; btn.className = ''; }
  });

  function fetchBal(ok, fail) {
    if (!KEY) return fail && fail();
    fetch(API + '?api=bal&k=' + encodeURIComponent(KEY) + '&t=' + Date.now())
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.ok) throw new Error(j.error || '發生錯誤');
        DATA = j.data; try { localStorage.setItem('balCache', JSON.stringify(DATA)); } catch (e) {}
        ok && ok();
      })
      .catch(function (e) { fail && fail(e); });
  }
  function load() {
    if (DATA) render(true); else bv.innerHTML = '<div class="load">載入中…</div>';
    fetchBal(function () { if (bv.className !== 'hide') render(false); },
      function (e) { if (DATA) render(false, true); else { bv.innerHTML = ''; toast((e && e.message) || '連線失敗', true); } });
  }

  var DEBT = { '信用卡': 1, '負債': 1 };
  var TORDER = ['現金', '電子支付', '銀行', '儲蓄', '投資', '其他', '信用卡', '負債'];
  function sym2(c) { return (DATA.symbols && DATA.symbols[c]) || (c + ' '); }
  function money(n, c) {
    var dec = (c === 'TWD' || c === 'JPY' || c === 'KRW') ? 0 : 2;
    var v = Math.abs(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    return (n < 0 ? '-' : '') + sym2(c) + v;
  }
  function twd(n) { return money(Math.round(n), 'TWD'); }

  function render(updating, offline) {
    var accs = DATA.accounts;
    var owners = [];
    accs.forEach(function (a) { if (owners.indexOf(a.owner) < 0) owners.push(a.owner); });
    owners.sort(function (a, b) { return (a === '共同') - (b === '共同'); });
    if (OWNER !== '全部' && owners.indexOf(OWNER) < 0) OWNER = '全部';
    var tabs = ['全部'].concat(owners);
    var list = accs.filter(function (a) { return OWNER === '全部' || a.owner === OWNER; });

    var asset = 0, debt = 0;
    list.forEach(function (a) { if (DEBT[a.type]) debt += a.base; else asset += a.base; });
    var net = asset + debt;
    var tag = updating ? '更新中…' : offline ? '離線資料' : ('更新於 ' + DATA.at);

    var h = '<div class="seg" id="ownSeg">' + tabs.map(function (t) {
      return '<button class="' + (t === OWNER ? 'on' : '') + '" data-o="' + esc(t) + '">' + esc(t) + '</button>';
    }).join('') + '</div>';

    h += '<div class="card"><div class="lbl"><b>' + (OWNER === '全部' ? '全家' : esc(OWNER)) + ' 淨資產（換算台幣）</b><span>' + tag + '</span></div>' +
      '<div class="bnet" style="color:' + (net >= 0 ? 'var(--sel)' : 'var(--red)') + '">' + twd(net) + '</div>' +
      '<div class="bsum"><div><small>資產</small><b>' + twd(asset) + '</b></div>' +
      '<div><small>負債（卡費待繳）</small><b style="color:' + (debt < 0 ? 'var(--red)' : 'inherit') + '">' + twd(debt) + '</b></div></div></div>';

    if (OWNER === '全部' && owners.length > 1) {
      h += '<div class="card"><div class="lbl"><b>各自淨資產</b></div>';
      owners.forEach(function (o) {
        var s = 0; accs.forEach(function (a) { if (a.owner === o) s += a.base; });
        h += '<div class="brow"><span>' + esc(o) + '</span><b style="color:' + (s >= 0 ? 'inherit' : 'var(--red)') + '">' + twd(s) + '</b></div>';
      });
      h += '</div>';
    }

    var groups = OWNER === '全部' ? owners : [OWNER];
    groups.forEach(function (o) {
      var mine = list.filter(function (a) { return a.owner === o; });
      if (!mine.length) return;
      mine.sort(function (a, b) {
        var ia = TORDER.indexOf(a.type), ib = TORDER.indexOf(b.type); if (ia < 0) ia = 5; if (ib < 0) ib = 5;
        return ia - ib;
      });
      h += '<div class="card"><div class="lbl"><b>' + esc(o) + ' 的帳戶</b><span>' + mine.length + ' 個</span></div>';
      var lastType = '';
      mine.forEach(function (a) {
        if (a.type !== lastType) { h += '<div class="bgrp">' + esc(a.type) + '</div>'; lastType = a.type; }
        var zero = Math.abs(a.balance) < 0.005, isDebt = !!DEBT[a.type];
        var col = zero ? '#bbb' : a.balance < 0 ? 'var(--red)' : '#222';
        var val = isDebt && a.balance < 0 ? '待繳 ' + money(-a.balance, a.currency) : money(a.balance, a.currency);
        var conv = (a.currency !== 'TWD' && !zero) ? '<i>≈' + twd(a.base) + '</i>' : '';
        h += '<div class="brow"><span' + (zero ? ' class="z"' : '') + '>' + esc(a.name) + '</span><span><b style="color:' + col + '">' + val + '</b>' + conv + '</span></div>';
      });
      h += '</div>';
    });

    bv.innerHTML = h;
    Array.prototype.forEach.call(bv.querySelectorAll('#ownSeg button'), function (b) {
      b.onclick = function () { OWNER = b.getAttribute('data-o'); render(false); };
    });
  }

  setTimeout(function () { fetchBal(); }, 3500);
})();
