/* 輕量程式編輯器：textarea + 語法上色覆蓋層 + 行號 */
(function (G) {
'use strict';
const AJ = G.AJ = G.AJ || {};

const KW = new Set('if else for while do switch case default break continue return const static volatile sizeof true false new'.split(' '));
const TYPES = new Set('void int long short unsigned signed char byte bool boolean float double String word size_t uint8_t int8_t uint16_t int16_t uint32_t int32_t Servo Adafruit_NeoPixel'.split(' '));
const FNS = new Set(('pinMode digitalWrite digitalRead analogRead analogWrite delay delayMicroseconds millis micros tone noTone random randomSeed ' +
  'map min max abs constrain pow sqrt sin cos tan round Serial setup loop bitRead bitWrite bitSet bitClear lowByte highByte isDigit isAlpha F').split(' '));
const CONSTS = new Set('HIGH LOW INPUT OUTPUT INPUT_PULLUP LED_BUILTIN A0 A1 A2 A3 A4 A5 DEC HEX OCT BIN PI NEO_GRB NEO_RGB NEO_KHZ800'.split(' '));
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
AJ.esc = s => esc(String(s == null ? '' : s)).replace(/"/g, '&quot;');

const RE = /(\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$))|("(?:[^"\\\n]|\\.)*"?|'(?:[^'\\\n]|\\.)*'?)|(^[ \t]*#[^\n]*)|(\b0[xXbB][0-9a-fA-F]+[uUlL]*\b|\b\d+\.?\d*(?:[eE][+-]?\d+)?[uUlLfF]*\b)|([A-Za-z_]\w*)/gm;
function highlight(src) {
  let out = '', last = 0, m;
  RE.lastIndex = 0;
  while ((m = RE.exec(src))) {
    out += esc(src.slice(last, m.index));
    const s = esc(m[0]);
    if (m[1]) out += `<span class="hl-com">${s}</span>`;
    else if (m[2]) out += `<span class="hl-str">${s}</span>`;
    else if (m[3]) out += `<span class="hl-pp">${s}</span>`;
    else if (m[4]) out += `<span class="hl-num">${s}</span>`;
    else if (KW.has(m[5])) out += `<span class="hl-kw">${s}</span>`;
    else if (TYPES.has(m[5])) out += `<span class="hl-type">${s}</span>`;
    else if (FNS.has(m[5])) out += `<span class="hl-fn">${s}</span>`;
    else if (CONSTS.has(m[5])) out += `<span class="hl-num">${s}</span>`;
    else out += s;
    last = RE.lastIndex;
    if (m[0].length === 0) RE.lastIndex++;
  }
  out += esc(src.slice(last));
  return out + '\n ';
}
AJ.highlight = highlight;

class Editor {
  constructor(host, opts) {
    opts = opts || {};
    this.opts = opts;
    host.innerHTML = `<div class="ed${opts.tall ? ' tall' : ''}">
      <div class="ed-gutter" aria-hidden="true"></div>
      <div class="ed-main"><pre class="ed-hl" aria-hidden="true"></pre><div class="ed-errline" hidden></div>
      <textarea class="ed-ta" spellcheck="false" autocapitalize="off" autocomplete="off" aria-label="${opts.label || '程式碼'}" ${opts.id ? `id="${opts.id}"` : ''}></textarea></div></div>`;
    this.root = host.firstElementChild;
    this.gut = this.root.querySelector('.ed-gutter');
    this.hl = this.root.querySelector('.ed-hl');
    this.ta = this.root.querySelector('.ed-ta');
    this.errEl = this.root.querySelector('.ed-errline');
    this.errLine = 0;
    this.lines = 0;
    this.ta.value = opts.value || '';
    if (opts.readOnly) this.ta.readOnly = true;
    this.ta.addEventListener('input', e => {
      this.refresh();
      if (this.opts.onChange) this.opts.onChange(this.ta.value);
      if (this.quiet || opts.readOnly) return;
      if (e.inputType === 'insertText' && /^[A-Za-z0-9_.]$/.test(e.data || '')) this.ac.update(false);
      else if (this.ac.open && e.inputType && e.inputType.startsWith('delete')) this.ac.update(false);
      else this.ac.close();
    });
    this.ta.addEventListener('scroll', () => { this.sync(); this.ac.close(); });
    this.ta.addEventListener('keydown', e => this.key(e));
    this.ta.addEventListener('blur', () => setTimeout(() => this.ac.close(), 120));
    this.ta.addEventListener('mousedown', () => this.ac.close());
    this.ac = new AutoComplete(this);
    this.refresh();
  }
  get value() { return this.ta.value; }
  set value(v) { this.ta.value = v; this.setError(0); this.refresh(); }
  refresh() {
    const v = this.ta.value;
    this.hl.innerHTML = highlight(v);
    const n = v.split('\n').length;
    if (n !== this.lines || this.errDirty) {
      this.lines = n;
      this.errDirty = false;
      let s = '';
      for (let i = 1; i <= n; i++) s += `<div${i === this.errLine ? ' class="err"' : ''}>${i}</div>`;
      this.gut.innerHTML = s + '<div>&nbsp;</div>';
    }
    this.sync();
  }
  sync() {
    this.hl.scrollTop = this.ta.scrollTop;
    this.hl.scrollLeft = this.ta.scrollLeft;
    this.gut.scrollTop = this.ta.scrollTop;
    if (this.errLine) this.errEl.style.top = (10 + (this.errLine - 1) * 21 - this.ta.scrollTop) + 'px';
  }
  setError(line) {
    this.errLine = line || 0;
    this.errEl.hidden = !this.errLine;
    this.errDirty = true;
    this.refresh();
  }
  goto(line) {
    if (!line) return;
    const lines = this.ta.value.split('\n');
    let pos = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1;
    this.ta.focus();
    this.ta.setSelectionRange(pos, pos + (lines[line - 1] || '').length);
    const target = (line - 1) * 21 - this.ta.clientHeight / 2;
    this.ta.scrollTop = Math.max(0, target);
    this.sync();
  }
  insert(text) {
    const ta = this.ta;
    ta.focus();
    this.quiet = true;
    let ok = false;
    try { ok = document.execCommand('insertText', false, text); } catch (e) { ok = false; }
    if (!ok) {
      const s = ta.selectionStart, e = ta.selectionEnd;
      ta.setRangeText(text, s, e, 'end');
      ta.dispatchEvent(new Event('input'));
    }
    this.quiet = false;
  }
  key(e) {
    if (this.ta.readOnly) return;
    const ta = this.ta;
    if (this.ac.open) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); this.ac.move(e.key === 'ArrowDown' ? 1 : -1); return; }
      if ((e.key === 'Enter' || e.key === 'Tab') && !e.ctrlKey && !e.shiftKey) { e.preventDefault(); this.ac.accept(); return; }
      if (e.key === 'Escape') { e.preventDefault(); this.ac.close(); return; }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'Home' || e.key === 'End') this.ac.close();
    }
    if (e.key === ' ' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); this.ac.update(true); return; }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (this.opts.onRun) this.opts.onRun(e.shiftKey);
      return;
    }
    if (e.key === 'Tab' && !e.ctrlKey && !e.altKey) {
      e.preventDefault();
      const s = ta.selectionStart, en = ta.selectionEnd, v = ta.value;
      if (s !== en && v.slice(s, en).includes('\n')) {
        const ls = v.lastIndexOf('\n', s - 1) + 1;
        const block = v.slice(ls, en);
        const nb = e.shiftKey ? block.replace(/^ {1,2}/gm, '') : block.replace(/^/gm, '  ');
        ta.setSelectionRange(ls, en);
        this.insert(nb);
        ta.setSelectionRange(ls, ls + nb.length);
      } else if (!e.shiftKey) this.insert('  ');
      return;
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.altKey) {
      const s = ta.selectionStart, v = ta.value;
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      const cur = v.slice(ls, s);
      let ind = (/^[ \t]*/.exec(cur) || [''])[0];
      const before = cur.trimEnd();
      if (before.endsWith('{')) ind += '  ';
      e.preventDefault();
      if (before.endsWith('{') && v[ta.selectionEnd] === '}') {
        this.insert('\n' + ind + '\n' + ind.slice(2));
        const p = s + 1 + ind.length;
        ta.setSelectionRange(p, p);
      } else this.insert('\n' + ind);
      return;
    }
    if (e.key === '}') {
      const s = ta.selectionStart, v = ta.value;
      const ls = v.lastIndexOf('\n', s - 1) + 1;
      const cur = v.slice(ls, s);
      if (/^ {2,}$/.test(cur) && s === ta.selectionEnd) {
        e.preventDefault();
        ta.setSelectionRange(s - 2, s);
        this.insert('}');
      }
    }
  }
}
/* ------------------------------------------------------------ 自動完成 */
// [名稱, 顯示的用法, 說明]；用法含「(」的會自動補上括號
const F = (n, sig, doc) => ({ n, sig, doc, kind: '函式', fn: true });
const AC_FUNCS = [
  F('pinMode', 'pinMode(腳位, 模式)', '設定腳位：OUTPUT、INPUT 或 INPUT_PULLUP'),
  F('digitalWrite', 'digitalWrite(腳位, 值)', '輸出 HIGH 或 LOW'),
  F('digitalRead', 'digitalRead(腳位)', '讀取腳位，回傳 HIGH 或 LOW'),
  F('analogRead', 'analogRead(腳位)', '讀取類比值 0~1023（A0~A5）'),
  F('analogWrite', 'analogWrite(腳位, 值)', 'PWM 輸出 0~255（3、5、6、9、10、11）'),
  F('delay', 'delay(毫秒)', '暫停一段時間，1000 = 1 秒'),
  F('delayMicroseconds', 'delayMicroseconds(微秒)', '暫停幾微秒'),
  F('millis', 'millis()', '開機到現在經過的毫秒數（unsigned long）'),
  F('micros', 'micros()', '開機到現在經過的微秒數'),
  F('tone', 'tone(腳位, 頻率, 毫秒)', '讓蜂鳴器發出指定頻率（毫秒可省略）'),
  F('noTone', 'noTone(腳位)', '停止蜂鳴器'),
  F('random', 'random(最小, 最大)', '產生亂數，不含最大值'),
  F('randomSeed', 'randomSeed(種子)', '設定亂數種子'),
  F('map', 'map(值, 原低, 原高, 新低, 新高)', '把數值換算到另一個範圍'),
  F('constrain', 'constrain(值, 下限, 上限)', '把數值限制在範圍內'),
  F('min', 'min(a, b)', '取較小值'), F('max', 'max(a, b)', '取較大值'), F('abs', 'abs(x)', '絕對值'),
  F('pow', 'pow(底數, 指數)', '次方'), F('sqrt', 'sqrt(x)', '平方根'), F('sq', 'sq(x)', '平方'),
  F('sin', 'sin(弧度)', '正弦'), F('cos', 'cos(弧度)', '餘弦'), F('round', 'round(x)', '四捨五入'),
  F('bitRead', 'bitRead(值, 第幾位)', '讀取某一個位元'), F('bitWrite', 'bitWrite(變數, 第幾位, 0或1)', '設定某一個位元'),
  F('isDigit', 'isDigit(字元)', '是不是數字字元'), F('isAlpha', 'isAlpha(字元)', '是不是英文字母'),
  F('strlen', 'strlen(字元陣列)', '字串長度'), F('String', 'String(值)', '轉成 String 字串'),
  F('F', 'F("文字")', '把字串常數放在快閃記憶體'),
];
const AC_SERIAL = [
  F('begin', 'Serial.begin(鮑率)', '開啟序列埠，通常寫 Serial.begin(9600);'),
  F('print', 'Serial.print(值)', '輸出文字或數字（不換行）'),
  F('println', 'Serial.println(值)', '輸出文字或數字並換行'),
  F('available', 'Serial.available()', '還有幾個字元可以讀'),
  F('read', 'Serial.read()', '讀一個字元，沒有資料時回傳 -1'),
  F('peek', 'Serial.peek()', '偷看下一個字元但不取出'),
  F('parseInt', 'Serial.parseInt()', '讀一個整數（會等最多 1 秒）'),
  F('parseFloat', 'Serial.parseFloat()', '讀一個小數'),
  F('readString', 'Serial.readString()', '讀取所有文字（等 1 秒沒資料才結束）'),
  F('readStringUntil', "Serial.readStringUntil('\\n')", '讀到指定字元為止，例如換行'),
  F('write', 'Serial.write(位元組)', '輸出一個位元組'),
  F('setTimeout', 'Serial.setTimeout(毫秒)', '設定讀取等待時間'),
];
const AC_SERVO = [
  F('attach', '名稱.attach(腳位)', '指定伺服馬達的訊號腳位'),
  F('write', '名稱.write(角度)', '轉到 0~180 度'),
  F('read', '名稱.read()', '目前的角度'),
  F('writeMicroseconds', '名稱.writeMicroseconds(微秒)', '用脈衝寬度控制'),
  F('attached', '名稱.attached()', '是否已 attach'), F('detach', '名稱.detach()', '停止控制'),
];
const AC_PIXEL = [
  F('begin', '名稱.begin()', '初始化燈條（setup 裡要呼叫）'),
  F('show', '名稱.show()', '把設定好的顏色送到燈條'),
  F('clear', '名稱.clear()', '全部設為不亮（要再 show 才會生效）'),
  F('setPixelColor', '名稱.setPixelColor(編號, 顏色)', '設定第幾顆燈的顏色'),
  F('Color', '名稱.Color(紅, 綠, 藍)', '組合顏色，每個 0~255'),
  F('setBrightness', '名稱.setBrightness(亮度)', '整體亮度 0~255'),
  F('numPixels', '名稱.numPixels()', '燈珠數量'),
  F('fill', '名稱.fill(顏色, 起點, 數量)', '一次設定多顆燈'),
  F('getPixelColor', '名稱.getPixelColor(編號)', '讀取某顆燈的顏色'),
  F('ColorHSV', '名稱.ColorHSV(色相)', '用色相 0~65535 產生顏色'),
];
const AC_STRING = [
  F('length', 's.length()', '字串長度'), F('charAt', 's.charAt(位置)', '取出某個字元'),
  F('substring', 's.substring(起, 迄)', '取出一段字串'), F('indexOf', 's.indexOf("文字")', '找文字的位置，找不到是 -1'),
  F('toInt', 's.toInt()', '轉成整數'), F('toFloat', 's.toFloat()', '轉成小數'),
  F('trim', 's.trim()', '去掉前後空白與換行'), F('equals', 's.equals("文字")', '比較是否相同'),
  F('toUpperCase', 's.toUpperCase()', '轉大寫'), F('toLowerCase', 's.toLowerCase()', '轉小寫'),
  F('startsWith', 's.startsWith("文字")', '是否以某文字開頭'), F('endsWith', 's.endsWith("文字")', '是否以某文字結尾'),
  F('replace', 's.replace("舊", "新")', '取代文字'), F('remove', 's.remove(位置, 個數)', '刪除字元'),
  F('lastIndexOf', 's.lastIndexOf("文字")', '從後面找文字'), F('isEmpty', 's.isEmpty()', '是否為空字串'),
];
const W = (kind, doc) => n => ({ n, kind, doc: doc || '' });
const AC_WORDS = [
  ...'if else for while do switch case default break continue return const static sizeof'.split(' ').map(W('關鍵字')),
  ...'void int long unsigned byte char bool float double String word boolean Servo Adafruit_NeoPixel'.split(' ').map(W('型別')),
  ...[['HIGH', '高電位 1'], ['LOW', '低電位 0'], ['INPUT', '輸入'], ['OUTPUT', '輸出'], ['INPUT_PULLUP', '輸入並開啟內建上拉電阻（按鈕接 GND 時用）'],
    ['LED_BUILTIN', '板子上的 LED（13 號腳）'], ['true', '真'], ['false', '假'], ['DEC', '十進位'], ['HEX', '十六進位'], ['BIN', '二進位'], ['PI', '圓周率'],
    ['NEO_GRB', 'WS2812 顏色順序'], ['NEO_KHZ800', 'WS2812 傳輸速度'],
    ['A0', '類比腳位 A0'], ['A1', '類比腳位 A1'], ['A2', '類比腳位 A2'], ['A3', '類比腳位 A3'], ['A4', '類比腳位 A4'], ['A5', '類比腳位 A5']]
    .map(([n, d]) => ({ n, kind: '常數', doc: d })),
  { n: 'Serial', kind: '物件', doc: '序列埠，輸入「Serial.」看可用的功能' },
];
// 程式片段：$0 是游標位置
const AC_SNIPS = [
  { n: 'for', kind: '片段', label: 'for (int i = 0; i < 10; i++) { }', doc: '重複執行固定次數', text: 'for (int i = 0; i < $0; i++) {\n  \n}' },
  { n: 'if', kind: '片段', label: 'if (條件) { }', doc: '條件成立才執行', text: 'if ($0) {\n  \n}' },
  { n: 'ifelse', kind: '片段', label: 'if (條件) { } else { }', doc: '二選一', text: 'if ($0) {\n  \n} else {\n  \n}' },
  { n: 'while', kind: '片段', label: 'while (條件) { }', doc: '條件成立就一直重複', text: 'while ($0) {\n  \n}' },
  { n: 'switch', kind: '片段', label: 'switch (值) { case ... }', doc: '依數值選擇', text: 'switch ($0) {\n  case 1:\n    \n    break;\n  default:\n    break;\n}' },
  { n: 'setup', kind: '片段', label: 'void setup() + void loop()', doc: 'Arduino 程式的基本架構', text: 'void setup() {\n  $0\n}\n\nvoid loop() {\n  \n}' },
];

let measureCtx = null;
class AutoComplete {
  constructor(ed) {
    this.ed = ed; this.open = false; this.items = []; this.sel = 0;
    this.el = document.createElement('div');
    this.el.className = 'ac';
    this.el.hidden = true;
    this.el.setAttribute('role', 'listbox');
    this.el.addEventListener('mousedown', e => {
      e.preventDefault();
      const li = e.target.closest('li');
      if (li) { this.sel = +li.dataset.i; this.accept(); }
    });
    document.body.appendChild(this.el);
  }
  context() {
    const ta = this.ed.ta, v = ta.value, pos = ta.selectionStart;
    if (pos !== ta.selectionEnd) return null;
    const ls = v.lastIndexOf('\n', pos - 1) + 1;
    const before = v.slice(ls, pos);
    // 註解、字串、#include 裡不提示
    const code = before.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '""');
    if (/\/\/|"|'/.test(code.replace(/""/g, '')) || /^\s*#/.test(before)) return null;
    const m = /([A-Za-z_]\w*)?$/.exec(before);
    const prefix = m[1] || '';
    if (/^\d/.test(prefix)) return null;
    const start = pos - prefix.length;
    const dot = /([A-Za-z_]\w*)\s*\.\s*$/.exec(before.slice(0, before.length - prefix.length));
    return { prefix, start, pos, obj: dot ? dot[1] : null, lineStart: ls };
  }
  members(obj) {
    if (obj === 'Serial') return AC_SERIAL;
    const v = this.ed.ta.value;
    const re = new RegExp(`\\b(Servo|Adafruit_NeoPixel|String)\\b[^;(){}]*?\\b${obj}\\b`);
    const m = re.exec(v);
    if (!m) return [];
    return m[1] === 'Servo' ? AC_SERVO : m[1] === 'Adafruit_NeoPixel' ? AC_PIXEL : AC_STRING;
  }
  userWords(prefix) {
    const v = this.ed.ta.value, out = new Map();
    const add = (n, kind) => { if (n && n !== prefix && !out.has(n)) out.set(n, { n, kind, doc: '', fn: kind === '我的函式' }); };
    let m;
    const decl = /\b(?:int|long|short|float|double|byte|char|bool|boolean|String|word|unsigned(?:\s+(?:int|long|char))?|uint8_t|uint16_t|uint32_t|Servo|Adafruit_NeoPixel)\s+([A-Za-z_]\w*)(?:\s*\[[^\]]*\])*\s*(\()?/g;
    while ((m = decl.exec(v))) add(m[1], m[2] ? '我的函式' : '變數');
    const more = /,\s*([A-Za-z_]\w*)\s*(?==|,|;|\[)/g;
    while ((m = more.exec(v))) add(m[1], '變數');
    const def = /^\s*#define\s+([A-Za-z_]\w*)/gm;
    while ((m = def.exec(v))) add(m[1], '常數');
    return [...out.values()];
  }
  update(force) {
    const c = this.context();
    if (!c || (c.obj === null && c.prefix.length < (force ? 0 : 2)) || (c.obj && !c.prefix && !force && this.ed.ta.value[c.pos - 1] !== '.')) return this.close();
    let pool;
    if (c.obj) pool = this.members(c.obj);
    else {
      const user = this.userWords(c.prefix);
      const seen = new Set(user.map(u => u.n));
      pool = user.concat(AC_SNIPS, AC_FUNCS, AC_WORDS.filter(w => !seen.has(w.n)));
    }
    const p = c.prefix.toLowerCase();
    const scored = [];
    pool.forEach((it, idx) => {
      const n = it.n.toLowerCase();
      let s;
      if (it.n.startsWith(c.prefix)) s = 0;
      else if (n.startsWith(p)) s = 1;
      else if (p.length >= 2 && n.includes(p)) s = 2;
      else return;
      scored.push([s, it, idx]);
    });
    scored.sort((a, b) => a[0] - b[0] || (a[1].kind === '片段') - (b[1].kind === '片段') || a[2] - b[2]);
    this.items = scored.slice(0, 40).map(x => x[1]);
    if (!this.items.length || (this.items.length === 1 && this.items[0].n === c.prefix && !this.items[0].fn && !this.items[0].text)) return this.close();
    this.ctx = c;
    this.sel = 0;
    this.render();
    this.place();
  }
  render() {
    const esc2 = s => esc(String(s));
    const it = this.items[this.sel];
    this.el.innerHTML = `<ul>${this.items.map((x, i) => `<li data-i="${i}" role="option"${i === this.sel ? ' aria-selected="true"' : ''}><span class="n">${esc2(x.label || x.n)}</span><span class="k">${x.kind}</span></li>`).join('')}</ul>` +
      `<div class="doc">${it.sig ? `<code>${esc2(it.sig)}</code>` : ''}${it.doc ? `<span>${esc2(it.doc)}</span>` : ''}<small>↑↓ 選擇　Enter / Tab 輸入　Esc 關閉</small></div>`;
    this.el.hidden = false;
    this.open = true;
    const li = this.el.querySelector('li[aria-selected]');
    if (li) li.scrollIntoView({ block: 'nearest' });
  }
  place() {
    const ta = this.ed.ta, c = this.ctx;
    const cs = getComputedStyle(ta);
    if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
    measureCtx.font = `${cs.fontSize} ${cs.fontFamily}`;
    const v = ta.value;
    const line = v.slice(0, c.start).split('\n').length - 1;
    const x0 = measureCtx.measureText(v.slice(c.lineStart, c.start).replace(/\t/g, '  ')).width;
    const r = ta.getBoundingClientRect();
    const lh = parseFloat(cs.lineHeight) || 21;
    let x = r.left + parseFloat(cs.paddingLeft) + x0 - ta.scrollLeft - 4;
    let y = r.top + parseFloat(cs.paddingTop) + (line + 1) * lh - ta.scrollTop + 2;
    const h = this.el.offsetHeight, w = this.el.offsetWidth;
    if (y + h > innerHeight - 8) y = y - lh - h - 4;
    x = Math.max(8, Math.min(x, innerWidth - w - 8));
    this.el.style.left = x + 'px';
    this.el.style.top = Math.max(8, y) + 'px';
  }
  move(d) {
    this.sel = (this.sel + d + this.items.length) % this.items.length;
    this.render();
  }
  accept() {
    const it = this.items[this.sel], c = this.ctx, ta = this.ed.ta;
    this.close();
    if (!it) return;
    ta.setSelectionRange(c.start, c.pos);
    if (it.text) {
      const ls = ta.value.lastIndexOf('\n', c.start - 1) + 1;
      const ind = (/^[ \t]*/.exec(ta.value.slice(ls, c.start)) || [''])[0];
      const body = it.text.replace(/\n/g, '\n' + ind);
      const k = body.indexOf('$0');
      this.ed.insert(body.replace('$0', ''));
      const p = c.start + k;
      ta.setSelectionRange(p, p);
      return;
    }
    const next = ta.value[c.pos];
    if (it.fn && next !== '(') {
      this.ed.insert(it.n + '()');
      const p = c.start + it.n.length + 1;
      ta.setSelectionRange(p, p);
    } else this.ed.insert(it.n);
  }
  close() {
    if (!this.open) return;
    this.open = false;
    this.el.hidden = true;
  }
}

AJ.Editor = Editor;
})(typeof window !== 'undefined' ? window : globalThis);
