/* 主程式：題目、自由練習、成績總表、出題管理 */
(function (G) {
'use strict';
const AJ = G.AJ;
const esc = AJ.esc;
const LS = AJ.LS;
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }

const I = {
  play: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3l8 5-8 5z" fill="currentColor"/></svg>',
  stop: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor"/></svg>',
  check: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3.2 3.2L13 4.8" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  reset: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8a4.5 4.5 0 1 0 1.3-3.2M3.5 2.5v3h3" stroke="currentColor" stroke-width="1.6" fill="none" stroke-linecap="round"/></svg>',
  sound: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6h2.5l3-3v10l-3-3H2.5z" fill="currentColor"/><path d="M10.5 5.5a3.5 3.5 0 0 1 0 5" stroke="currentColor" stroke-width="1.5" fill="none"/></svg>',
  plus: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  list: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 4h10M3 8h10M3 12h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  left: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3L5 8l5 5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
  right: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round"/></svg>',
};
const LOGO = `<svg viewBox="0 0 34 34" aria-hidden="true"><rect x="1" y="5" width="32" height="24" rx="5" fill="var(--pcb)"/>
  <g fill="#1b1f22"><rect x="7" y="2" width="3" height="5"/><rect x="12" y="2" width="3" height="5"/><rect x="17" y="2" width="3" height="5"/><rect x="22" y="2" width="3" height="5"/>
  <rect x="7" y="27" width="3" height="5"/><rect x="12" y="27" width="3" height="5"/><rect x="17" y="27" width="3" height="5"/><rect x="22" y="27" width="3" height="5"/></g>
  <path d="M10 17.5l4.5 4.5L24 12" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function toast(msg, ms) {
  const t = h(`<div class="toast" role="status"></div>`);
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), ms || 2600);
}
function md(text) {
  const inline = s => esc(s).replace(/`([^`]+)`/g, '<code>$1</code>').replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
  return String(text || '').replace(/\r/g, '').split(/\n{2,}/).map(b => {
    const lines = b.split('\n');
    if (lines.every(l => /^\s*[-*]\s+/.test(l))) return '<ul>' + lines.map(l => `<li>${inline(l.replace(/^\s*[-*]\s+/, ''))}</li>`).join('') + '</ul>';
    return `<p>${lines.map(inline).join('<br>')}</p>`;
  }).join('');
}
function openDialog(inner, wide) {
  const ov = h(`<div class="overlay"><div class="dialog${wide ? ' wide' : ''}" role="dialog" aria-modal="true">${inner}</div></div>`);
  document.body.appendChild(ov);
  const prev = document.activeElement;
  const close = () => { ov.remove(); document.removeEventListener('keydown', onKey); if (prev && prev.focus) prev.focus(); };
  const onKey = e => { if (e.key === 'Escape') { close(); if (ov.onclose) ov.onclose(); } };
  document.addEventListener('keydown', onKey);
  ov.addEventListener('mousedown', e => { if (e.target === ov) { close(); if (ov.onclose) ov.onclose(); } });
  setTimeout(() => { const f = ov.querySelector('input, select, textarea, button'); if (f) f.focus(); }, 0);
  return { el: ov, close };
}
async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast('已複製到剪貼簿'); }
  catch (e) {
    const d = openDialog(`<div class="card-h"><h2>請手動複製</h2></div><div class="card-b"><textarea rows="12" style="width:100%" id="copy-ta"></textarea><div class="row"><span class="spacer"></span><button class="btn primary" data-x>關閉</button></div></div>`, true);
    const ta = $('#copy-ta', d.el); ta.value = text; ta.select();
    $('[data-x]', d.el).addEventListener('click', d.close);
  }
}
const fmtTime = at => { try { return new Date(at).toLocaleString('zh-TW', { hour12: false }); } catch (e) { return String(at); } };
const vchip = (v, extra) => `<span class="vchip v-${esc(v)}">${esc(v)}</span>${extra || ''}`;
const stars = n => '★'.repeat(n || 1) + '☆'.repeat(Math.max(0, 4 - (n || 1)));

/* ================================================================ 狀態 */
const S = {
  store: null, view: 'problems', pid: null,
  builtin: AJ.BUILTIN_PROBLEMS, custom: [], problems: [],
  mine: {}, profile: null, expected: new Map(), all: [], judging: false,
};
function rebuildProblems() {
  const custom = (S.custom || []).slice().sort((a, b) => (a.created || 0) - (b.created || 0));
  S.problems = S.builtin.map(p => Object.assign({ builtin: true }, p)).concat(custom);
}
const problemById = id => S.problems.find(p => p.id === id);
function getExpected(p) {
  if (p.expected) return Promise.resolve(p.expected);
  if (S.expected.has(p.id)) return S.expected.get(p.id);
  const pr = new Promise((res, rej) => setTimeout(() => {
    try { res(AJ.Judge.computeExpected(p, p.solution)); } catch (e) { rej(e); }
  }, 0));
  S.expected.set(p.id, pr);
  return pr;
}

/* ================================================================ 外殼 */
function shell() {
  const app = $('#app');
  app.innerHTML = `
  <header class="top">
    <div class="brand">${LOGO}<div><b>Arduino 練習場</b><small>模擬・判題</small></div></div>
    <nav class="tabs" role="tablist" aria-label="功能">
      <button class="tab" role="tab" data-view="problems">題目</button>
      <button class="tab" role="tab" data-view="play">自由練習</button>
      <button class="tab" role="tab" data-view="grades" hidden>成績總表</button>
      <button class="tab" role="tab" data-view="author" hidden>出題管理</button>
    </nav>
    <div class="top-right">
      <span class="chip" id="store-chip" title=""><span class="dot"></span><span>連線中…</span></span>
      <button class="chip" id="who" type="button">設定身分</button>
    </div>
  </header>
  <main>
    <section id="v-problems"></section>
    <section id="v-play" hidden></section>
    <section id="v-grades" hidden></section>
    <section id="v-author" hidden></section>
  </main>`;
  $$('.tab').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  $('#who').addEventListener('click', () => profileDialog());
}
function setView(v) {
  if (S.view === v && S.viewInit) return;
  S.viewInit = true;
  S.view = v;
  LS.set('aj.view', v);
  $$('.tab').forEach(b => b.setAttribute('aria-selected', b.dataset.view === v ? 'true' : 'false'));
  ['problems', 'play', 'grades', 'author'].forEach(k => { $('#v-' + k).hidden = k !== v; });
  if (v !== 'problems' && PV.lab) PV.lab.stop();
  if (v !== 'play' && PL.lab) PL.lab.stop();
  if (v === 'play') PL.init();
  if (v === 'grades') GV.render();
  if (v === 'author') AV.render();
}
function updateChrome() {
  const st = S.store;
  const chip = $('#store-chip');
  if (st) {
    chip.className = 'chip ' + (st.mode === 'local' || st.error || !st.canSubmit ? 'warn' : 'ok');
    chip.lastElementChild.textContent = st.error ? '連線失敗' : st.label;
    chip.title = st.error || st.detail;
  }
  const teacherTabs = st && (st.isTeacher || st.mode === 'sheet');
  $$('.tab[data-view="grades"], .tab[data-view="author"]').forEach(b => { b.hidden = !teacherTabs; });
  const p = S.profile;
  $('#who').textContent = p && (p.name || p.seat) ? `${p.cls || ''}${p.cls && p.seat ? '・' : ''}${p.seat ? p.seat + ' 號' : ''} ${p.name || ''}`.trim() : '設定身分';
}
function profileDialog() {
  return new Promise(resolve => {
    const p = S.profile || {};
    const d = openDialog(`<div class="card-h"><h2 id="pf-t">填寫你的資料</h2></div>
      <form class="card-b" id="pf-form" aria-labelledby="pf-t">
        <p class="hint" style="margin:0">送出判題時，成績會用這些資料記錄，老師才知道是誰。</p>
        <div class="row"><div class="field"><label for="pf-cls">班級</label><input id="pf-cls" required placeholder="例如 301" value="${esc(p.cls || '')}"></div>
        <div class="field"><label for="pf-seat">座號</label><input id="pf-seat" required inputmode="numeric" value="${esc(p.seat || '')}"></div></div>
        <div class="field"><label for="pf-name">姓名</label><input id="pf-name" required value="${esc(p.name || (S.store && S.store.defaultName) || '')}"></div>
        <div class="row"><span class="spacer"></span><button type="button" class="btn" data-x>取消</button><button class="btn primary" type="submit">儲存</button></div>
      </form>`);
    d.el.onclose = () => resolve(null);
    $('[data-x]', d.el).addEventListener('click', () => { d.close(); resolve(null); });
    $('#pf-form', d.el).addEventListener('submit', async e => {
      e.preventDefault();
      const np = { cls: $('#pf-cls', d.el).value.trim(), seat: $('#pf-seat', d.el).value.trim(), name: $('#pf-name', d.el).value.trim() };
      S.profile = np;
      d.close();
      updateChrome();
      try { if (S.store) await S.store.setProfile(np); } catch (err) { toast('資料儲存失敗：' + err.message); }
      resolve(np);
    });
  });
}

/* ================================================================ 實驗室（編輯器＋模擬） */
function createLab(host, opts) {
  host.innerHTML = `<div class="workspace">
    <div class="col">
      <div class="lab-top"></div>
      <section class="card">
        <div class="card-h"><h2>程式碼</h2><span class="hint">Ctrl+Enter 執行</span><span class="spacer"></span>
          <button class="btn small" data-act="reset">${I.reset}還原範本</button>
          <button class="btn primary" data-act="run">${I.play}執行模擬</button>
          <button class="btn" data-act="stop" disabled>${I.stop}停止</button>
          ${opts.judge ? `<button class="btn go" data-act="submit">${I.check}送出判題</button>` : ''}
        </div>
        <div class="ed-host"></div>
        <div class="msgbar" hidden></div>
      </section>
    </div>
    <div class="col">
      <section class="card">
        <div class="card-h"><h2>電路模擬</h2><span class="clock" data-clock>停止中</span><span class="spacer"></span>
          ${opts.editable ? `<button class="btn small" data-act="add">${I.plus}新增元件</button>` : ''}
          <button class="btn small" data-act="sound" aria-pressed="false">${I.sound}<span>聲音：關</span></button>
        </div>
        <div class="bench-host"></div>
      </section>
      <section class="card">
        <div class="card-h"><h3>序列埠監控視窗</h3><span class="clock" data-baud></span><span class="spacer"></span><button class="btn small" data-act="clear">清除</button></div>
        <pre class="serial-out" tabindex="0" aria-label="序列埠輸出"></pre>
        <form class="serial-in"><input id="${opts.id}-sin" placeholder="輸入要傳給 Arduino 的文字" aria-label="序列埠輸入" autocomplete="off">
          <select id="${opts.id}-eol" aria-label="行尾字元"><option value="nl">換行 (NL)</option><option value="none">沒有行尾</option><option value="crlf">NL 與 CR</option></select>
          <button class="btn small" type="submit">傳送</button></form>
      </section>
      ${opts.judge ? '<section class="card res-card" hidden></section>' : ''}
    </div></div>`;
  const q = s => $(s, host);
  const lab = { opts, circuit: [], serialBuf: '', serialText: '' };
  const btn = a => q(`[data-act="${a}"]`);
  const msgbar = q('.msgbar');
  const out = q('.serial-out');
  lab.top = q('.lab-top');
  lab.resCard = q('.res-card');
  lab.editor = new AJ.Editor(q('.ed-host'), {
    id: opts.id + '-code',
    onChange: v => opts.onCode && opts.onCode(v),
    onRun: shift => { if (shift && opts.judge) opts.onSubmit(); else lab.run(); },
  });
  lab.bench = new AJ.Bench(q('.bench-host'), {
    editable: opts.editable,
    onInput: (id, patch) => lab.runner.input(id, patch),
    onRemove: id => opts.onRemove && opts.onRemove(id),
    emptyText: opts.editable ? '還沒有元件，按「新增元件」加入' : undefined,
  });
  const flushSerial = () => {
    if (!lab.serialBuf) return;
    lab.serialText = (lab.serialText + lab.serialBuf.replace(/\r\n/g, '\n').replace(/\r/g, '')).slice(-20000);
    lab.serialBuf = '';
    const atBottom = out.scrollTop + out.clientHeight >= out.scrollHeight - 30;
    out.textContent = lab.serialText;
    if (atBottom) out.scrollTop = out.scrollHeight;
  };
  lab.runner = new AJ.SimRunner(lab.bench, {
    onSerial: t => { lab.serialBuf += t; },
    onWarn: list => lab.bench.setWarnings(list.slice(-4), line => lab.editor.goto(line)),
    onTick: t => {
      flushSerial();
      q('[data-clock]').textContent = `t = ${(t / 1e6).toFixed(3)} s`;
      const M = lab.runner.M;
      q('[data-baud]').textContent = M && M.serial.begun ? `${M.serial.baud} baud` : '尚未 Serial.begin';
    },
    onError: err => {
      flushSerial();
      lab.bench.setError(`${AJ.Judge.VERDICT[err.kind] ? AJ.Judge.VERDICT[err.kind].name : '錯誤'}（第 ${err.line} 行）：${err.message}`);
      lab.editor.setError(err.line);
      setRunning(false);
    },
  });
  const setRunning = on => {
    btn('run').disabled = false;
    btn('run').innerHTML = on ? `${I.reset}重新執行` : `${I.play}執行模擬`;
    btn('stop').disabled = !on;
    if (!on) q('[data-clock]').textContent = '停止中';
  };
  lab.showMsg = (kind, title, text, line) => {
    msgbar.hidden = false;
    msgbar.className = 'msgbar ' + kind;
    msgbar.innerHTML = `<span class="k">${esc(title)}</span><span>${line ? `<button class="btn small" data-goto>第 ${line} 行</button> ` : ''}${esc(text)}</span>`;
    const g = $('[data-goto]', msgbar);
    if (g) g.addEventListener('click', () => lab.editor.goto(line));
  };
  lab.hideMsg = () => { msgbar.hidden = true; };
  lab.showCE = e => { lab.editor.setError(e.line); lab.showMsg('err', '編譯錯誤', e.message, e.line); };
  lab.run = () => {
    lab.hideMsg(); lab.editor.setError(0); lab.bench.setError(null); lab.bench.setWarnings([]);
    lab.serialText = ''; lab.serialBuf = ''; out.textContent = '';
    const r = lab.runner.start(lab.editor.value, lab.circuit);
    if (r.ce) { lab.showCE(r.ce); setRunning(false); return false; }
    setRunning(true);
    return true;
  };
  lab.stop = () => { lab.runner.stop(); setRunning(false); };
  lab.setCircuit = c => { lab.circuit = c || []; lab.stop(); lab.bench.setCircuit(lab.circuit); };
  btn('run').addEventListener('click', () => lab.run());
  btn('stop').addEventListener('click', () => lab.stop());
  btn('reset').addEventListener('click', () => opts.onReset && opts.onReset());
  if (opts.judge) btn('submit').addEventListener('click', () => opts.onSubmit());
  if (opts.editable) btn('add').addEventListener('click', () => opts.onAdd && opts.onAdd());
  btn('clear').addEventListener('click', () => { lab.serialText = ''; out.textContent = ''; });
  btn('sound').addEventListener('click', () => {
    const on = btn('sound').getAttribute('aria-pressed') !== 'true';
    btn('sound').setAttribute('aria-pressed', on);
    btn('sound').lastElementChild.textContent = on ? '聲音：開' : '聲音：關';
    lab.bench.enableSound(on);
  });
  q('.serial-in').addEventListener('submit', e => {
    e.preventDefault();
    const inp = q('.serial-in input');
    if (!lab.runner.running) { toast('請先按「執行模擬」'); return; }
    const eol = { nl: '\n', none: '', crlf: '\r\n' }[q('.serial-in select').value];
    lab.runner.send(inp.value + eol);
    inp.value = '';
  });
  return lab;
}

/* ================================================================ 題目頁 */
const PV = {
  init() {
    const host = $('#v-problems');
    this.lab = createLab(host, {
      id: 'pv', judge: true,
      onCode: v => { if (S.pid) LS.set('aj.code.' + S.pid, v); },
      onReset: () => this.resetCode(),
      onSubmit: () => this.submit(),
    });
    this.lab.top.innerHTML = `<section class="card">
      <div class="card-h"><div class="picker"><button class="btn" data-pick aria-expanded="false">${I.list}<span>題目列表</span></button><div class="picker-list" hidden></div></div>
        <button class="btn small" data-prev aria-label="上一題">${I.left}</button><button class="btn small" data-next aria-label="下一題">${I.right}</button>
        <span class="spacer"></span><span data-mystatus></span>
        <button class="collapser" data-collapse aria-expanded="true">收合</button></div>
      <div class="card-b" data-stmt></div></section>`;
    const top = this.lab.top;
    const pick = $('[data-pick]', top), list = $('.picker-list', top);
    pick.addEventListener('click', () => {
      const open = list.hidden;
      list.hidden = !open; pick.setAttribute('aria-expanded', open);
      if (open) this.renderPicker();
    });
    document.addEventListener('mousedown', e => { if (!list.hidden && !e.target.closest('.picker')) { list.hidden = true; pick.setAttribute('aria-expanded', 'false'); } });
    $('[data-prev]', top).addEventListener('click', () => this.step(-1));
    $('[data-next]', top).addEventListener('click', () => this.step(1));
    $('[data-collapse]', top).addEventListener('click', e => {
      const b = $('[data-stmt]', top);
      b.hidden = !b.hidden;
      e.target.textContent = b.hidden ? '展開題目' : '收合';
      e.target.setAttribute('aria-expanded', !b.hidden);
    });
  },
  step(d) {
    const i = S.problems.findIndex(p => p.id === S.pid);
    const n = S.problems[(i + d + S.problems.length) % S.problems.length];
    if (n) this.open(n.id);
  },
  statusChip(pid) {
    const r = S.mine[pid];
    if (!r || !r.best) return '';
    return r.best.verdict === 'AC' ? vchip('AC') : vchip(r.best.verdict, ` <span class="muted" style="font-size:12px">${r.best.score} 分</span>`);
  },
  renderPicker() {
    const list = $('.picker-list', this.lab.top);
    const row = (p, i) => `<button class="prow" data-id="${esc(p.id)}" ${p.id === S.pid ? 'aria-current="true"' : ''}><span class="no">${String(i + 1).padStart(2, '0')}</span><span class="tt">${esc(p.title)} <span class="level">${stars(p.level)}</span></span><span>${this.statusChip(p.id)}</span></button>`;
    let html = '';
    const LN = AJ.LEVEL_NAMES || {};
    S.problems.forEach((p, i) => {
      const prev = S.problems[i - 1];
      if (p.builtin && (!prev || prev.level !== p.level)) html += `<div class="group-label">${esc(LN[p.level] || '')} ${stars(p.level)}</div>`;
      if (!p.builtin && (!prev || prev.builtin)) html += '<div class="group-label">老師出的題目</div>';
      html += row(p, i);
    });
    list.innerHTML = html;
    $$('.prow', list).forEach(b => b.addEventListener('click', () => { list.hidden = true; this.open(b.dataset.id); }));
  },
  resetCode() {
    const p = problemById(S.pid);
    if (!p) return;
    if (this.confirmReset) {
      clearTimeout(this.confirmReset); this.confirmReset = null;
      this.lab.editor.value = p.starter || AJ.STARTER;
      LS.set('aj.code.' + p.id, this.lab.editor.value);
      $('[data-act="reset"]', $('#v-problems')).innerHTML = `${I.reset}還原範本`;
      return;
    }
    const b = $('[data-act="reset"]', $('#v-problems'));
    b.textContent = '確定清除程式？';
    this.confirmReset = setTimeout(() => { this.confirmReset = null; b.innerHTML = `${I.reset}還原範本`; }, 3000);
  },
  open(id) {
    const p = problemById(id) || S.problems[0];
    if (!p) return;
    S.pid = p.id;
    LS.set('aj.pid', p.id);
    this.lab.setCircuit(p.circuit);
    this.lab.editor.value = LS.get('aj.code.' + p.id, null) || p.starter || AJ.STARTER;
    this.lab.hideMsg();
    this.lab.resCard.hidden = true;
    this.renderStatement(p);
  },
  refreshStatus() {
    $('[data-mystatus]', this.lab.top).innerHTML = S.pid ? (S.mine[S.pid] ? `<span class="muted" style="font-size:13px">我的最佳：</span>${this.statusChip(S.pid)}` : '<span class="muted" style="font-size:13px">尚未送出</span>') : '';
  },
  renderStatement(p) {
    const el = $('[data-stmt]', this.lab.top);
    const idx = S.problems.indexOf(p);
    const samples = p.cases.filter(c => c.sample);
    const hidden = p.cases.length - samples.length;
    const circuitHtml = p.circuit.length ? `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>元件</th><th>腳位</th><th>接法</th></tr></thead><tbody>${
      p.circuit.map(c => `<tr><td>${esc(c.label || AJ.TYPE_NAMES[c.type])} <span class="muted" style="font-size:12px">${esc(c.id)}</span></td><td>${AJ.pinChips(c)}</td><td>${esc(AJ.wiringText(c))}</td></tr>`).join('')
    }</tbody></table></div>` : '<p class="muted" style="margin:0">這題不需要外接元件，只使用序列埠。</p>';
    el.innerHTML = `<div class="ptitle"><span class="muted" style="font-family:var(--font-code)">#${String(idx + 1).padStart(2, '0')}</span><h1>${esc(p.title)}</h1><span class="level" title="難度">${stars(p.level)}</span>${(p.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      <div class="desc">${md(p.desc)}</div>
      <div class="sub">電路接線</div>${circuitHtml}
      <div class="sub">範例測資</div><div data-samples>${samples.length ? '<p class="muted">產生範例輸出中…</p>' : '<p class="muted">這題沒有公開的範例測資。</p>'}</div>
      ${hidden > 0 ? `<p class="hint">另外還有 ${hidden} 組隱藏測資，送出判題時會一起測試。</p>` : ''}`;
    this.refreshStatus();
    if (!samples.length) return;
    getExpected(p).then(exp => {
      if (S.pid !== p.id) return;
      $('[data-samples]', el).innerHTML = p.cases.map((c, i) => c.sample ? this.sampleHtml(p, c, exp[i]) : '').join('');
    }).catch(e => { $('[data-samples]', el).innerHTML = `<p class="muted">範例輸出產生失敗：${esc(e.message)}</p>`; });
  },
  sampleHtml(p, c, exp) {
    const ev = AJ.Judge.describeEvents(c.events, p.circuit);
    let html = `<div style="margin-bottom:12px"><b>${esc(c.name || '範例')}</b> <span class="muted">（模擬 ${(c.duration / 1000).toFixed(1)} 秒）</span>`;
    html += ev.length ? `<div class="tbl-wrap"><table class="tbl" style="margin-top:4px"><thead><tr><th>時間</th><th>操作</th><th></th></tr></thead><tbody>${ev.map(e => `<tr><td style="font-family:var(--font-code)">${esc(e.t)}</td><td>${esc(e.what)}</td><td><code>${esc(e.detail)}</code></td></tr>`).join('')}</tbody></table></div>`
      : '<div class="muted" style="font-size:14px">（這組測資不需要任何操作，開機後直接觀察）</div>';
    const ser = p.compare.find(x => x.kind === 'serial');
    if (ser) html += `<div class="sub" style="margin-top:8px">預期的序列埠輸出</div><pre class="out">${esc(AJ.Judge.normLines(exp.serial || '').join('\n')) || '（沒有輸出）'}</pre>`;
    const rows = waveRows(p, exp, null);
    if (rows.length) html += `<div class="sub" style="margin-top:8px">預期的輸出變化</div><div class="wave">${AJ.renderWave(rows, c.duration)}</div>`;
    if (p.compare.some(x => x.kind === 'pixels')) html += '<p class="hint">燈條的顏色會在每次 show() 時比對。</p>';
    return html + '</div>';
  },
  async submit() {
    if (S.judging) return;
    const p = problemById(S.pid);
    if (!p) return;
    if (S.store && S.store.canSubmit && !(S.profile && (S.profile.name || S.profile.seat))) {
      const pf = await profileDialog();
      if (!pf) { toast('需要先填寫班級座號姓名才能記錄成績'); return; }
    }
    S.judging = true;
    const lab = this.lab;
    lab.stop(); lab.hideMsg(); lab.editor.setError(0);
    const code = lab.editor.value;
    const card = lab.resCard;
    card.hidden = false;
    card.innerHTML = `<div class="card-h"><h2>判題結果</h2></div><div class="card-b"><div class="verdict"><span class="vbadge v-RUN">判題中</span><span class="muted" data-prog>準備測資…</span></div></div>`;
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    let res;
    try {
      const exp = await getExpected(p);
      res = await AJ.Judge.judge(code, p, exp, (c, i) => { const pg = $('[data-prog]', card); if (pg) pg.textContent = `已完成 ${i + 1} / ${p.cases.length} 組測資`; });
      this.renderResult(p, res, exp);
    } catch (e) {
      card.innerHTML = `<div class="card-h"><h2>判題結果</h2></div><div class="card-b"><p>判題時發生問題：${esc(e.message)}</p></div>`;
      S.judging = false;
      return;
    }
    S.judging = false;
    if (res.verdict === 'CE') lab.showCE({ line: res.ce.line, message: res.ce.msg });
    const note = $('[data-note]', card);
    if (!S.store || !S.store.canSubmit) { note.textContent = S.store ? S.store.detail : '尚未連線，這次的結果沒有記錄。'; return; }
    try {
      await S.store.submit(p.id, { verdict: res.verdict, score: res.score, at: Date.now(), code: code.slice(0, 12000) }, p.title);
      note.textContent = S.store.mode === 'claude' ? '成績已記錄在 Claude 雲端（Artifact 版不會寫入 Google 試算表，老師可在「成績總表」查看）。' : `成績已記錄（${S.store.label}）。`;
    } catch (e) {
      note.textContent = '成績沒有記錄成功：' + (e.code === 'invalid_argument' ? '你目前只有檢視權限' : e.message);
    }
  },
  renderResult(p, res, exp) {
    const card = this.lab.resCard;
    const V = AJ.Judge.VERDICT[res.verdict];
    const ac = res.cases.filter(c => c.verdict === 'AC').length;
    let html = `<div class="card-h"><h2>判題結果</h2><span class="spacer"></span><span class="muted" style="font-size:13px">${esc(fmtTime(Date.now()))}</span></div><div class="card-b">
      <div class="verdict"><span class="vbadge v-${res.verdict}">${res.verdict}</span><div><div style="font-weight:700">${esc(V.name)} <span class="muted">${esc(V.en)}</span></div>
      <div class="muted" style="font-size:14px">${res.verdict === 'CE' ? '程式無法編譯，請修正後再送出' : `${ac} / ${res.cases.length} 組測資通過`}</div></div><span class="spacer"></span><div class="score">${res.score}<small style="font-size:14px"> 分</small></div></div>`;
    if (res.verdict === 'CE') html += `<div class="cases"><div class="case">${vchip('CE')}<div class="msg">第 ${res.ce.line} 行：${esc(res.ce.msg)}</div><span></span></div></div>`;
    html += '<div class="cases">';
    res.cases.forEach((c, i) => {
      let msg = c.msg;
      if (c.verdict === 'WA' && !c.sample && c.key === 'serial') msg = '序列埠的輸出和標準答案不同（隱藏測資不顯示詳細內容）';
      const canWave = c.sample && c.verdict === 'WA' && waveRows(p, exp[i], c.act).length;
      const canSer = c.sample && c.verdict === 'WA' && c.key === 'serial';
      html += `<div class="case">${vchip(c.verdict)}<div><b>${esc(c.name)}</b>${c.sample ? ' <span class="tag">範例</span>' : ''}
        ${msg ? `<div class="msg">${esc(msg)}</div>` : ''}
        ${(c.warnings || []).map(w => `<div class="msg muted">提示：${w.line ? `第 ${w.line} 行，` : ''}${esc(w.msg)}</div>`).join('')}
        ${canWave ? `<button class="link" data-wave="${i}">看輸出波形比較</button><div class="wave" data-wv="${i}" hidden></div>` : ''}
        ${canSer ? `<button class="link" data-ser="${i}">看輸出比較</button><div data-sv="${i}" hidden></div>` : ''}
      </div><span class="ms">${c.ms} ms</span></div>`;
    });
    html += '</div><p class="hint" data-note style="margin:10px 0 0"></p></div>';
    card.innerHTML = html;
    $$('[data-wave]', card).forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.wave, c = res.cases[i];
      const box = $(`[data-wv="${i}"]`, card);
      box.hidden = !box.hidden;
      if (!box.hidden && !box.innerHTML) {
        box.innerHTML = `<div class="legend"><span><i style="background:var(--primary);opacity:.4;height:7px"></i>標準答案</span><span><i style="background:var(--accent)"></i>你的程式</span><span><i style="background:var(--wa)"></i>第一個不同的地方</span></div>` +
          AJ.renderWave(waveRows(p, exp[i], c.act), p.cases[i].duration, c.at);
      }
    }));
    $$('[data-ser]', card).forEach(b => b.addEventListener('click', () => {
      const i = +b.dataset.ser, c = res.cases[i];
      const box = $(`[data-sv="${i}"]`, card);
      box.hidden = !box.hidden;
      if (!box.hidden && !box.innerHTML) {
        const e = AJ.Judge.normLines(exp[i].serial || '').join('\n'), a = AJ.Judge.normLines((c.act && c.act.serial) || '').join('\n');
        box.innerHTML = `<div class="row" style="align-items:stretch;margin-top:6px"><div class="field"><span class="lb">標準輸出</span><pre class="out">${esc(e) || '（沒有輸出）'}</pre></div><div class="field"><span class="lb">你的輸出</span><pre class="out">${esc(a) || '（沒有輸出）'}</pre></div></div>`;
      }
    }));
  },
};
function compareLabel(p, c) {
  const pn = AJ.pinName(c.pin);
  for (const comp of p.circuit) {
    if (c.kind === 'pin') {
      if ((comp.type === 'led' || comp.type === 'buzzer') && comp.pin === c.pin) return `${comp.label || comp.id} ${pn}`;
      if (comp.type === 'rgb') {
        const ch = comp.r === c.pin ? 'R' : comp.g === c.pin ? 'G' : comp.b === c.pin ? 'B' : null;
        if (ch) return `${comp.label || comp.id} ${ch} ${pn}`;
      }
    } else if (comp.pin === c.pin) return `${comp.label || comp.id} ${pn}`;
  }
  return pn;
}
function waveRows(p, exp, act) {
  return p.compare.filter(c => c.kind === 'pin' || c.kind === 'servo' || c.kind === 'tone').map(c => {
    const k = AJ.Judge.keyOf(c);
    return { label: compareLabel(p, c), kind: c.kind, exp: exp ? exp[k] || [] : null, act: act ? act[k] || [] : null };
  });
}

/* ================================================================ 自由練習 */
const PL = {
  init() {
    if (this.lab) return;
    const saved = LS.get('aj.play', null) || AJ.PLAYGROUND_DEFAULT;
    this.circuit = JSON.parse(JSON.stringify(saved.circuit || []));
    this.lab = createLab($('#v-play'), {
      id: 'pl', editable: true,
      onCode: v => this.save(v),
      onReset: () => {
        this.lab.editor.value = AJ.PLAYGROUND_DEFAULT.code;
        this.circuit = JSON.parse(JSON.stringify(AJ.PLAYGROUND_DEFAULT.circuit));
        this.lab.setCircuit(this.circuit);
        this.save();
      },
      onAdd: () => partDialog(this.circuit, c => { this.circuit.push(c); this.lab.setCircuit(this.circuit); this.save(); }),
      onRemove: id => { this.circuit = this.circuit.filter(c => c.id !== id); this.lab.setCircuit(this.circuit); this.save(); },
    });
    const groups = [];
    for (const ex of AJ.EXAMPLES || []) { let g = groups.find(x => x.name === ex.group); if (!g) groups.push(g = { name: ex.group, list: [] }); g.list.push(ex); }
    this.lab.top.innerHTML = `<section class="card"><div class="card-b" style="display:flex;flex-direction:column;gap:10px"><div class="ptitle" style="margin:0"><h1>自由練習</h1></div>
      <p class="muted" style="margin:0">自己接電路、自己寫程式，不會判題也不會記錄成績。按住按鈕、拖動旋鈕，或在序列埠輸入文字，都能即時看到 Arduino 的反應。</p>
      <div class="row" style="align-items:flex-end"><div class="field" style="flex:1 1 220px"><label for="pl-ex">範例程式（仿 Arduino IDE 的「檔案 → 範例」）</label>
        <select id="pl-ex"><option value="">選一個範例…</option>${groups.map(g => `<optgroup label="${esc(g.name)}">${g.list.map(ex => `<option value="${esc(ex.id)}">${esc(ex.title)}</option>`).join('')}</optgroup>`).join('')}</select></div>
        <button class="btn primary" data-loadex disabled>載入範例</button></div>
      <div data-exdesc class="hint" hidden></div></div></section>`;
    const sel = $('#pl-ex'), loadBtn = $('[data-loadex]'), descEl = $('[data-exdesc]');
    let armed = false;
    sel.addEventListener('change', () => {
      const ex = AJ.EXAMPLES.find(x => x.id === sel.value);
      loadBtn.disabled = !ex; armed = false; loadBtn.textContent = '載入範例';
      descEl.hidden = !ex;
      if (ex) descEl.textContent = ex.desc;
    });
    loadBtn.addEventListener('click', () => {
      const ex = AJ.EXAMPLES.find(x => x.id === sel.value);
      if (!ex) return;
      if (!armed) { armed = true; loadBtn.textContent = '確定取代目前的程式和電路？'; return; }
      armed = false; loadBtn.textContent = '載入範例';
      this.circuit = JSON.parse(JSON.stringify(ex.circuit));
      this.lab.setCircuit(this.circuit);
      this.lab.editor.value = ex.code;
      this.save();
      toast(`已載入「${ex.title}」，按「執行模擬」試試看`);
    });
    this.lab.editor.value = saved.code || AJ.PLAYGROUND_DEFAULT.code;
    this.lab.setCircuit(this.circuit);
  },
  save(code) {
    LS.set('aj.play', { circuit: this.circuit, code: code != null ? code : this.lab.editor.value });
  },
};

/* ---------------------------------------------------------- 元件設定 */
function pinOptions(sel, analogOnly) {
  let s = '';
  for (let p = analogOnly ? 14 : 0; p < 20; p++) s += `<option value="${p}"${p === sel ? ' selected' : ''}>${AJ.pinName(p)}${AJ.PWM_PINS.has(p) ? ' ~PWM' : ''}</option>`;
  return s;
}
function newId(circuit, type) {
  const base = { led: 'led', rgb: 'rgb', button: 'btn', switch: 'sw', pot: 'pot', ldr: 'ldr', buzzer: 'bz', servo: 'servo', ws2812: 'strip' }[type];
  let i = 1;
  while (circuit.some(c => c.id === base + i)) i++;
  return base + i;
}
function defaultPart(circuit, type) {
  const used = new Set(circuit.flatMap(AJ.pinsOf));
  const free = (cands) => cands.find(p => !used.has(p)) ?? cands[0];
  const c = { id: newId(circuit, type), type, label: AJ.TYPE_NAMES[type] };
  if (type === 'led') { c.pin = free([13, 12, 8, 7, 4, 2, 9, 10, 11, 6, 5, 3]); c.color = 'red'; }
  else if (type === 'rgb') { c.r = 9; c.g = 10; c.b = 11; }
  else if (type === 'button' || type === 'switch') { c.pin = free([2, 3, 4, 5, 6, 7, 8, 12]); c.wiring = 'pullup'; }
  else if (type === 'pot' || type === 'ldr') { c.pin = free([14, 15, 16, 17, 18, 19]); c.value = 512; }
  else if (type === 'buzzer') c.pin = free([8, 7, 12, 4]);
  else if (type === 'servo') c.pin = free([9, 10, 5, 6, 3]);
  else if (type === 'ws2812') { c.pin = free([6, 5, 3]); c.count = 8; c.shape = 'strip'; }
  return c;
}
AJ.defaultPart = defaultPart;
function partFields(c, pre) {
  let s = '';
  if (c.type === 'rgb') {
    s += ['r', 'g', 'b'].map(k => `<div class="field"><label for="${pre}-${k}">${{ r: '紅', g: '綠', b: '藍' }[k]}色腳位</label><select id="${pre}-${k}" data-k="${k}">${pinOptions(c[k])}</select></div>`).join('');
  } else {
    s += `<div class="field"><label for="${pre}-pin">腳位</label><select id="${pre}-pin" data-k="pin">${pinOptions(c.pin, c.type === 'pot' || c.type === 'ldr')}</select></div>`;
  }
  if (c.type === 'led') s += `<div class="field"><label for="${pre}-color">顏色</label><select id="${pre}-color" data-k="color">${Object.keys(AJ.LED_COLORS).map(k => `<option value="${k}"${k === c.color ? ' selected' : ''}>${{ red: '紅', green: '綠', yellow: '黃', blue: '藍', white: '白', orange: '橘' }[k]}</option>`).join('')}</select></div>`;
  if (c.type === 'button' || c.type === 'switch') s += `<div class="field"><label for="${pre}-wiring">接法</label><select id="${pre}-wiring" data-k="wiring"><option value="pullup"${c.wiring !== 'pulldown' ? ' selected' : ''}>接 GND（INPUT_PULLUP）</option><option value="pulldown"${c.wiring === 'pulldown' ? ' selected' : ''}>接 5V＋下拉電阻</option></select></div>`;
  if (c.type === 'ws2812') {
    s += `<div class="field"><label for="${pre}-count">燈珠數</label><input id="${pre}-count" data-k="count" type="number" min="1" max="60" value="${c.count}"></div>`;
    s += `<div class="field"><label for="${pre}-shape">形狀</label><select id="${pre}-shape" data-k="shape"><option value="strip"${c.shape !== 'ring' ? ' selected' : ''}>燈條</option><option value="ring"${c.shape === 'ring' ? ' selected' : ''}>燈環</option></select></div>`;
  }
  return s;
}
function readPartFields(root, c) {
  $$('[data-k]', root).forEach(el => {
    const k = el.dataset.k;
    c[k] = (k === 'color' || k === 'wiring' || k === 'shape') ? el.value : Math.max(k === 'count' ? 1 : 0, Math.min(k === 'count' ? 60 : 19, +el.value));
  });
  return c;
}
function partDialog(circuit, onAdd) {
  let c = defaultPart(circuit, 'led');
  const d = openDialog(`<div class="card-h"><h2>新增元件</h2></div><form class="card-b" id="pd-form">
    <div class="row"><div class="field"><label for="pd-type">元件</label><select id="pd-type">${Object.keys(AJ.TYPE_NAMES).map(t => `<option value="${t}">${AJ.TYPE_NAMES[t]}</option>`).join('')}</select></div>
    <div class="field"><label for="pd-label">名稱</label><input id="pd-label"></div></div>
    <div class="row" data-fields></div>
    <p class="hint" data-wire></p>
    <div class="row"><span class="spacer"></span><button type="button" class="btn" data-x>取消</button><button class="btn primary" type="submit">加入</button></div></form>`);
  const fill = () => {
    $('[data-fields]', d.el).innerHTML = partFields(c, 'pd');
    $('#pd-label', d.el).value = c.label;
    $('[data-wire]', d.el).textContent = AJ.wiringText(c);
  };
  $('#pd-type', d.el).addEventListener('change', e => { c = defaultPart(circuit, e.target.value); fill(); });
  $('[data-x]', d.el).addEventListener('click', d.close);
  $('#pd-form', d.el).addEventListener('submit', e => {
    e.preventDefault();
    readPartFields(d.el, c);
    c.label = $('#pd-label', d.el).value.trim() || AJ.TYPE_NAMES[c.type];
    d.close();
    onAdd(c);
  });
  fill();
}

/* ================================================================ 成績總表 */
const GV = {
  render() {
    const host = $('#v-grades');
    const st = S.store;
    if (!st) { host.innerHTML = '<div class="card"><div class="empty">連線中…</div></div>'; return; }
    if (st.mode === 'sheet' && !st.isTeacher) { host.innerHTML = loginCard(); bindLogin(host, () => { updateChrome(); this.render(); }); return; }
    if (!st.isTeacher) { host.innerHTML = '<div class="card"><div class="empty">只有老師可以看成績總表。</div></div>'; return; }
    host.innerHTML = `<section class="card">
      <div class="card-h"><h2>成績總表</h2><span class="muted" style="font-size:13px">${esc(st.label)}</span><span class="spacer"></span>
        <label class="muted" for="g-cls" style="font-size:13px">班級</label><select id="g-cls" class="btn small"></select>
        ${st.mode === 'sheet' ? '<button class="btn small" data-reload>重新整理</button>' : ''}
        <button class="btn small" data-csv>複製成 CSV</button>
        ${st.mode === 'sheet' ? '<button class="btn small" data-logout>教師登出</button>' : ''}</div>
      <div class="card-b"><div class="stat" data-stat></div>${st.mode === 'local' ? '<p class="hint">本機模式只會看到這台電腦自己的成績。要收全班成績，請參考使用說明設定 Google 試算表，或使用 Claude 雲端版。</p>' : ''}</div>
      <div class="grid-scroll" data-grid><div class="empty">讀取中…</div></div></section>`;
    $('#g-cls', host).addEventListener('change', () => this.table());
    const r = $('[data-reload]', host); if (r) r.addEventListener('click', () => st.reloadAll && st.reloadAll());
    const lo = $('[data-logout]', host); if (lo) lo.addEventListener('click', () => { st.teacherLogout(); updateChrome(); this.render(); });
    $('[data-csv]', host).addEventListener('click', () => copyText(this.csv()));
    if (!this.sub) {
      this.sub = true;
      st.on('all', rows => { S.all = rows; if (S.view === 'grades') this.table(); });
      st.on('allError', m => { const g = $('[data-grid]'); if (g) g.innerHTML = `<div class="empty">讀取失敗：${esc(m)}</div>`; });
      st.watchAll();
    } else this.table();
  },
  rows() {
    const cls = $('#g-cls') ? $('#g-cls').value : '';
    return S.all.filter(r => !cls || String(r.cls) === cls).slice().sort((a, b) => String(a.cls).localeCompare(String(b.cls), 'zh-TW', { numeric: true }) || (+a.seat || 0) - (+b.seat || 0));
  },
  async table() {
    const host = $('#v-grades');
    const sel = $('#g-cls', host);
    if (!sel) return;
    const classes = [...new Set(S.all.map(r => String(r.cls || '')))].filter(Boolean).sort((a, b) => a.localeCompare(b, 'zh-TW', { numeric: true }));
    const cur = sel.value;
    sel.innerHTML = '<option value="">全部</option>' + classes.map(c => `<option${c === cur ? ' selected' : ''}>${esc(c)}</option>`).join('');
    const rows = this.rows();
    const P = S.problems;
    let names = {};
    if (S.store.mode === 'claude' && S.store.user && rows.some(r => !r.name)) {
      try { const ps = await S.store.user.profiles(rows.map(r => r.key)); for (const k in ps) names[k] = ps[k].name; } catch (e) { names = {}; }
    }
    const grid = $('[data-grid]', host);
    if (!rows.length) { grid.innerHTML = '<div class="empty">還沒有學生送出判題。學生送出後，成績會出現在這裡。</div>'; $('[data-stat]', host).innerHTML = ''; return; }
    const acCount = r => P.filter(p => r.results && r.results[p.id] && r.results[p.id].best && r.results[p.id].best.verdict === 'AC').length;
    let html = `<table class="grades"><thead><tr><th class="stick">班級</th><th class="stick" style="left:56px">座號</th><th class="stick" style="left:104px">姓名</th>${P.map((p, i) => `<th class="pt" title="${esc(p.title)}">${i + 1}. ${esc(p.title)}</th>`).join('')}<th class="sum">AC 題數</th></tr></thead><tbody>`;
    for (const r of rows) {
      html += `<tr><td class="stick">${esc(r.cls || '')}</td><td class="stick" style="left:56px">${esc(r.seat || '')}</td><td class="stick" style="left:104px">${esc(r.name || names[r.key] || '（未填）')}</td>`;
      for (const p of P) {
        const x = r.results && r.results[p.id];
        html += x && x.best ? `<td class="c" data-k="${esc(r.key)}" data-p="${esc(p.id)}" title="嘗試 ${x.tries || 1} 次">${x.best.verdict === 'AC' ? vchip('AC') : vchip(x.best.verdict) + `<span style="font-size:11px"> ${x.best.score}</span>`}</td>` : '<td class="c muted">·</td>';
      }
      html += `<td class="sum">${acCount(r)}</td></tr>`;
    }
    html += `</tbody><tfoot><tr><td class="stick muted" colspan="3">通過率</td>${P.map(p => {
      const n = rows.filter(r => r.results && r.results[p.id] && r.results[p.id].best && r.results[p.id].best.verdict === 'AC').length;
      return `<td class="c muted" style="font-size:12px">${Math.round(n * 100 / rows.length)}%</td>`;
    }).join('')}<td></td></tr></tfoot></table>`;
    grid.innerHTML = html;
    const totalAC = rows.reduce((s, r) => s + acCount(r), 0);
    const tried = rows.reduce((s, r) => s + Object.keys(r.results || {}).length, 0);
    $('[data-stat]', host).innerHTML = `<div><b>${rows.length}</b><span>位學生</span></div><div><b>${(totalAC / rows.length).toFixed(1)}</b><span>平均通過題數</span></div><div><b>${tried}</b><span>已作答的題目（人次）</span></div><div><b>${P.length}</b><span>題目總數</span></div>`;
    $$('td[data-k]', grid).forEach(td => td.addEventListener('click', () => this.detail(td.dataset.k, td.dataset.p, names)));
  },
  detail(key, pid, names) {
    const r = S.all.find(x => x.key === key), p = problemById(pid);
    const x = r.results[pid];
    const last = x.last || {};
    const d = openDialog(`<div class="card-h"><h2>${esc(r.cls || '')} ${esc(r.seat || '')} 號 ${esc(r.name || names[key] || '')}・${esc(p ? p.title : pid)}</h2><span class="spacer"></span><button class="btn small" data-x>關閉</button></div>
      <div class="card-b"><div class="row" style="align-items:center">最佳 ${vchip(x.best.verdict)} ${x.best.score} 分　最後一次 ${last.verdict ? vchip(last.verdict) : ''} ${last.score != null ? last.score + ' 分' : ''}　共送出 ${x.tries || 1} 次</div>
      <div class="hint">最後送出：${esc(last.at ? fmtTime(last.at) : '')}</div>
      ${last.code ? `<pre class="out" style="max-height:50vh;overflow:auto">${AJ.highlight(last.code)}</pre><div class="row"><span class="spacer"></span><button class="btn small" data-copy>複製程式碼</button></div>` : '<p class="muted">沒有保存程式碼。</p>'}</div>`, true);
    $('[data-x]', d.el).addEventListener('click', d.close);
    const cp = $('[data-copy]', d.el); if (cp) cp.addEventListener('click', () => copyText(last.code));
  },
  csv() {
    const rows = this.rows(), P = S.problems;
    const q = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const lines = [['班級', '座號', '姓名', ...P.map((p, i) => `${i + 1}.${p.title}`), 'AC題數'].map(q).join(',')];
    for (const r of rows) {
      let ac = 0;
      const cells = P.map(p => { const x = r.results && r.results[p.id]; if (!x || !x.best) return ''; if (x.best.verdict === 'AC') ac++; return `${x.best.verdict} ${x.best.score}`; });
      lines.push([r.cls, r.seat, r.name, ...cells, ac].map(q).join(','));
    }
    return '﻿' + lines.join('\r\n');
  },
};
function loginCard() {
  return `<section class="card" style="max-width:440px;margin:24px auto"><div class="card-h"><h2>教師登入</h2></div>
    <form class="card-b" data-login><div class="field"><label for="t-key">教師密碼</label><input id="t-key" type="password" autocomplete="current-password" required></div>
    <p class="hint" style="margin:0">密碼是你在 Google Apps Script（Code.gs）裡設定的 TEACHER_KEY。</p>
    <div class="row"><span class="spacer"></span><button class="btn primary">登入</button></div></form></section>`;
}
function bindLogin(host, done) {
  $('[data-login]', host).addEventListener('submit', async e => {
    e.preventDefault();
    try { await S.store.teacherLogin($('#t-key', host).value); toast('已登入'); done(); }
    catch (err) { toast('登入失敗：' + err.message); }
  });
}

/* ================================================================ 出題管理 */
const AV = {
  draft: null,
  render() {
    const host = $('#v-author');
    const st = S.store;
    if (!st) { host.innerHTML = '<div class="card"><div class="empty">連線中…</div></div>'; return; }
    if (st.mode === 'sheet' && !st.isTeacher) { host.innerHTML = loginCard(); bindLogin(host, () => { updateChrome(); this.render(); }); return; }
    if (!st.isTeacher) { host.innerHTML = '<div class="card"><div class="empty">只有老師可以出題。</div></div>'; return; }
    host.innerHTML = `<div class="authoring">
      <section class="card"><div class="card-h"><h2>我的題目</h2><span class="spacer"></span><button class="btn small primary" data-new>${I.plus}新題目</button></div>
        <div class="card-b plist" data-list></div>
        <div class="card-b" style="border-top:1px solid var(--line)"><div class="field"><label for="a-copy">從範例題目複製</label><select id="a-copy"><option value="">選一題範例…</option>${S.builtin.map(p => `<option value="${esc(p.id)}">${esc(p.title)}</option>`).join('')}</select></div></div></section>
      <section class="card" data-form><div class="empty">選擇左邊的題目來編輯，或按「新題目」。<br>也可以從範例題目複製一份再修改。</div></section></div>`;
    $('[data-new]', host).addEventListener('click', () => this.edit(this.blank()));
    $('#a-copy', host).addEventListener('change', e => {
      const b = S.builtin.find(p => p.id === e.target.value);
      if (!b) return;
      const d = JSON.parse(JSON.stringify(b));
      d.id = 'p' + Date.now().toString(36); d.title += '（複製）'; d.isNew = true;
      e.target.value = '';
      this.edit(d);
    });
    this.list();
    if (this.draft) this.edit(this.draft, true);
  },
  list() {
    const el = $('[data-list]');
    if (!el) return;
    el.innerHTML = S.custom.length ? S.custom.map(p => `<button class="prow" data-id="${esc(p.id)}" ${this.draft && this.draft.id === p.id ? 'aria-current="true"' : ''}><span class="no">${p.cases.length} 組</span><span class="tt">${esc(p.title)}</span><span class="level">${stars(p.level)}</span></button>`).join('')
      : '<p class="muted" style="margin:0">還沒有自訂題目。</p>';
    $$('.prow', el).forEach(b => b.addEventListener('click', async () => {
      const p = S.custom.find(x => x.id === b.dataset.id);
      const d = JSON.parse(JSON.stringify(p));
      delete d.expected;
      d.solution = '';
      this.edit(d);
      try { d.solution = (await S.store.getSolution(p.id)) || ''; if (this.draft === d && this.solEd) this.solEd.value = d.solution; }
      catch (e) { toast('讀取參考解答失敗：' + e.message); }
    }));
  },
  blank() {
    return {
      id: 'p' + Date.now().toString(36), isNew: true, title: '', level: 1, tags: [], desc: '',
      circuit: [{ id: 'led1', type: 'led', pin: 13, color: 'red', label: 'LED' }],
      compare: [{ kind: 'pin', pin: 13 }], tol: 30, step: 20,
      cases: [{ name: '範例', duration: 3000, events: '', sample: true }],
      starter: '', solution: AJ.STARTER,
    };
  },
  edit(d, keep) {
    this.draft = d;
    const f = $('[data-form]');
    f.innerHTML = `<div class="card-h"><h2>${d.isNew ? '新題目' : '編輯題目'}</h2><span class="muted" style="font-family:var(--font-code);font-size:12px">${esc(d.id)}</span><span class="spacer"></span>
        <button class="btn" data-try>${I.play}試跑參考解答</button><button class="btn primary" data-save>${I.check}儲存並發佈</button>${d.isNew ? '' : '<button class="btn danger" data-del>刪除</button>'}</div>
      <div class="card-b" style="display:flex;flex-direction:column;gap:14px">
        <div class="row"><div class="field" style="flex:3 1 240px"><label for="a-title">標題</label><input id="a-title" value="${esc(d.title)}" placeholder="例如：呼吸燈"></div>
          <div class="field"><label for="a-level">難度</label><select id="a-level">${[1, 2, 3, 4].map(n => `<option value="${n}"${n === d.level ? ' selected' : ''}>${stars(n)} ${(AJ.LEVEL_NAMES || {})[n] || ''}</option>`).join('')}</select></div>
          <div class="field" style="flex:2 1 180px"><label for="a-tags">標籤（用逗號分隔）</label><input id="a-tags" value="${esc((d.tags || []).join(', '))}"></div></div>
        <div class="field"><label for="a-desc">題目說明</label><textarea id="a-desc" rows="7" style="font-family:var(--font-body)">${esc(d.desc)}</textarea>
          <span class="hint">空一行分段；每行開頭寫「- 」會變成項目清單；用 \`反引號\` 標示程式碼。</span></div>
        <div><div class="sub" style="margin-top:0">電路元件</div><div data-crows></div>
          <div class="row" style="margin-top:8px"><select id="a-addtype" class="btn small" aria-label="要新增的元件">${Object.keys(AJ.TYPE_NAMES).map(t => `<option value="${t}">${AJ.TYPE_NAMES[t]}</option>`).join('')}</select><button class="btn small" data-addpart>${I.plus}加入元件</button></div></div>
        <div><div class="sub">要比對的輸出</div><div class="checks" data-checks></div>
          <div class="row" style="margin-top:8px"><div class="field" style="flex:0 1 160px"><label for="a-tol">時間容許誤差（毫秒）</label><input id="a-tol" type="number" min="5" max="500" value="${d.tol || 30}"></div>
          <div class="field" style="flex:0 1 160px"><label for="a-step">取樣間隔（毫秒）</label><input id="a-step" type="number" min="5" max="500" value="${d.step || 20}"></div></div>
          <span class="hint">判題時會把學生程式和參考解答的輸出，每隔一段時間比對一次；時間差在容許誤差內都算正確。</span></div>
        <div><div class="sub">測資</div><div data-cases style="display:flex;flex-direction:column;gap:10px"></div>
          <div class="row" style="margin-top:8px"><button class="btn small" data-addcase>${I.plus}新增測資</button></div>
          <p class="hint">事件格式（每行一個，時間單位是毫秒）：<code>500 press btn1</code>、<code>1500 release btn1</code>、<code>800 toggle sw1</code>、<code>0 set pot1 512</code>、<code>100 serial 3 5\\n</code>（\\n 代表換行）</p></div>
        <div class="field"><span class="lb">參考解答（學生看不到）</span><div class="card" data-sol style="box-shadow:none"></div></div>
        <div class="field"><span class="lb">學生的起始程式碼（留空就用預設範本）</span><div class="card" data-starter style="box-shadow:none"></div></div>
        <div data-preview></div>
      </div>`;
    this.solEd = new AJ.Editor($('[data-sol]', f), { id: 'a-sol', value: d.solution || '', label: '參考解答', onChange: v => { d.solution = v; } });
    this.starterEd = new AJ.Editor($('[data-starter]', f), { id: 'a-starter', value: d.starter || '', label: '起始程式碼', onChange: v => { d.starter = v; } });
    $('[data-starter] .ed', f).style.height = '180px';
    const bind = (id, fn) => $('#' + id, f).addEventListener('input', e => fn(e.target.value));
    bind('a-title', v => { d.title = v; });
    bind('a-level', v => { d.level = +v; });
    bind('a-tags', v => { d.tags = v.split(/[,，]/).map(s => s.trim()).filter(Boolean); });
    bind('a-desc', v => { d.desc = v; });
    bind('a-tol', v => { d.tol = Math.max(5, +v || 30); });
    bind('a-step', v => { d.step = Math.max(5, +v || 20); });
    $('[data-addpart]', f).addEventListener('click', () => {
      d.circuit.push(defaultPart(d.circuit, $('#a-addtype', f).value));
      this.renderCircuit();
    });
    $('[data-addcase]', f).addEventListener('click', () => {
      d.cases.push({ name: `測資 ${d.cases.length + 1}`, duration: 3000, events: '', sample: false });
      this.renderCases();
    });
    $('[data-try]', f).addEventListener('click', () => this.tryRun());
    $('[data-save]', f).addEventListener('click', () => this.save());
    const del = $('[data-del]', f);
    if (del) del.addEventListener('click', async () => {
      if (!this.delArm) { this.delArm = true; del.textContent = '再按一次確定刪除'; setTimeout(() => { this.delArm = false; if (del.isConnected) del.textContent = '刪除'; }, 3000); return; }
      try { await S.store.deleteProblem(d.id); toast('已刪除'); this.draft = null; this.render(); } catch (e) { toast('刪除失敗：' + e.message); }
    });
    this.renderCircuit();
    this.renderCases();
    this.list();
    if (!keep) f.scrollIntoView({ behavior: 'smooth', block: 'start' });
  },
  renderCircuit() {
    const d = this.draft, box = $('[data-crows]');
    box.innerHTML = d.circuit.length ? '' : '<p class="muted" style="margin:0">沒有元件（只用序列埠的題目）。</p>';
    d.circuit.forEach((c, i) => {
      const row = h(`<div class="crow"><div><b style="font-size:13px">${esc(AJ.TYPE_NAMES[c.type])}</b><input aria-label="元件代號" data-id value="${esc(c.id)}" title="元件代號（測資事件用）"></div>
        <input aria-label="顯示名稱" data-label value="${esc(c.label || '')}"><div class="opts">${partFields(c, 'ac' + i)}</div><button class="btn small danger" data-rm aria-label="移除">×</button></div>`);
      $('[data-id]', row).addEventListener('change', e => {
        const v = e.target.value.trim().replace(/\s+/g, '_');
        if (!v || d.circuit.some((x, j) => j !== i && x.id === v)) { toast('元件代號不能空白或重複'); e.target.value = c.id; return; }
        c.id = v;
      });
      $('[data-label]', row).addEventListener('input', e => { c.label = e.target.value; });
      $('.opts', row).addEventListener('change', () => { readPartFields(row, c); this.renderChecks(); });
      $('[data-rm]', row).addEventListener('click', () => { d.circuit.splice(i, 1); this.renderCircuit(); });
      box.appendChild(row);
    });
    this.renderChecks();
  },
  outputs() {
    const out = [];
    for (const c of this.draft.circuit) {
      const nm = c.label || c.id;
      if (c.type === 'led') out.push({ kind: 'pin', pin: c.pin, label: `${nm}（${AJ.pinName(c.pin)}）` });
      if (c.type === 'rgb') ['r', 'g', 'b'].forEach(k => out.push({ kind: 'pin', pin: c[k], label: `${nm} ${k.toUpperCase()}（${AJ.pinName(c[k])}）` }));
      if (c.type === 'buzzer') { out.push({ kind: 'tone', pin: c.pin, label: `${nm} 音高（${AJ.pinName(c.pin)}）` }); }
      if (c.type === 'servo') out.push({ kind: 'servo', pin: c.pin, label: `${nm} 角度（${AJ.pinName(c.pin)}）` });
      if (c.type === 'ws2812') out.push({ kind: 'pixels', pin: c.pin, label: `${nm} 顏色（${AJ.pinName(c.pin)}）` });
    }
    out.push({ kind: 'serial', label: '序列埠輸出' });
    return out;
  },
  renderChecks() {
    const d = this.draft, box = $('[data-checks]');
    const outs = this.outputs();
    const has = o => d.compare.some(c => c.kind === o.kind && (o.kind === 'serial' || c.pin === o.pin));
    d.compare = d.compare.filter(c => outs.some(o => o.kind === c.kind && (c.kind === 'serial' || o.pin === c.pin)));
    const ser = d.compare.find(c => c.kind === 'serial');
    box.innerHTML = outs.map((o, i) => `<label><input type="checkbox" data-o="${i}"${has(o) ? ' checked' : ''}> ${esc(o.label)}</label>`).join('') +
      `<label>比對方式 <select data-smode><option value="lines"${!ser || ser.mode !== 'tokens' ? ' selected' : ''}>逐行完全相同</option><option value="tokens"${ser && ser.mode === 'tokens' ? ' selected' : ''}>忽略空白與換行</option></select></label>`;
    $$('[data-o]', box).forEach(cb => cb.addEventListener('change', () => {
      const o = outs[+cb.dataset.o];
      d.compare = d.compare.filter(c => !(c.kind === o.kind && (o.kind === 'serial' || c.pin === o.pin)));
      if (cb.checked) d.compare.push(o.kind === 'serial' ? { kind: 'serial', mode: $('[data-smode]', box).value } : { kind: o.kind, pin: o.pin });
    }));
    $('[data-smode]', box).addEventListener('change', e => { const s = d.compare.find(c => c.kind === 'serial'); if (s) s.mode = e.target.value; });
  },
  renderCases() {
    const d = this.draft, box = $('[data-cases]');
    box.innerHTML = '';
    d.cases.forEach((c, i) => {
      const el = h(`<div class="casebox"><div class="row"><div class="field" style="flex:2 1 160px"><label for="cs-n${i}">名稱</label><input id="cs-n${i}" value="${esc(c.name || '')}"></div>
        <div class="field" style="flex:1 1 110px"><label for="cs-d${i}">模擬時間（毫秒）</label><input id="cs-d${i}" type="number" min="200" max="30000" step="100" value="${c.duration}"></div>
        <label style="display:flex;gap:6px;align-items:center;font-size:14px"><input type="checkbox" id="cs-s${i}"${c.sample ? ' checked' : ''}> 公開為範例</label>
        <button class="btn small danger" data-rm${d.cases.length < 2 ? ' disabled' : ''}>刪除</button></div>
        <div class="field"><label for="cs-e${i}">輸入事件</label><textarea id="cs-e${i}" rows="4" placeholder="不需要操作就留空">${esc(c.events || '')}</textarea><span class="hint" data-err></span></div></div>`);
      $(`#cs-n${i}`, el).addEventListener('input', e => { c.name = e.target.value; });
      $(`#cs-d${i}`, el).addEventListener('input', e => { c.duration = Math.max(200, Math.min(30000, +e.target.value || 3000)); });
      $(`#cs-s${i}`, el).addEventListener('change', e => { c.sample = e.target.checked; });
      $(`#cs-e${i}`, el).addEventListener('input', e => {
        c.events = e.target.value;
        const r = AJ.Judge.parseEvents(c.events);
        const ids = new Set(d.circuit.map(x => x.id));
        const bad = r.events.filter(x => x.comp && !ids.has(x.comp)).map(x => `找不到元件「${x.comp}」`);
        $('[data-err]', el).textContent = r.errors.concat(bad).join('；');
        $('[data-err]', el).style.color = r.errors.length || bad.length ? 'var(--wa)' : '';
      });
      $('[data-rm]', el).addEventListener('click', () => { d.cases.splice(i, 1); this.renderCases(); });
      box.appendChild(el);
    });
  },
  validate() {
    const d = this.draft;
    if (!d.title.trim()) return '請輸入標題';
    if (!d.compare.length) return '請至少勾選一個要比對的輸出';
    if (!d.cases.length) return '請至少新增一組測資';
    const ids = new Set(d.circuit.map(c => c.id));
    for (const c of d.cases) {
      const r = AJ.Judge.parseEvents(c.events);
      if (r.errors.length) return `測資「${c.name}」：${r.errors[0]}`;
      const bad = r.events.find(x => x.comp && !ids.has(x.comp));
      if (bad) return `測資「${c.name}」：找不到元件「${bad.comp}」`;
    }
    if (!d.solution || !d.solution.trim()) return '請填寫參考解答';
    return null;
  },
  problemObj() {
    const d = this.draft;
    return {
      id: d.id, title: d.title.trim(), level: d.level || 1, tags: d.tags || [], desc: d.desc || '',
      circuit: d.circuit, compare: d.compare, tol: d.tol || 30, step: d.step || 20,
      cases: d.cases.map(c => ({ name: c.name || '', duration: c.duration, events: c.events || '', sample: !!c.sample })),
      starter: d.starter || '', created: d.created || Date.now(), updated: Date.now(),
    };
  },
  tryRun() {
    const err = this.validate();
    const pv = $('[data-preview]');
    if (err) { toast(err); return null; }
    const p = this.problemObj();
    let exp;
    try { exp = AJ.Judge.computeExpected(p, this.draft.solution); }
    catch (e) { pv.innerHTML = `<div class="runerr">${esc(e.message)}</div>`; return null; }
    pv.innerHTML = `<div class="sub">參考解答的輸出（判題時的標準答案）</div>` + p.cases.map((c, i) => {
      let s = `<div class="casebox" style="margin-bottom:10px"><b>${esc(c.name || `測資 ${i + 1}`)}</b>`;
      const ser = p.compare.find(x => x.kind === 'serial');
      if (ser) s += `<pre class="out">${esc(AJ.Judge.normLines(exp[i].serial || '').join('\n')) || '（沒有輸出）'}</pre>`;
      const rows = waveRows(p, exp[i], null);
      if (rows.length) s += `<div class="wave">${AJ.renderWave(rows, c.duration)}</div>`;
      const px = p.compare.filter(x => x.kind === 'pixels');
      for (const x of px) s += `<div class="hint">${esc(compareLabel(p, x))}：共變化 ${(exp[i][AJ.Judge.keyOf(x)] || []).length} 次</div>`;
      return s + '</div>';
    }).join('');
    return { p, exp };
  },
  async save() {
    const r = this.tryRun();
    if (!r) return;
    const p = r.p;
    p.expected = r.exp;
    const size = JSON.stringify(p).length;
    if (size > 240000) { toast('題目資料太大（測資時間太長或輸出太多），請縮短模擬時間'); return; }
    try {
      await S.store.saveProblem(p, this.draft.solution);
      this.draft.isNew = false; this.draft.created = p.created;
      S.expected.delete(p.id);
      toast('已儲存並發佈，學生重新整理後就會看到');
      this.edit(this.draft, true);
    } catch (e) { toast('儲存失敗：' + e.message); }
  },
};

/* ================================================================ 啟動 */
async function boot() {
  shell();
  rebuildProblems();
  PV.init();
  const pid = LS.get('aj.pid', null);
  PV.open(problemById(pid) ? pid : S.problems[0].id);
  setView(LS.get('aj.view', 'problems') === 'play' ? 'play' : 'problems');
  updateChrome();
  const store = await AJ.createStore();
  S.store = store;
  store.on('problems', list => {
    S.custom = list || [];
    rebuildProblems();
    if (!problemById(S.pid)) PV.open(S.problems[0].id);
    else if (!problemById(S.pid).builtin) PV.renderStatement(problemById(S.pid));
    PV.renderPicker();
    if (S.view === 'author') AV.list();
    if (S.view === 'grades') GV.table();
  });
  store.on('mine', m => { S.mine = m || {}; PV.refreshStatus(); });
  try { await store.init(); } catch (e) { console.error(e); store.error = '初始化失敗：' + e.message; }
  S.profile = store.profile || S.profile;
  const want = LS.get('aj.view', 'problems');
  if ((want === 'grades' || want === 'author') && (store.isTeacher || store.mode === 'sheet')) setView(want);
  else if (S.view === 'grades' || S.view === 'author') setView('problems');
  updateChrome();
  if (pid && problemById(pid) && pid !== S.pid) PV.open(pid);
}
AJ.boot = boot;
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})(window);
