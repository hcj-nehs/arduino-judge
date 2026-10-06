/* 實驗桌：UNO 板、元件卡片、即時模擬、波形圖 */
(function (G) {
'use strict';
const AJ = G.AJ = G.AJ || {};
const esc = s => AJ.esc(s);
let UID = 0;

const TOP_PINS = [['GND', null], ['13', 13], ['12', 12], ['~11', 11], ['~10', 10], ['~9', 9], ['8', 8], null,
  ['7', 7], ['~6', 6], ['~5', 5], ['4', 4], ['~3', 3], ['2', 2], ['TX 1', 1], ['RX 0', 0]];
const BOT_PINS = [['5V', null], ['GND', null], ['GND', null], ['VIN', null], null, ['A0', 14], ['A1', 15], ['A2', 16], ['A3', 17], ['A4', 18], ['A5', 19]];

function boardSVG(uid) {
  let pins = '';
  let x = 140;
  for (const p of TOP_PINS) {
    if (!p) { x += 10; continue; }
    const id = p[1] == null ? '' : ` id="${uid}-p${p[1]}" data-pin="${p[1]}"`;
    pins += `<rect class="pin-rect"${id} x="${x - 5}" y="11" width="10" height="10" rx="1.5"/>`;
    pins += `<text class="silk" x="${x}" y="33" text-anchor="middle">${p[0].replace('TX ', '').replace('RX ', '')}</text>`;
    x += 15;
  }
  x = 170;
  for (const p of BOT_PINS) {
    if (!p) { x += 14; continue; }
    const id = p[1] == null ? '' : ` id="${uid}-p${p[1]}" data-pin="${p[1]}"`;
    pins += `<rect class="pin-rect"${id} x="${x - 5}" y="229" width="10" height="10" rx="1.5"/>`;
    pins += `<text class="silk" x="${x}" y="222" text-anchor="middle">${p[0]}</text>`;
    x += 15;
  }
  return `<svg viewBox="0 0 400 250" role="img" aria-label="Arduino UNO 電路板，亮起的腳位代表輸出 HIGH">
  <rect x="2" y="2" width="396" height="246" rx="12" fill="var(--pcb)"/>
  <rect x="2" y="2" width="396" height="246" rx="12" fill="none" stroke="var(--pcb-dark)" stroke-width="3"/>
  <circle cx="20" cy="232" r="5" fill="var(--pcb-dark)"/><circle cx="372" cy="22" r="5" fill="var(--pcb-dark)"/><circle cx="380" cy="230" r="5" fill="var(--pcb-dark)"/>
  <rect x="-2" y="40" width="54" height="46" rx="3" fill="#c5ccd0" stroke="#8d979c"/>
  <rect x="-2" y="168" width="46" height="44" rx="4" fill="#23282b"/>
  <rect x="130" y="6" width="${TOP_PINS.length * 15 + 12}" height="20" rx="2" fill="#15191b"/>
  <rect x="160" y="224" width="${BOT_PINS.length * 15 + 8}" height="20" rx="2" fill="#15191b"/>
  ${pins}
  <rect x="160" y="150" width="188" height="34" rx="3" fill="#16191b"/>
  <text class="silk" x="254" y="171" text-anchor="middle" fill-opacity=".7">ATmega328P</text>
  <text class="silk big" x="250" y="112" text-anchor="middle">UNO</text>
  <text class="silk" x="250" y="126" text-anchor="middle" fill-opacity=".75">SIMULATOR</text>
  <g font-size="7">
    <rect id="${uid}-L" x="96" y="44" width="12" height="7" rx="1.5" fill="#3b2c12"/><text class="silk" x="112" y="50">L</text>
    <rect id="${uid}-TX" x="96" y="58" width="12" height="7" rx="1.5" fill="#3b2c12"/><text class="silk" x="112" y="64">TX</text>
    <rect id="${uid}-RX" x="96" y="72" width="12" height="7" rx="1.5" fill="#3b2c12"/><text class="silk" x="112" y="78">RX</text>
    <rect id="${uid}-ON" x="352" y="100" width="12" height="7" rx="1.5" fill="#13361f"/><text class="silk" x="352" y="118">ON</text>
  </g>
  <circle cx="70" cy="22" r="8" fill="#c9cfd2"/><circle cx="70" cy="22" r="5" fill="#d84b3a"/>
</svg>`;
}

const LED_COLORS = { red: '#ff3b30', green: '#2fd158', yellow: '#ffcc00', blue: '#2f7bff', white: '#f2f6ff', orange: '#ff8a00' };
const TYPE_NAMES = { led: 'LED', rgb: 'RGB LED', button: '按鈕', switch: '開關', pot: '可變電阻', ldr: '光敏電阻', buzzer: '蜂鳴器', servo: '伺服馬達', ws2812: 'WS2812B 燈條' };
AJ.TYPE_NAMES = TYPE_NAMES;
AJ.LED_COLORS = LED_COLORS;

function pinsOf(c) {
  if (c.type === 'rgb') return [c.r, c.g, c.b];
  return [c.pin];
}
AJ.pinsOf = pinsOf;
function pinChips(c) {
  if (c.type === 'rgb') return `<span class="pin-chip">R ${AJ.pinName(c.r)}</span><span class="pin-chip">G ${AJ.pinName(c.g)}</span><span class="pin-chip">B ${AJ.pinName(c.b)}</span>`;
  return `<span class="pin-chip">${AJ.pinName(c.pin)}</span>`;
}
function wiringText(c) {
  if (c.type === 'button' || c.type === 'switch') return c.wiring === 'pulldown' ? '接 5V，另有下拉電阻（按下＝HIGH）' : '接 GND（請用 INPUT_PULLUP，按下＝LOW）';
  if (c.type === 'rgb') return '共陰極，HIGH 亮';
  if (c.type === 'led') return '串聯電阻接 GND，HIGH 亮';
  if (c.type === 'pot') return '中間腳接類比腳位，讀值 0~1023';
  if (c.type === 'ldr') return '分壓電路，越亮讀值越大';
  if (c.type === 'buzzer') return '無源蜂鳴器，用 tone() 發聲';
  if (c.type === 'servo') return '訊號線，使用 Servo 函式庫';
  if (c.type === 'ws2812') return `${c.count} 顆燈珠，使用 Adafruit_NeoPixel 函式庫`;
  return '';
}
AJ.pinChips = pinChips;
AJ.wiringText = wiringText;

/* -------------------------------------------------------- 元件卡片 */
function makePart(c, ctl) {
  const u = 'pt' + (++UID);
  const el = document.createElement('div');
  el.className = 'part' + (c.type === 'ws2812' && (c.shape !== 'ring') ? ' wide' : '');
  el.dataset.pins = pinsOf(c).join(',');
  const label = `<div class="nm" title="${esc(c.label || c.id)}">${esc(c.label || TYPE_NAMES[c.type])}</div><div class="pins">${pinChips(c)}</div>`;
  const removeBtn = ctl.editable ? `<button class="x" title="移除這個元件" aria-label="移除 ${esc(c.label || c.id)}">×</button>` : '';
  let update = () => {};
  const st = ctl.state(c.id);
  if (c.type === 'led' || c.type === 'rgb') {
    const col = LED_COLORS[c.color] || LED_COLORS.red;
    el.innerHTML = `${removeBtn}<svg class="vis" viewBox="0 0 84 84" aria-hidden="true">
      <defs><radialGradient id="${u}g"><stop offset="0" stop-color="${col}" stop-opacity=".9"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></radialGradient></defs>
      <circle class="glow" cx="42" cy="36" r="34" fill="url(#${u}g)" opacity="0"/>
      <line x1="36" y1="58" x2="36" y2="82" stroke="#9aa3a6" stroke-width="2.4"/><line x1="48" y1="58" x2="48" y2="78" stroke="#9aa3a6" stroke-width="2.4"/>
      <rect x="25" y="52" width="34" height="8" rx="2" fill="${c.type === 'rgb' ? '#dfe4e6' : col}" fill-opacity=".55"/>
      <path class="dome" d="M27 55 V35 a15 15 0 0 1 30 0 V55 Z" fill="${c.type === 'rgb' ? '#e8ecee' : col}" fill-opacity=".3" stroke="rgba(0,0,0,.25)"/>
      <ellipse cx="36" cy="32" rx="3.5" ry="7" fill="#fff" opacity=".55"/>
    </svg>${label}`;
    const glow = el.querySelector('.glow'), dome = el.querySelector('.dome'), grad = el.querySelectorAll('stop');
    if (c.type === 'led') {
      update = s => {
        const P = s.pins[c.pin];
        let lv = P.level;
        if (P.mode === 0 && P.pull) lv = 0.08;
        glow.setAttribute('opacity', (lv * 0.85).toFixed(3));
        dome.setAttribute('fill-opacity', (0.3 + 0.7 * lv).toFixed(3));
      };
    } else {
      update = s => {
        const lv = k => { const P = s.pins[k]; return P.mode === 0 && P.pull ? 0.08 : P.level; };
        const r = lv(c.r), g = lv(c.g), b = lv(c.b);
        const m = Math.max(r, g, b);
        const rgb = m > 0 ? `rgb(${Math.round(255 * Math.sqrt(r / m))},${Math.round(255 * Math.sqrt(g / m))},${Math.round(255 * Math.sqrt(b / m))})` : '#e8ecee';
        dome.setAttribute('fill', rgb);
        dome.setAttribute('fill-opacity', (0.3 + 0.7 * m).toFixed(3));
        grad[0].setAttribute('stop-color', rgb); grad[1].setAttribute('stop-color', rgb);
        glow.setAttribute('opacity', (m * 0.85).toFixed(3));
      };
    }
  } else if (c.type === 'button') {
    el.innerHTML = `${removeBtn}<button class="pushbtn" aria-label="按住「${esc(c.label || c.id)}」" aria-pressed="false"><svg class="vis" viewBox="0 0 84 84" aria-hidden="true">
      <line x1="18" y1="22" x2="6" y2="22" stroke="#9aa3a6" stroke-width="3"/><line x1="66" y1="22" x2="78" y2="22" stroke="#9aa3a6" stroke-width="3"/>
      <line x1="18" y1="62" x2="6" y2="62" stroke="#9aa3a6" stroke-width="3"/><line x1="66" y1="62" x2="78" y2="62" stroke="#9aa3a6" stroke-width="3"/>
      <rect x="16" y="14" width="52" height="56" rx="6" fill="#2b3134"/>
      <circle cx="22" cy="20" r="2.5" fill="#596266"/><circle cx="62" cy="20" r="2.5" fill="#596266"/><circle cx="22" cy="64" r="2.5" fill="#596266"/><circle cx="62" cy="64" r="2.5" fill="#596266"/>
      <circle class="cap" cx="42" cy="42" r="16" fill="#d8453a" stroke="#8e2a22" stroke-width="2"/>
    </svg></button>${label}<div class="val">按住滑鼠＝按下</div>`;
    const btn = el.querySelector('.pushbtn'), cap = el.querySelector('.cap');
    const set = on => { st.active = on; ctl.input(c.id, { active: on }); btn.setAttribute('aria-pressed', on); render(); };
    const render = () => { cap.setAttribute('r', st.active ? 13.5 : 16); cap.setAttribute('fill', st.active ? '#a5291f' : '#d8453a'); };
    btn.addEventListener('pointerdown', e => { e.preventDefault(); btn.setPointerCapture(e.pointerId); set(true); });
    btn.addEventListener('pointerup', () => set(false));
    btn.addEventListener('pointercancel', () => set(false));
    btn.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) { e.preventDefault(); set(true); } });
    btn.addEventListener('keyup', e => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); set(false); } });
    render();
    update = () => render();
  } else if (c.type === 'switch') {
    el.innerHTML = `${removeBtn}<button class="pushbtn" aria-label="切換「${esc(c.label || c.id)}」" aria-pressed="false"><svg class="vis" viewBox="0 0 84 84" aria-hidden="true">
      <rect x="10" y="28" width="64" height="28" rx="6" fill="#2b3134"/>
      <rect class="knob" x="14" y="31" width="28" height="22" rx="4" fill="#cfd5d8"/>
      <line x1="24" y1="56" x2="24" y2="76" stroke="#9aa3a6" stroke-width="3"/><line x1="42" y1="56" x2="42" y2="76" stroke="#9aa3a6" stroke-width="3"/><line x1="60" y1="56" x2="60" y2="76" stroke="#9aa3a6" stroke-width="3"/>
      <text x="16" y="22" font-size="9" fill="var(--muted)">OFF</text><text x="56" y="22" font-size="9" fill="var(--muted)">ON</text>
    </svg></button>${label}<div class="val"></div>`;
    const btn = el.querySelector('.pushbtn'), knob = el.querySelector('.knob'), val = el.querySelector('.val');
    const render = () => { knob.setAttribute('x', st.active ? 42 : 14); val.textContent = st.active ? '開（ON）' : '關（OFF）'; btn.setAttribute('aria-pressed', !!st.active); };
    btn.addEventListener('click', () => { st.active = !st.active; ctl.input(c.id, { active: st.active }); render(); });
    render();
    update = () => render();
  } else if (c.type === 'pot' || c.type === 'ldr') {
    const isPot = c.type === 'pot';
    el.innerHTML = `${removeBtn}<svg class="vis" viewBox="0 0 84 84" aria-hidden="true">${isPot
      ? `<rect x="14" y="14" width="56" height="56" rx="8" fill="#1f5ea8"/><circle cx="42" cy="42" r="20" fill="#e9edf0" stroke="#9aa3a6"/>
         <g class="knob"><rect x="40" y="24" width="4" height="16" rx="2" fill="#33393c"/></g>
         <line x1="30" y1="70" x2="30" y2="82" stroke="#9aa3a6" stroke-width="3"/><line x1="42" y1="70" x2="42" y2="82" stroke="#9aa3a6" stroke-width="3"/><line x1="54" y1="70" x2="54" y2="82" stroke="#9aa3a6" stroke-width="3"/>`
      : `<circle class="sky" cx="42" cy="38" r="30" fill="#ffd34d" opacity=".4"/><circle cx="42" cy="38" r="17" fill="#e8c9a0" stroke="#9c7a4c"/>
         <path d="M31 33 h22 M31 38 h22 M31 43 h22" stroke="#b5402f" stroke-width="2" fill="none"/>
         <line x1="36" y1="55" x2="36" y2="82" stroke="#9aa3a6" stroke-width="2.4"/><line x1="48" y1="55" x2="48" y2="82" stroke="#9aa3a6" stroke-width="2.4"/>`}
    </svg>${label}<input type="range" min="0" max="1023" step="1" aria-label="${esc(c.label || c.id)} 的數值" id="${u}-r"><div class="val"></div>`;
    const range = el.querySelector('input'), val = el.querySelector('.val'), knob = el.querySelector('.knob'), sky = el.querySelector('.sky');
    if (st.value == null) st.value = c.value != null ? c.value : 512;
    const render = () => {
      range.value = st.value;
      val.textContent = `${isPot ? '' : (st.value < 300 ? '暗 ' : st.value > 700 ? '亮 ' : '')}讀值 ${st.value}`;
      if (knob) knob.setAttribute('transform', `rotate(${-135 + 270 * st.value / 1023} 42 42)`);
      if (sky) sky.setAttribute('opacity', (0.05 + 0.75 * st.value / 1023).toFixed(2));
    };
    range.addEventListener('input', () => { st.value = +range.value; ctl.input(c.id, { value: st.value }); render(); });
    render();
    update = () => {};
  } else if (c.type === 'buzzer') {
    el.innerHTML = `${removeBtn}<svg class="vis" viewBox="0 0 84 84" aria-hidden="true">
      <g class="rings" opacity="0"><circle class="sound-ring" cx="42" cy="42" r="34" fill="none" stroke="var(--accent)" stroke-width="2"/></g>
      <circle cx="42" cy="42" r="25" fill="#1d2123" stroke="#3e4549" stroke-width="2"/><circle cx="42" cy="42" r="5" fill="#000"/>
      <text x="42" y="25" text-anchor="middle" font-size="8" fill="#8a9396">+</text>
    </svg>${label}<div class="val">安靜</div>`;
    const rings = el.querySelector('.rings'), val = el.querySelector('.val');
    update = s => {
      const f = s.tones[c.pin] || 0;
      const active = f > 0 || s.pins[c.pin].level === 1;
      rings.setAttribute('opacity', active ? 1 : 0);
      val.textContent = f > 0 ? `${f} Hz` : (active ? '嗶（HIGH）' : '安靜');
      ctl.sound(c.pin, f);
    };
  } else if (c.type === 'servo') {
    el.innerHTML = `${removeBtn}<svg class="vis" viewBox="0 0 84 84" aria-hidden="true">
      <rect x="14" y="30" width="56" height="34" rx="4" fill="#2a66cc"/><rect x="8" y="40" width="68" height="6" rx="2" fill="#2a66cc"/>
      <circle cx="42" cy="38" r="9" fill="#e9edf0"/>
      <g class="horn"><path d="M42 33 L74 36 Q77 38 74 40 L42 43 Z" fill="#f5f7f8" stroke="#9aa3a6"/><circle cx="42" cy="38" r="5" fill="#f5f7f8" stroke="#9aa3a6"/></g>
    </svg>${label}<div class="val">未連接</div>`;
    const horn = el.querySelector('.horn'), val = el.querySelector('.val');
    update = s => {
      const a = s.servos[c.pin];
      horn.setAttribute('transform', `rotate(${-(a == null ? 90 : a)} 42 38)`);
      val.textContent = a == null ? '未 attach' : `${a}°`;
    };
  } else if (c.type === 'ws2812') {
    const n = c.count || 8;
    const ring = c.shape === 'ring';
    let dots = '';
    if (ring) {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + i * 2 * Math.PI / n;
        dots += `<circle class="px" cx="${(42 + 32 * Math.cos(a)).toFixed(1)}" cy="${(42 + 32 * Math.sin(a)).toFixed(1)}" r="${Math.min(6, 90 / n).toFixed(1)}" fill="#1d2326"/>`;
      }
      el.innerHTML = `${removeBtn}<svg class="vis" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="38" fill="#14181a"/><circle cx="42" cy="42" r="25" fill="var(--surface)"/>${dots}</svg>${label}`;
    } else {
      for (let i = 0; i < n; i++) dots += `<rect x="${6 + i * 22}" y="8" width="18" height="18" rx="2" fill="#f1f3f4"/><circle class="px" cx="${15 + i * 22}" cy="17" r="6" fill="#1d2326"/><text x="${15 + i * 22}" y="36" text-anchor="middle" font-size="7" fill="var(--muted)">${i}</text>`;
      el.innerHTML = `${removeBtn}<svg class="vis" viewBox="0 0 ${n * 22 + 8} 40" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><rect x="0" y="4" width="${n * 22 + 8}" height="26" rx="3" fill="#14181a"/>${dots}</svg>${label}`;
    }
    const px = el.querySelectorAll('.px');
    let lastFrame = null;
    update = s => {
      const f = s.pixels[c.pin];
      if (f === lastFrame) return;
      lastFrame = f;
      px.forEach((d, i) => {
        const v = f && i < f.length ? f[i] : 0;
        if (!v) { d.setAttribute('fill', '#1d2326'); return; }
        const r = (v >>> 16) & 255, g = (v >>> 8) & 255, b = v & 255;
        const k = x => Math.round(255 * Math.sqrt(x / 255));
        d.setAttribute('fill', `rgb(${k(r)},${k(g)},${k(b)})`);
      });
    };
  }
  if (ctl.editable) el.querySelector('.x').addEventListener('click', () => ctl.remove(c.id));
  el.addEventListener('mouseenter', () => ctl.hover(pinsOf(c), true));
  el.addEventListener('mouseleave', () => ctl.hover(pinsOf(c), false));
  return { el, update };
}

/* -------------------------------------------------------- 實驗桌 */
class Bench {
  constructor(host, opts) {
    this.opts = opts || {};
    this.uid = 'b' + (++UID);
    host.innerHTML = `<div class="bench"><div class="board-wrap">${boardSVG(this.uid)}</div><div class="parts"></div><div class="warns"></div></div>`;
    this.root = host.firstElementChild;
    this.partsEl = this.root.querySelector('.parts');
    this.warnsEl = this.root.querySelector('.warns');
    this.pinEls = {};
    for (let p = 0; p < 20; p++) this.pinEls[p] = this.root.querySelector(`#${this.uid}-p${p}`);
    this.L = this.root.querySelector(`#${this.uid}-L`);
    this.TX = this.root.querySelector(`#${this.uid}-TX`);
    this.ON = this.root.querySelector(`#${this.uid}-ON`);
    this.states = {};
    this.parts = [];
    this.audio = null; this.osc = {}; this.soundOn = false;
    this.idle = Bench.idleSnapshot();
  }
  static idleSnapshot() {
    const pins = [];
    for (let i = 0; i < 20; i++) pins.push({ mode: 0, pull: 0, level: 0, out: 0, pwm: -1 });
    return { pins, tones: {}, servos: {}, pixels: {}, t: 0, txAt: -1e9 };
  }
  state(id) { return this.states[id] || (this.states[id] = {}); }
  setCircuit(circuit) {
    this.circuit = circuit || [];
    const keep = {};
    for (const c of this.circuit) {
      const old = this.states[c.id];
      keep[c.id] = old || (c.type === 'pot' || c.type === 'ldr' ? { value: c.value != null ? c.value : 512 } : { active: !!c.initial });
    }
    this.states = keep;
    this.partsEl.innerHTML = '';
    const used = new Set();
    const ctl = {
      editable: !!this.opts.editable,
      state: id => this.state(id),
      input: (id, patch) => { if (this.opts.onInput) this.opts.onInput(id, patch); },
      remove: id => { if (this.opts.onRemove) this.opts.onRemove(id); },
      hover: (pins, on) => pins.forEach(p => this.pinEls[p] && this.pinEls[p].classList.toggle('hover', on)),
      sound: (pin, f) => this.sound(pin, f),
    };
    this.parts = this.circuit.map(c => { const p = makePart(c, ctl); this.partsEl.appendChild(p.el); pinsOf(c).forEach(x => used.add(x)); return p; });
    if (!this.circuit.length) this.partsEl.innerHTML = `<div class="empty" style="grid-column:1/-1">${this.opts.emptyText || '這題沒有外接元件，請看序列埠的輸出'}</div>`;
    for (let p = 0; p < 20; p++) if (this.pinEls[p]) { this.pinEls[p].classList.toggle('used', used.has(p)); this.pinEls[p].classList.remove('hover'); }
    this.update(this.idle, false);
  }
  update(s, running) {
    for (let p = 0; p < 20; p++) {
      const el = this.pinEls[p];
      if (!el) continue;
      const P = s.pins[p];
      if (P.mode === 1 && P.level > 0) { el.style.fill = P.level >= 1 ? '#ff5a3c' : `rgba(255,90,60,${(0.25 + 0.75 * P.level).toFixed(2)})`; el.classList.remove('pu'); }
      else { el.style.fill = ''; el.classList.toggle('pu', P.mode === 0 && !!P.pull); }
    }
    const l13 = s.pins[13];
    this.L.setAttribute('fill', l13.mode === 1 && l13.level > 0 ? `rgba(255,176,32,${Math.max(0.3, l13.level)})` : '#3b2c12');
    this.TX.setAttribute('fill', running && s.t - s.txAt < 60000 ? '#ffb020' : '#3b2c12');
    this.ON.setAttribute('fill', running ? '#39d36b' : '#13361f');
    for (const p of this.parts) p.update(s);
  }
  setWarnings(list, onClick) {
    this.warnsEl.innerHTML = '';
    for (const w of list) {
      const b = document.createElement('button');
      b.className = 'warn';
      b.textContent = (w.line ? `第 ${w.line} 行附近：` : '') + w.msg;
      b.addEventListener('click', () => onClick && onClick(w.line));
      this.warnsEl.appendChild(b);
    }
  }
  setError(msg) {
    let e = this.root.querySelector('.runerr');
    if (!msg) { if (e) e.remove(); return; }
    if (!e) { e = document.createElement('div'); e.className = 'runerr'; this.root.appendChild(e); }
    e.textContent = msg;
  }
  enableSound(on) {
    this.soundOn = on;
    if (on && !this.audio) {
      try { this.audio = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { this.audio = null; }
    }
    if (!on) this.silence();
  }
  sound(pin, f) {
    if (!this.soundOn || !this.audio) return;
    let o = this.osc[pin];
    if (f > 0) {
      if (!o) {
        const osc = this.audio.createOscillator(), gain = this.audio.createGain();
        osc.type = 'square'; gain.gain.value = 0.04;
        osc.connect(gain).connect(this.audio.destination);
        osc.start();
        o = this.osc[pin] = { osc, gain };
      }
      o.osc.frequency.setValueAtTime(f, this.audio.currentTime);
    } else if (o) { o.osc.stop(); delete this.osc[pin]; }
  }
  silence() { for (const k in this.osc) { try { this.osc[k].osc.stop(); } catch (e) { /* 已停止 */ } } this.osc = {}; }
}
AJ.Bench = Bench;

/* -------------------------------------------------------- 即時模擬 */
class SimRunner {
  constructor(bench, hooks) {
    this.bench = bench; this.hooks = hooks || {};
    this.M = null; this.raf = 0; this.running = false;
  }
  start(code, circuit) {
    this.stop();
    const M = new AJ.Machine(circuit, {
      onSerial: t => this.hooks.onSerial && this.hooks.onSerial(t),
      onWarn: () => this.hooks.onWarn && this.hooks.onWarn(M.warnings),
    });
    for (const c of M.comps) {
      const st = this.bench.states[c.id];
      if (st) Object.assign(c.state, st.value != null ? { value: st.value } : { active: !!st.active });
    }
    try { M.load(code); } catch (e) {
      if (e instanceof AJ.CompileError) return { ce: e };
      throw e;
    }
    this.M = M; this.running = true;
    this.clock = 0; this.last = performance.now();
    const tick = now => {
      if (!this.running) return;
      const dt = Math.min(100, Math.max(0, now - this.last));
      this.last = now;
      this.clock += dt * 1000;
      const t0 = performance.now();
      M.wallStart = t0; M.wallLimit = 1500;
      M.runUntil(this.clock);
      if (M.t > this.clock + 5e6 && !M.done) { /* 很長的 delay：時鐘正常前進即可 */ }
      this.bench.update(M.snapshot(), true);
      if (this.hooks.onTick) this.hooks.onTick(Math.min(M.t, this.clock));
      if (M.error) {
        this.running = false;
        this.bench.silence();
        if (this.hooks.onError) this.hooks.onError(M.error);
        return;
      }
      this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
    return { ok: true };
  }
  input(id, patch) {
    if (!this.M) return;
    const c = this.M.byId[id];
    if (c) Object.assign(c.state, patch);
  }
  send(text) { if (this.M && this.running) this.M.serialFeed(text); }
  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    this.bench.silence();
    if (this.M) this.bench.update(Bench.idleSnapshot(), false);
    this.M = null;
  }
}
AJ.SimRunner = SimRunner;

/* -------------------------------------------------------- 波形圖 */
function stepPath(series, kind, dur, x, y, scaleMax) {
  const val = v => kind === 'pin' ? v : kind === 'servo' ? (v == null ? 0 : v / 180) : (scaleMax ? Math.min(1, v / scaleMax) : (v ? 1 : 0));
  let v0 = kind === 'servo' ? null : 0;
  let d = `M${x(0).toFixed(1)} ${y(val(v0)).toFixed(1)}`;
  for (const [t, v] of series) {
    if (t > dur) break;
    d += ` H${x(t).toFixed(1)} V${y(val(v)).toFixed(1)}`;
  }
  return d + ` H${x(dur).toFixed(1)}`;
}
AJ.renderWave = function (rows, dur, markT) {
  const W = 640, rowH = 40, top = 8, left = 118, right = 10;
  const H = top + rows.length * rowH + 22;
  const x = t => left + (W - left - right) * t / dur;
  let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="輸出波形比較">`;
  const step = dur <= 2000 ? 250 : dur <= 5000 ? 500 : dur <= 12000 ? 1000 : 2000;
  for (let t = 0; t <= dur + 1; t += step) {
    s += `<line x1="${x(t)}" x2="${x(t)}" y1="${top}" y2="${H - 18}" stroke="var(--line)" stroke-width="1"/>`;
    s += `<text x="${x(t)}" y="${H - 5}" font-size="10" text-anchor="middle" fill="var(--muted)" font-family="var(--font-code)">${(t / 1000).toFixed(step < 1000 ? 2 : 0)}s</text>`;
  }
  rows.forEach((r, i) => {
    const base = top + i * rowH + rowH - 8, hgt = rowH - 16;
    const y = v => base - v * hgt;
    let maxF = 0;
    if (r.kind === 'tone') for (const sr of [r.exp || [], r.act || []]) for (const [, v] of sr) maxF = Math.max(maxF, v);
    s += `<text x="${left - 8}" y="${base - hgt / 2 + 4}" font-size="11" text-anchor="end" fill="var(--ink)">${esc(r.label)}</text>`;
    s += `<line x1="${left}" x2="${W - right}" y1="${base}" y2="${base}" stroke="var(--line)"/>`;
    if (r.exp) s += `<path d="${stepPath(r.exp, r.kind, dur, x, y, maxF)}" fill="none" stroke="var(--primary)" stroke-opacity=".35" stroke-width="7" stroke-linejoin="round"/>`;
    if (r.act) s += `<path d="${stepPath(r.act, r.kind, dur, x, y, maxF)}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linejoin="round"/>`;
  });
  if (markT != null) s += `<line x1="${x(markT)}" x2="${x(markT)}" y1="${top}" y2="${H - 18}" stroke="var(--wa)" stroke-dasharray="4 3" stroke-width="1.5"/>`;
  return s + '</svg>';
};
})(typeof window !== 'undefined' ? window : globalThis);
