/* 判題：執行測資、擷取輸出軌跡、與標準答案比對 */
(function (G) {
'use strict';
const AJ = G.AJ = G.AJ || {};

const KIND_ALIAS = {
  press: 'press', '按下': 'press', release: 'release', '放開': 'release', toggle: 'toggle', '切換': 'toggle',
  set: 'set', '設定': 'set', serial: 'serial', '輸入': 'serial',
};

/* 測資事件格式（每行一個，時間單位：毫秒）
 *   500 press btn1      在 0.5 秒按下 btn1
 *   1500 release btn1
 *   0 set pot1 512      可變電阻／光敏電阻設為 512
 *   0 serial 3 5\n      從序列埠送入文字（\n 代表換行）
 */
function parseEvents(text) {
  const events = [], errors = [];
  (text || '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#') || line.startsWith('//')) return;
    const m = /^(\d+(?:\.\d+)?)\s+(\S+)\s*(.*)$/.exec(line);
    if (!m) { errors.push(`第 ${i + 1} 行看不懂：${line}`); return; }
    const t = Math.round(parseFloat(m[1]) * 1000);
    const kind = KIND_ALIAS[m[2]] || KIND_ALIAS[m[2].toLowerCase()];
    if (!kind) { errors.push(`第 ${i + 1} 行：不認得的動作「${m[2]}」（可用 press / release / toggle / set / serial）`); return; }
    if (kind === 'serial') {
      const txt = m[3].replace(/\\(n|r|t|\\)/g, (_, c) => ({ n: '\n', r: '\r', t: '\t', '\\': '\\' }[c]));
      events.push({ t, kind, text: txt });
      return;
    }
    const parts = m[3].split(/\s+/).filter(Boolean);
    if (!parts[0]) { errors.push(`第 ${i + 1} 行：缺少元件代號`); return; }
    const ev = { t, kind, comp: parts[0] };
    if (kind === 'set') {
      if (parts[1] === undefined || isNaN(+parts[1])) { errors.push(`第 ${i + 1} 行：set 需要數值，例如 0 set pot1 512`); return; }
      ev.value = +parts[1];
    }
    events.push(ev);
  });
  events.sort((a, b) => a.t - b.t);
  return { events, errors };
}

function describeEvents(text, circuit) {
  const { events } = parseEvents(text);
  const name = id => { const c = (circuit || []).find(x => x.id === id); return c ? `${c.label || c.id}` : id; };
  return events.map(e => {
    const ts = `${(e.t / 1e6).toFixed(e.t % 1e5 ? 2 : 1)} 秒`;
    if (e.kind === 'serial') return { t: ts, what: '序列埠送入', detail: JSON.stringify(e.text).slice(1, -1) };
    if (e.kind === 'press') return { t: ts, what: `按下「${name(e.comp)}」`, detail: '' };
    if (e.kind === 'release') return { t: ts, what: `放開「${name(e.comp)}」`, detail: '' };
    if (e.kind === 'toggle') return { t: ts, what: `切換「${name(e.comp)}」`, detail: '' };
    return { t: ts, what: `「${name(e.comp)}」設為`, detail: String(e.value) };
  });
}

const keyOf = c => c.kind === 'serial' ? 'serial' : `${c.kind}:${c.pin}`;
const r3 = x => Math.round(x * 1000) / 1000;

function runCase(src, circuit, tc, opts) {
  opts = opts || {};
  const { events, errors } = parseEvents(tc.events);
  if (errors.length) throw new Error('測資格式錯誤：' + errors.join('；'));
  const M = new AJ.Machine(circuit, { events, wallLimit: opts.wallLimit || 4000, outLimit: opts.outLimit || 60000 });
  try { M.load(src); } catch (e) {
    if (e instanceof AJ.CompileError) return { ce: e };
    throw e;
  }
  M.runUntil((tc.duration || 3000) * 1000);
  return { M, error: M.error };
}

function extract(M, compare, durMs) {
  const out = {};
  const lim = durMs * 1000;
  for (const c of compare) {
    const key = keyOf(c);
    if (c.kind === 'serial') { out[key] = M.serial.out; continue; }
    if (c.kind === 'pin') out[key] = (M.trace.pins[c.pin] || []).filter(e => e[0] <= lim).map(([t, v]) => [r3(t / 1000), Math.round(v * 1000) / 1000]);
    else if (c.kind === 'servo') out[key] = (M.trace.servo[c.pin] || []).filter(e => e[0] <= lim).map(([t, v]) => [r3(t / 1000), v]);
    else if (c.kind === 'pixels') out[key] = (M.trace.pixels[c.pin] || []).filter(e => e[0] <= lim).map(([t, v]) => [r3(t / 1000), v]);
    else if (c.kind === 'tone') {
      const src = M.trace.tone[c.pin] || [];
      const res = [];
      src.forEach(([t, f, end], i) => {
        if (t > lim) return;
        res.push([r3(t / 1000), f]);
        const nx = src[i + 1];
        if (isFinite(end) && end <= lim && (!nx || nx[0] > end)) res.push([r3(end / 1000), 0]);
      });
      // 合併相同數值
      out[key] = res.filter((e, i) => i === 0 || e[1] !== res[i - 1][1]);
    }
  }
  return out;
}

function defaultOf(kind) { return kind === 'servo' ? null : kind === 'pixels' ? [] : 0; }
function valueAt(series, t, kind) {
  let lo = 0, hi = series.length - 1, ans = -1;
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (series[mid][0] <= t) { ans = mid; lo = mid + 1; } else hi = mid - 1; }
  return ans < 0 ? defaultOf(kind) : series[ans][1];
}
function eqVal(kind, a, b) {
  if (kind === 'pin') return Math.abs(a - b) <= 0.01;
  if (kind === 'servo') return (a === null || b === null) ? a === b : Math.abs(a - b) <= 2;
  if (kind === 'tone') return Math.abs(a - b) <= 2;
  if (kind === 'pixels') {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++) {
      const x = a[i] || 0, y = b[i] || 0;
      for (const sh of [16, 8, 0]) if (Math.abs(((x >>> sh) & 255) - ((y >>> sh) & 255)) > 4) return false;
    }
    return true;
  }
  return a === b;
}
function anyIn(series, a, b, kind, target) {
  if (eqVal(kind, valueAt(series, a, kind), target)) return true;
  for (const [t, v] of series) { if (t > b) break; if (t > a && eqVal(kind, v, target)) return true; }
  return false;
}
function compareSeries(kind, exp, act, durMs, tol, step) {
  const times = new Set();
  const end = durMs - tol;
  for (let s = step; s <= end; s += step) times.add(r3(s));
  for (const [t] of exp) if (t + 1 <= end) times.add(r3(t + 1));
  for (const [t] of act) if (t + 1 <= end) times.add(r3(t + 1));
  const sorted = [...times].sort((x, y) => x - y);
  for (const s of sorted) {
    const a = valueAt(act, s, kind), e = valueAt(exp, s, kind);
    if (eqVal(kind, a, e)) continue;
    if (anyIn(exp, s - tol, s + tol, kind, a) && anyIn(act, s - tol, s + tol, kind, e)) continue;
    return { t: s, exp: e, act: a };
  }
  return null;
}

function normLines(s) {
  const lines = s.replace(/\r\n?/g, '\n').split('\n').map(l => l.replace(/[ \t]+$/, ''));
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}
const show = s => s.length > 60 ? s.slice(0, 60) + '…' : s;
function compareSerial(exp, act, mode) {
  if (mode === 'tokens') {
    const e = exp.trim().split(/\s+/).filter(Boolean), a = act.trim().split(/\s+/).filter(Boolean);
    for (let i = 0; i < Math.max(e.length, a.length); i++) {
      if (e[i] !== a[i]) {
        if (a[i] === undefined) return `序列埠輸出太短：第 ${i + 1} 個項目應該是「${show(e[i])}」，但你的輸出已經結束`;
        if (e[i] === undefined) return `序列埠輸出多了東西：「${show(a[i])}」`;
        return `序列埠第 ${i + 1} 個項目應該是「${show(e[i])}」，你的是「${show(a[i])}」`;
      }
    }
    return null;
  }
  const e = normLines(exp), a = normLines(act);
  for (let i = 0; i < Math.max(e.length, a.length); i++) {
    if (e[i] !== a[i]) {
      if (a[i] === undefined) return `序列埠輸出太短：第 ${i + 1} 行應該是「${show(e[i])}」，但你的輸出只有 ${a.length} 行`;
      if (e[i] === undefined) return `序列埠輸出太多：第 ${i + 1} 行多了「${show(a[i])}」`;
      return `序列埠第 ${i + 1} 行應該是「${show(e[i])}」，你的是「${show(a[i])}」`;
    }
  }
  return null;
}

const hex = c => '#' + (c >>> 0).toString(16).padStart(6, '0').toUpperCase();
function descVal(kind, v) {
  if (kind === 'pin') return v === 1 ? 'HIGH' : v === 0 ? 'LOW' : `PWM ${Math.round(v * 255)}`;
  if (kind === 'servo') return v === null ? '尚未 attach' : `${v}°`;
  if (kind === 'tone') return v ? `${v} Hz` : '沒有聲音';
  return String(v);
}
function compLabel(circuit, c) {
  const pn = AJ.pinName(c.pin);
  for (const comp of circuit || []) {
    if (c.kind === 'pin') {
      if ((comp.type === 'led' || comp.type === 'buzzer') && comp.pin === c.pin) return `${comp.label || comp.id}（${pn}）`;
      if (comp.type === 'rgb') {
        const ch = comp.r === c.pin ? '紅' : comp.g === c.pin ? '綠' : comp.b === c.pin ? '藍' : null;
        if (ch) return `${comp.label || comp.id} 的${ch}色（${pn}）`;
      }
    } else if (comp.pin === c.pin) return `${comp.label || comp.id}（${pn}）`;
  }
  return pn;
}
function seriesMsg(c, diff, circuit) {
  const when = diff.t < 50 ? '一開機時' : `在 ${(diff.t / 1000).toFixed(2)} 秒左右`;
  const who = compLabel(circuit, c);
  if (c.kind === 'pixels') {
    const n = Math.max(diff.exp.length, diff.act.length);
    for (let i = 0; i < n; i++) {
      const x = diff.exp[i] || 0, y = diff.act[i] || 0;
      if (!eqVal('pixels', [x], [y])) return `${when}，${who} 第 ${i} 顆燈應該是 ${hex(x)}，你的是 ${hex(y)}`;
    }
  }
  return `${when}，${who} 應該是 ${descVal(c.kind, diff.exp)}，你的是 ${descVal(c.kind, diff.act)}`;
}

function compareCase(exp, act, problem) {
  const tol = problem.tol || 30, step = problem.step || 20;
  for (const c of problem.compare) {
    const key = keyOf(c);
    if (c.kind === 'serial') {
      const m = compareSerial(exp[key] || '', act[key] || '', c.mode);
      if (m) return { msg: m, key };
      continue;
    }
    const diff = compareSeries(c.kind, exp[key] || [], act[key] || [], problem._dur, tol, step);
    if (diff) return { msg: seriesMsg(c, diff, problem.circuit), t: diff.t, key };
  }
  return null;
}

function computeExpected(problem, solution) {
  const list = [];
  problem.cases.forEach((tc, i) => {
    const r = runCase(solution, problem.circuit, tc, { wallLimit: 8000 });
    if (r.ce) throw new Error(`參考解答編譯錯誤（第 ${r.ce.line} 行）：${r.ce.message}`);
    if (r.error) throw new Error(`參考解答在測資 ${i + 1} 執行錯誤（第 ${r.error.line} 行）：${r.error.message}`);
    list.push(extract(r.M, problem.compare, tc.duration));
  });
  return list;
}

const VERDICT = {
  AC: { name: '通過', en: 'Accepted' }, WA: { name: '答案錯誤', en: 'Wrong Answer' },
  CE: { name: '編譯錯誤', en: 'Compile Error' }, RE: { name: '執行錯誤', en: 'Runtime Error' },
  TLE: { name: '執行過久', en: 'Time Limit Exceeded' }, OLE: { name: '輸出過多', en: 'Output Limit Exceeded' },
};

async function judge(src, problem, expected, onCase) {
  const cases = [];
  for (let i = 0; i < problem.cases.length; i++) {
    const tc = problem.cases[i];
    await new Promise(r => setTimeout(r, 0));
    const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
    let res;
    const r = runCase(src, problem.circuit, tc);
    if (r.ce) return { verdict: 'CE', score: 0, cases: [], ce: { line: r.ce.line, msg: r.ce.message } };
    if (r.error) {
      res = { verdict: r.error.kind, msg: (r.error.line ? `第 ${r.error.line} 行：` : '') + r.error.message };
    } else {
      const act = extract(r.M, problem.compare, tc.duration);
      const d = compareCase(expected[i], act, Object.assign({}, problem, { _dur: tc.duration }));
      res = d ? { verdict: 'WA', msg: d.msg, at: d.t, key: d.key } : { verdict: 'AC', msg: '' };
      res.act = act;
    }
    res.name = tc.name || `測資 ${i + 1}`;
    res.sample = !!tc.sample;
    res.ms = Math.round((typeof performance !== 'undefined' ? performance : Date).now() - t0);
    res.warnings = r.M.warnings.slice(0, 3);
    cases.push(res);
    if (onCase) onCase(res, i);
  }
  const ac = cases.filter(c => c.verdict === 'AC').length;
  const firstBad = cases.find(c => c.verdict !== 'AC');
  return { verdict: firstBad ? firstBad.verdict : 'AC', score: Math.round(ac * 100 / cases.length), cases };
}

const PIN_NAMES = ['D0', 'D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11', 'D12', 'D13', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'];
AJ.pinName = p => PIN_NAMES[p] || `腳位${p}`;
AJ.Judge = { parseEvents, describeEvents, runCase, extract, compareCase, computeExpected, judge, VERDICT, keyOf, normLines };
})(typeof window !== 'undefined' ? window : globalThis);
