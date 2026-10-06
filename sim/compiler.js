/* Arduino C/C++ 子集編譯器：原始碼 → 閉包（不使用 eval），delay 等以 generator 讓出時間 */
(function (G) {
'use strict';
const AJ = G.AJ = G.AJ || {};

class CompileError extends Error {
  constructor(msg, line) { super(msg); this.line = line || 0; this.kind = 'CE'; }
}
class RunError extends Error {
  constructor(msg, line, kind) { super(msg); this.line = line || 0; this.kind = kind || 'RE'; }
}
AJ.CompileError = CompileError;
AJ.RunError = RunError;

/* ------------------------------------------------------------------ 型別 */
const RANGE = {
  bool: [0, 1], char: [-128, 127], byte: [0, 255], int: [-32768, 32767],
  uint: [0, 65535], long: [-2147483648, 2147483647], ulong: [0, 4294967295],
};
const isInt = t => Object.prototype.hasOwnProperty.call(RANGE, t);
const isNum = t => isInt(t) || t === 'float';
const isStr = t => t === 'String' || t === 'cstr';
const fits = (a, b) => b === 'float' ? isNum(a)
  : (isInt(a) && isInt(b) && RANGE[a][0] >= RANGE[b][0] && RANGE[a][1] <= RANGE[b][1]);
const fround = Math.fround;
const WRAP = {
  bool: v => (v ? 1 : 0),
  char: v => (v << 24) >> 24,
  byte: v => v & 255,
  int: v => (v << 16) >> 16,
  uint: v => v & 65535,
  long: v => v | 0,
  ulong: v => v >>> 0,
  float: v => fround(v),
};
const promote = t => (t === 'bool' || t === 'char' || t === 'byte') ? 'int' : t;
const ORDER = ['int', 'uint', 'long', 'ulong'];
function arith(a, b) {
  if (a === 'float' || b === 'float') return 'float';
  a = promote(a); b = promote(b);
  return ORDER[Math.max(ORDER.indexOf(a), ORDER.indexOf(b))];
}
const TNAME = {
  bool: 'bool', char: 'char', byte: 'byte', int: 'int', uint: 'unsigned int', long: 'long',
  ulong: 'unsigned long', float: 'float', String: 'String', cstr: '字串', void: 'void',
};
const tname = (t, d) => (TNAME[t] || t) + '[]'.repeat(d || 0);
const SIZEOF = { bool: 1, char: 1, byte: 1, int: 2, uint: 2, long: 4, ulong: 4, float: 4, String: 6, cstr: 2, Servo: 3, Adafruit_NeoPixel: 20 };
const CLASSES = new Set(['Servo', 'Adafruit_NeoPixel']);
const PRIM = new Set(['void', 'int', 'long', 'short', 'unsigned', 'signed', 'char', 'byte', 'bool', 'boolean',
  'float', 'double', 'String', 'word', 'size_t', 'uint8_t', 'int8_t', 'uint16_t', 'int16_t', 'uint32_t',
  'int32_t', 'uint64_t', 'int64_t']);
const QUAL = new Set(['const', 'static', 'volatile', 'inline', 'extern', 'register', 'unsigned', 'signed', 'constexpr']);
const UNSUP_KW = {
  struct: '模擬器目前不支援 struct，請改用多個變數或陣列',
  class: '模擬器目前不支援自訂 class',
  enum: '模擬器目前不支援 enum，可以改用 const int 或 #define',
  union: '模擬器不支援 union', typedef: '模擬器不支援 typedef',
  template: '模擬器不支援 template', namespace: '模擬器不支援 namespace',
  using: '模擬器不支援 using', goto: '模擬器不支援 goto', auto: '模擬器不支援 auto，請寫出明確的型別',
};
const SUPPORTED_LIBS = new Set(['Arduino.h', 'Servo.h', 'Adafruit_NeoPixel.h', 'math.h', 'stdlib.h', 'string.h', 'avr/pgmspace.h']);

/* --------------------------------------------------------------- 詞法分析 */
const PUNCT = ['<<=', '>>=', '->', '++', '--', '<<', '>>', '<=', '>=', '==', '!=', '&&', '||', '+=', '-=', '*=',
  '/=', '%=', '&=', '|=', '^=', '::', '+', '-', '*', '/', '%', '<', '>', '=', '!', '~', '&', '|', '^', '?', ':',
  ';', ',', '.', '(', ')', '[', ']', '{', '}'];
const FULLWIDTH = { '；': ';', '，': ',', '（': '(', '）': ')', '｛': '{', '｝': '}', '＝': '=', '＂': '"', '“': '"', '”': '"', '‘': "'", '’': "'", '　': ' ', '：': ':', '［': '[', '］': ']', '＋': '+', '－': '-', '＜': '<', '＞': '>' };

function readEscape(src, i, line) {
  const c = src[i];
  const simple = { n: 10, t: 9, r: 13, '0': 0, '\\': 92, "'": 39, '"': 34, a: 7, b: 8, f: 12, v: 11, '?': 63 };
  if (c === 'x') {
    const m = /^[0-9a-fA-F]{1,2}/.exec(src.slice(i + 1, i + 3));
    if (!m) throw new CompileError('跳脫字元 \\x 後面需要十六進位數字', line);
    return [parseInt(m[0], 16), i + 1 + m[0].length];
  }
  if (/[0-7]/.test(c)) {
    const m = /^[0-7]{1,3}/.exec(src.slice(i, i + 3));
    return [parseInt(m[0], 8), i + m[0].length];
  }
  if (c in simple) return [simple[c], i + 1];
  return [c.charCodeAt(0), i + 1];
}

function lexRaw(src, line0) {
  const out = [];
  let i = 0, line = line0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '\n') { line++; i++; continue; }
    if (c === ' ' || c === '\t' || c === '\r' || c === '\f' || c === '\v') { i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') {
      const st = line; i += 2;
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') line++; i++; }
      if (i >= n) throw new CompileError('區塊註解「/*」沒有用「*/」結束', st);
      i += 2; continue;
    }
    if ((c >= '0' && c <= '9') || (c === '.' && /[0-9]/.test(src[i + 1] || ''))) {
      const m = /^(0[xX][0-9a-fA-F]+|0[bB][01]+|(?:\d+\.\d*|\.\d+|\d+)(?:[eE][+-]?\d+)?)([uUlLfF]*)/.exec(src.slice(i, i + 80));
      const txt = m[1], suf = m[2].toLowerCase();
      let v, isF = false, based = false;
      if (/^0[xX]/.test(txt)) { v = parseInt(txt.slice(2), 16); based = true; }
      else if (/^0[bB]/.test(txt)) { v = parseInt(txt.slice(2), 2); based = true; }
      else if (/[.eE]/.test(txt)) { v = parseFloat(txt); isF = true; }
      else if (/^0[0-7]+$/.test(txt)) { v = parseInt(txt, 8); based = true; }
      else v = parseInt(txt, 10);
      if (suf.includes('f')) isF = true;
      let t;
      if (isF) { t = 'float'; v = fround(v); }
      else if (suf.includes('u')) t = (suf.includes('l') || v > 65535) ? 'ulong' : 'uint';
      else if (suf.includes('l')) t = v > 2147483647 ? 'ulong' : 'long';
      else if (v <= 32767) t = 'int';
      else if (based && v <= 65535) t = 'uint';
      else if (v <= 2147483647) t = 'long';
      else t = 'ulong';
      const after = src[i + m[0].length];
      if (after && /[A-Za-z_]/.test(after)) throw new CompileError(`數字「${src.slice(i, i + m[0].length + 1)}」寫法不正確`, line);
      out.push({ t: 'num', v, nt: t, line });
      i += m[0].length; continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      let j = i + 1;
      while (j < n && /[A-Za-z0-9_]/.test(src[j])) j++;
      out.push({ t: 'id', v: src.slice(i, j), line });
      i = j; continue;
    }
    if (c === '"') {
      let s = ''; let j = i + 1;
      while (true) {
        if (j >= n || src[j] === '\n') throw new CompileError('字串少了結尾的雙引號「"」', line);
        const d = src[j];
        if (d === '"') { j++; break; }
        if (d === '\\') { const [code, nj] = readEscape(src, j + 1, line); s += String.fromCharCode(code); j = nj; continue; }
        s += d; j++;
      }
      out.push({ t: 'str', v: s, line });
      i = j; continue;
    }
    if (c === "'") {
      let j = i + 1, code;
      if (src[j] === '\\') { [code, j] = readEscape(src, j + 1, line); }
      else if (src[j] === "'" || src[j] === '\n' || j >= n) throw new CompileError("字元常數 ' ' 是空的或沒有結束", line);
      else { code = src.codePointAt(j); j += code > 0xffff ? 2 : 1; }
      if (src[j] !== "'") throw new CompileError("字元常數要用單引號包住一個字元，例如 'A'；字串請用雙引號", line);
      if (code > 255) throw new CompileError("字元常數只能放一個英數字元；中文請用字串（雙引號）", line);
      out.push({ t: 'num', v: (code << 24) >> 24, nt: 'char', line });
      i = j + 1; continue;
    }
    let m = null;
    for (const p of PUNCT) if (src.startsWith(p, i)) { m = p; break; }
    if (!m) {
      if (FULLWIDTH[c]) throw new CompileError(`出現全形符號「${c}」，請改成半形的「${FULLWIDTH[c]}」（切換成英文輸入法）`, line);
      throw new CompileError(`看不懂的符號「${c}」`, line);
    }
    out.push({ t: 'op', v: m, line });
    i += m.length;
  }
  return out;
}

function preprocess(src) {
  const lines = src.replace(/\r\n?/g, '\n').split('\n');
  const defines = new Map();
  const includes = [];
  const warnings = [];
  let inBlock = false;
  for (let k = 0; k < lines.length; k++) {
    const L = lines[k];
    if (!inBlock && /^\s*#/.test(L)) {
      let text = L, k2 = k;
      while (/\\\s*$/.test(text) && k2 + 1 < lines.length) text = text.replace(/\\\s*$/, ' ') + lines[++k2];
      for (let q = k; q <= k2; q++) lines[q] = '';
      directive(text.trim().slice(1).trim(), k + 1);
      k = k2; continue;
    }
    // 粗略追蹤區塊註解狀態（避免把註解中的 # 當成指令）
    for (let i = 0; i < L.length; i++) {
      if (inBlock) { if (L[i] === '*' && L[i + 1] === '/') { inBlock = false; i++; } continue; }
      if (L[i] === '"') { i++; while (i < L.length && L[i] !== '"') { if (L[i] === '\\') i++; i++; } continue; }
      if (L[i] === "'") { i++; while (i < L.length && L[i] !== "'") { if (L[i] === '\\') i++; i++; } continue; }
      if (L[i] === '/' && L[i + 1] === '/') break;
      if (L[i] === '/' && L[i + 1] === '*') { inBlock = true; i++; }
    }
  }
  function directive(text, line) {
    text = text.replace(/\/\*.*?\*\//g, ' ').replace(/\/\/.*$/, '').trim();
    const word = (/^[a-z]+/.exec(text) || [''])[0];
    if (word === 'include') {
      const m = /^include\s*[<"]([^>"]+)[>"]/.exec(text);
      if (!m) throw new CompileError('#include 的寫法應該像 #include <Servo.h>', line);
      includes.push({ name: m[1], line });
      if (!SUPPORTED_LIBS.has(m[1])) throw new CompileError(`模擬器目前不支援函式庫 <${m[1]}>（支援：Servo.h、Adafruit_NeoPixel.h）`, line);
      return;
    }
    if (word === 'define') {
      const m = /^define\s+([A-Za-z_]\w*)(\([^)]*\))?(.*)$/.exec(text);
      if (!m) throw new CompileError('#define 的寫法應該像 #define LED_PIN 13', line);
      const params = m[2] ? m[2].slice(1, -1).split(',').map(s => s.trim()).filter(Boolean) : null;
      defines.set(m[1], { params, body: lexRaw(m[3], line) });
      return;
    }
    if (word === 'undef') { defines.delete(text.slice(5).trim()); return; }
    if (['ifdef', 'ifndef', 'if', 'else', 'elif', 'endif', 'pragma', 'warning', 'error', 'line'].includes(word)) {
      warnings.push({ line, msg: `#${word} 在模擬器中會被忽略` });
      return;
    }
    throw new CompileError(`不認得的前置指令「#${text}」`, line);
  }
  return { code: lines.join('\n'), defines, includes, warnings };
}

function expandTokens(list, defines, active, depth) {
  if (depth > 40) throw new CompileError('#define 巨集展開太多層（可能互相引用）', list[0] && list[0].line);
  const res = [];
  for (let i = 0; i < list.length; i++) {
    const t = list[i];
    const d = t.t === 'id' && !active.has(t.v) && defines.get(t.v);
    if (!d) { res.push(t); continue; }
    let body;
    if (d.params) {
      const nx = list[i + 1];
      if (!nx || nx.t !== 'op' || nx.v !== '(') { res.push(t); continue; }
      const args = []; let cur = []; let lvl = 0; let j = i + 2;
      for (; j < list.length; j++) {
        const u = list[j];
        if (u.t === 'op' && (u.v === '(' || u.v === '[' || u.v === '{')) lvl++;
        else if (u.t === 'op' && (u.v === ')' || u.v === ']' || u.v === '}')) { if (lvl === 0 && u.v === ')') break; lvl--; }
        else if (u.t === 'op' && u.v === ',' && lvl === 0) { args.push(cur); cur = []; continue; }
        cur.push(u);
      }
      if (j >= list.length) throw new CompileError(`巨集 ${t.v}( 少了右括號`, t.line);
      if (cur.length || args.length) args.push(cur);
      if (args.length !== d.params.length) throw new CompileError(`巨集 ${t.v} 需要 ${d.params.length} 個參數，卻給了 ${args.length} 個`, t.line);
      body = [];
      for (const b of d.body) {
        const pi = b.t === 'id' ? d.params.indexOf(b.v) : -1;
        if (pi >= 0) body.push(...expandTokens(args[pi], defines, active, depth + 1));
        else body.push(b);
      }
      i = j;
    } else body = d.body;
    const na = new Set(active); na.add(t.v);
    for (const b of expandTokens(body, defines, na, depth + 1)) res.push(Object.assign({}, b, { line: t.line }));
  }
  return res;
}

/* --------------------------------------------------------------- 語法分析 */
const BINPREC = { '||': 1, '&&': 2, '|': 3, '^': 4, '&': 5, '==': 6, '!=': 6, '<': 7, '>': 7, '<=': 7, '>=': 7,
  '<<': 8, '>>': 8, '+': 9, '-': 9, '*': 10, '/': 10, '%': 10 };
const ASSIGN_OPS = new Set(['=', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=', '<<=', '>>=']);
const tokText = t => t.t === 'eof' ? '程式結尾' : t.t === 'str' ? `"${t.v}"` : String(t.v);

function normType(words, ptr, line) {
  const has = w => words.includes(w);
  let t;
  const cls = words.find(w => CLASSES.has(w));
  if (cls) t = cls;
  else if (has('String')) t = 'String';
  else if (has('void')) t = 'void';
  else if (has('float') || has('double')) t = 'float';
  else if (has('bool') || has('boolean')) t = 'bool';
  else if (has('byte') || has('uint8_t')) t = 'byte';
  else if (has('int8_t')) t = 'char';
  else if (has('char')) t = has('unsigned') ? 'byte' : 'char';
  else if (has('uint16_t') || has('word') || has('size_t')) t = 'uint';
  else if (has('int16_t')) t = 'int';
  else if (has('uint32_t') || has('uint64_t')) t = 'ulong';
  else if (has('int32_t') || has('int64_t')) t = 'long';
  else if (has('long')) t = has('unsigned') ? 'ulong' : 'long';
  else t = has('unsigned') ? 'uint' : 'int';
  if (ptr) {
    if ((t === 'char' || t === 'byte') && ptr === 1) t = 'cstr';
    else throw new CompileError('模擬器不支援指標（*），請改用陣列或一般變數', line);
  }
  return t;
}

class Parser {
  constructor(toks) { this.toks = toks; this.p = 0; }
  peek(o) { return this.toks[Math.min(this.p + (o || 0), this.toks.length - 1)]; }
  next() { return this.toks[this.p++]; }
  prev() { return this.toks[Math.max(0, this.p - 1)]; }
  is(v, o) { const t = this.peek(o); return (t.t === 'op' || t.t === 'id') && t.v === v; }
  accept(v) { if (this.is(v)) { this.p++; return true; } return false; }
  err(msg, tok) { throw new CompileError(msg, (tok || this.peek()).line); }
  expect(v) {
    if (this.accept(v)) return;
    const t = this.peek();
    if (t.t === 'eof') this.err(`程式在結尾前就結束了，少了「${v}」（大括號或小括號沒有成對）`);
    this.err(`這裡應該要有「${v}」，卻出現「${tokText(t)}」`);
  }
  expectSemi() {
    if (this.accept(';')) return;
    const t = this.peek();
    if (t.line > this.prev().line) throw new CompileError(`這一行的結尾可能少了分號「;」`, this.prev().line);
    this.err(`這裡應該要有分號「;」，卻出現「${tokText(t)}」`);
  }
  expectId(what) {
    const t = this.peek();
    if (t.t !== 'id') this.err(`這裡需要一個${what || '名稱'}，卻出現「${tokText(t)}」`);
    if (PRIM.has(t.v) || QUAL.has(t.v)) this.err(`「${t.v}」是型別保留字，不能拿來當名稱`);
    this.p++;
    return t;
  }
  isTypeStart(o) { const t = this.peek(o); return t.t === 'id' && (PRIM.has(t.v) || QUAL.has(t.v) || CLASSES.has(t.v)); }
  isDeclStart() {
    if (!this.isTypeStart()) return false;
    const t = this.peek();
    if ((this.is('(', 1) || this.is('::', 1)) && !QUAL.has(t.v)) return false;
    return true;
  }
  parseType() {
    const words = []; let isConst = false, isStatic = false;
    const line = this.peek().line;
    while (true) {
      const t = this.peek();
      if (t.t !== 'id') break;
      if (t.v === 'const' || t.v === 'constexpr') { isConst = true; this.p++; continue; }
      if (t.v === 'static') { isStatic = true; this.p++; continue; }
      if (t.v === 'volatile' || t.v === 'inline' || t.v === 'extern' || t.v === 'register') { this.p++; continue; }
      if (PRIM.has(t.v) || CLASSES.has(t.v)) {
        if (words.length && (CLASSES.has(t.v) || t.v === 'String' || words.some(w => CLASSES.has(w) || w === 'String'))) break;
        words.push(t.v); this.p++; continue;
      }
      break;
    }
    if (!words.length) this.err('這裡需要型別（例如 int、float）');
    let ptr = 0;
    while (this.accept('*')) ptr++;
    if (this.is('&')) this.err('模擬器不支援參考（&），請改用回傳值或全域變數');
    return { t: normType(words, ptr, line), isConst, isStatic, line };
  }

  program() {
    const items = [];
    while (this.peek().t !== 'eof') {
      if (this.accept(';')) continue;
      const t = this.peek();
      if (t.t === 'id' && UNSUP_KW[t.v]) this.err(UNSUP_KW[t.v]);
      if (!this.isTypeStart()) {
        if (t.t === 'id' && this.is('(', 1)) this.err(`「${t.v}(...)」這種敘述要寫在函式的大括號裡面（例如 setup() 或 loop()）`);
        if (t.t === 'op' && t.v === '}') this.err('多了一個右大括號「}」');
        this.err(`這裡應該是變數或函式的宣告，卻出現「${tokText(t)}」`);
      }
      const ty = this.parseType();
      const nameTok = this.expectId('名稱');
      if (this.is('(') && !CLASSES.has(ty.t)) items.push(this.funcRest(ty, nameTok));
      else items.push({ k: 'decl', ty, items: this.declRest(ty, nameTok), line: nameTok.line });
    }
    return items;
  }
  funcRest(ty, nameTok) {
    this.expect('(');
    const params = [];
    if (this.is('void') && this.is(')', 1)) this.p++;
    if (!this.is(')')) {
      do {
        const pty = this.parseType();
        let name = null;
        if (this.peek().t === 'id' && !this.isTypeStart()) name = this.next().v;
        const dims = [];
        while (this.accept('[')) { dims.push(this.is(']') ? null : this.expr()); this.expect(']'); }
        if (this.is('=')) this.err('模擬器不支援參數預設值');
        params.push({ t: pty.t, d: dims.length, name, line: pty.line });
      } while (this.accept(','));
    }
    this.expect(')');
    if (this.accept(';')) return { k: 'fn', ret: ty.t, name: nameTok.v, params, body: null, line: nameTok.line };
    if (!this.is('{')) this.err(`函式 ${nameTok.v}() 後面應該接「{」`);
    const body = this.blockStmt();
    return { k: 'fn', ret: ty.t, name: nameTok.v, params, body, line: nameTok.line };
  }
  declRest(ty, nameTok) {
    const items = [this.declarator(ty, nameTok)];
    while (this.accept(',')) items.push(this.declarator(ty, this.expectId('變數名稱')));
    this.expectSemi();
    return items;
  }
  declarator(ty, nameTok) {
    const dims = [];
    while (this.accept('[')) { dims.push(this.is(']') ? null : this.expr()); this.expect(']'); }
    let init = null, ctor = null;
    if (this.accept('=')) init = this.is('{') ? this.initList() : this.assign();
    else if (this.is('(')) {
      this.next();
      ctor = [];
      if (!this.is(')')) do { ctor.push(this.assign()); } while (this.accept(','));
      this.expect(')');
    } else if (this.is('{')) init = this.initList();
    return { name: nameTok.v, dims, init, ctor, line: nameTok.line };
  }
  initList() {
    const line = this.peek().line;
    this.expect('{');
    const items = [];
    while (!this.is('}')) {
      items.push(this.is('{') ? this.initList() : this.assign());
      if (!this.accept(',')) break;
    }
    this.expect('}');
    return { k: 'list', items, line };
  }

  blockStmt() {
    const open = this.peek();
    this.expect('{');
    const list = [];
    while (!this.is('}')) {
      if (this.peek().t === 'eof') this.err('這個左大括號「{」沒有對應的右大括號「}」', open);
      list.push(this.stmt());
    }
    this.next();
    return { k: 'block', list, line: open.line };
  }
  stmt() {
    const t = this.peek(), line = t.line;
    if (t.t === 'op' && t.v === '{') return this.blockStmt();
    if (t.t === 'op' && t.v === ';') { this.next(); return { k: 'empty', line }; }
    if (t.t === 'id') {
      if (UNSUP_KW[t.v]) this.err(UNSUP_KW[t.v]);
      switch (t.v) {
        case 'if': {
          this.next(); this.expect('('); const c = this.expr(); this.expect(')');
          const a = this.stmt(); const b = this.accept('else') ? this.stmt() : null;
          return { k: 'if', c, a, b, line };
        }
        case 'while': {
          this.next(); this.expect('('); const c = this.expr(); this.expect(')');
          return { k: 'while', c, body: this.stmt(), line };
        }
        case 'do': {
          this.next(); const body = this.stmt();
          if (!this.accept('while')) this.err('do { ... } 後面要接 while (...);');
          this.expect('('); const c = this.expr(); this.expect(')'); this.expectSemi();
          return { k: 'dowhile', c, body, line };
        }
        case 'for': {
          this.next(); this.expect('(');
          let init = null;
          if (!this.accept(';')) {
            if (this.isDeclStart()) {
              const ty = this.parseType(); const n = this.expectId('變數名稱');
              init = { k: 'decl', ty, items: this.declRest(ty, n), line };
            } else { init = { k: 'expr', e: this.expr(), line }; this.expect(';'); }
          }
          const c = this.is(';') ? null : this.expr(); this.expect(';');
          const u = this.is(')') ? null : this.expr(); this.expect(')');
          return { k: 'for', init, c, u, body: this.stmt(), line };
        }
        case 'switch': {
          this.next(); this.expect('('); const e = this.expr(); this.expect(')');
          const open = this.peek(); this.expect('{');
          const items = [];
          while (!this.is('}')) {
            if (this.peek().t === 'eof') this.err('switch 的大括號沒有結束', open);
            const ln = this.peek().line;
            if (this.accept('case')) { const v = this.cond(); this.expect(':'); items.push({ k: 'case', e: v, line: ln }); }
            else if (this.accept('default')) { this.expect(':'); items.push({ k: 'default', line: ln }); }
            else items.push(this.stmt());
          }
          this.next();
          return { k: 'switch', e, items, line };
        }
        case 'break': this.next(); this.expectSemi(); return { k: 'break', line };
        case 'continue': this.next(); this.expectSemi(); return { k: 'continue', line };
        case 'return': {
          this.next(); const e = this.is(';') ? null : this.expr(); this.expectSemi();
          return { k: 'return', e, line };
        }
        case 'else': this.err('多出來的 else：前面沒有對應的 if（檢查大括號，或 if (...) 後面是不是多打了分號）');
        case 'case': case 'default': this.err(`${t.v} 只能寫在 switch 裡面`);
      }
    }
    if (this.isDeclStart()) {
      const ty = this.parseType(); const n = this.expectId('變數名稱');
      if (this.is('(') && !CLASSES.has(ty.t) && ty.t !== 'String') this.err('不能在函式裡面定義另一個函式（檢查前面的大括號是否有成對）');
      return { k: 'decl', ty, items: this.declRest(ty, n), line };
    }
    const e = this.expr(); this.expectSemi();
    return { k: 'expr', e, line };
  }

  expr() {
    const e = this.assign();
    if (!this.is(',')) return e;
    const list = [e];
    while (this.accept(',')) list.push(this.assign());
    return { k: 'comma', list, line: e.line };
  }
  assign() {
    const a = this.cond();
    const t = this.peek();
    if (t.t === 'op' && ASSIGN_OPS.has(t.v)) { this.next(); return { k: 'asg', op: t.v, a, b: this.assign(), line: t.line }; }
    return a;
  }
  cond() {
    const c = this.bin(1);
    if (this.is('?')) {
      const line = this.next().line;
      const a = this.expr(); this.expect(':'); const b = this.cond();
      return { k: 'cond', c, a, b, line };
    }
    return c;
  }
  bin(minPrec) {
    let a = this.unary();
    while (true) {
      const t = this.peek();
      if (t.t !== 'op') break;
      const p = BINPREC[t.v];
      if (!p || p < minPrec) break;
      this.next();
      const b = this.bin(p + 1);
      a = { k: (t.v === '&&' || t.v === '||') ? 'log' : 'bin', op: t.v, a, b, line: t.line };
    }
    return a;
  }
  unary() {
    const t = this.peek(), line = t.line;
    if (t.t === 'op') {
      if (t.v === '!' || t.v === '~' || t.v === '-' || t.v === '+') { this.next(); return { k: 'un', op: t.v, a: this.unary(), line }; }
      if (t.v === '++' || t.v === '--') { this.next(); return { k: 'pre', op: t.v, a: this.unary(), line }; }
      if (t.v === '&') this.err('模擬器不支援取址運算（&變數）');
      if (t.v === '*') this.err('模擬器不支援指標（*）');
      if (t.v === '(' && this.isTypeStart(1) && !((this.peek(1).v === 'String' || CLASSES.has(this.peek(1).v)) && this.is('(', 2))) {
        this.next(); const ty = this.parseType(); this.expect(')');
        return { k: 'cast', ty, a: this.unary(), line };
      }
    }
    if (t.t === 'id' && t.v === 'sizeof') {
      this.next();
      if (this.is('(') && this.isTypeStart(1)) {
        this.next(); const ty = this.parseType(); this.expect(')');
        return { k: 'sizeofT', ty, line };
      }
      return { k: 'sizeofE', a: this.unary(), line };
    }
    return this.postfix(this.primary());
  }
  primary() {
    const t = this.peek(), line = t.line;
    if (t.t === 'num') { this.next(); return { k: 'num', v: t.v, t: t.nt, line }; }
    if (t.t === 'str') {
      let s = '';
      while (this.peek().t === 'str') s += this.next().v;
      return { k: 'str', v: s, line };
    }
    if (t.t === 'op' && t.v === '(') { this.next(); const e = this.expr(); this.expect(')'); return e; }
    if (t.t === 'id') {
      this.next();
      if (CLASSES.has(t.v)) {
        if (this.accept('::')) { const n = this.expectId('函式名稱'); return { k: 'scope', cls: t.v, name: n.v, line }; }
        if (this.is('(')) { const args = this.args(); return { k: 'ctor', cls: t.v, args, line }; }
        this.err(`「${t.v}」是類別名稱，宣告物件的寫法例如：${t.v} 名稱;`);
      }
      if ((PRIM.has(t.v) || QUAL.has(t.v)) && this.is('(')) {
        const args = this.args();
        if (t.v === 'String') return { k: 'call', f: { k: 'id', name: 'String', line }, args, line };
        if (args.length !== 1) this.err(`${t.v}(...) 轉型只能放一個值`);
        return { k: 'cast', ty: { t: normType([t.v], 0, line) }, a: args[0], line };
      }
      if (PRIM.has(t.v) || QUAL.has(t.v)) this.err(`這裡不能出現型別「${t.v}」（宣告變數要寫在敘述的開頭）`);
      return { k: 'id', name: t.v, line };
    }
    if (t.t === 'eof') this.err('程式不完整就結束了');
    this.err(`運算式不完整，這裡出現「${tokText(t)}」`);
  }
  args() {
    this.expect('(');
    const a = [];
    if (!this.is(')')) do { a.push(this.assign()); } while (this.accept(','));
    this.expect(')');
    return a;
  }
  postfix(e) {
    while (true) {
      const t = this.peek();
      if (t.t !== 'op') break;
      if (t.v === '(') { const args = this.args(); e = { k: 'call', f: e, args, line: t.line }; continue; }
      if (t.v === '[') { this.next(); const i = this.expr(); this.expect(']'); e = { k: 'idx', a: e, i, line: t.line }; continue; }
      if (t.v === '.') { this.next(); const n = this.expectId('成員名稱'); e = { k: 'mem', a: e, name: n.v, line: t.line }; continue; }
      if (t.v === '->') this.err('模擬器不支援「->」（指標）');
      if (t.v === '++' || t.v === '--') { this.next(); e = { k: 'post', op: t.v, a: e, line: t.line }; continue; }
      break;
    }
    return e;
  }
}

/* --------------------------------------------------------- 閉包產生工具 */
const S = (t, f, d) => ({ t, d: d || 0, sync: true, f });
const A = (t, f, d) => ({ t, d: d || 0, sync: false, f });
const LIT = (t, v) => ({ t, d: 0, sync: true, f: () => v, lit: v });
function toGen(e) {
  if (!e.sync) return e.f;
  const f = e.f;
  return function* (fr) { return f(fr); };
}
function map1(E, fn, t, d) {
  const f = E.f;
  return E.sync ? S(t, fr => fn(f(fr)), d) : A(t, function* (fr) { return fn(yield* f(fr)); }, d);
}
function map2(X, Y, fn, t) {
  if (X.sync && Y.sync) { const a = X.f, b = Y.f; return S(t, fr => fn(a(fr), b(fr))); }
  const a = toGen(X), b = toGen(Y);
  return A(t, function* (fr) { const x = yield* a(fr); const y = yield* b(fr); return fn(x, y); });
}
function evalList(list) {
  // 回傳 {sync, f}：f(fr) 產生值陣列
  const fs = list.map(e => e.f);
  if (list.every(e => e.sync)) {
    const n = fs.length;
    return { sync: true, f: fr => { const out = new Array(n); for (let i = 0; i < n; i++) out[i] = fs[i](fr); return out; } };
  }
  const gs = list.map(toGen);
  return { sync: false, f: function* (fr) { const out = []; for (const g of gs) out.push(yield* g(fr)); return out; } };
}
function mkCall(args, impl, t, isGen) {
  // args: 已轉型的運算式；impl(...vals) 為一般函式，或 generator（isGen）
  const n = args.length;
  if (!isGen && args.every(a => a.sync)) {
    if (n === 0) return S(t, () => impl());
    if (n === 1) { const a = args[0].f; return S(t, fr => impl(a(fr))); }
    if (n === 2) { const a = args[0].f, b = args[1].f; return S(t, fr => impl(a(fr), b(fr))); }
    if (n === 3) { const a = args[0].f, b = args[1].f, c = args[2].f; return S(t, fr => impl(a(fr), b(fr), c(fr))); }
    const L = evalList(args).f;
    return S(t, fr => impl.apply(null, L(fr)));
  }
  const L = evalList(args);
  if (L.sync) {
    const lf = L.f;
    return A(t, function* (fr) { return yield* impl.apply(null, lf(fr)); });
  }
  const lg = L.f;
  return A(t, isGen
    ? function* (fr) { const v = yield* lg(fr); return yield* impl.apply(null, v); }
    : function* (fr) { const v = yield* lg(fr); return impl.apply(null, v); });
}

const CONSTS = {
  HIGH: ['int', 1], LOW: ['int', 0], INPUT: ['int', 0], OUTPUT: ['int', 1], INPUT_PULLUP: ['int', 2],
  LED_BUILTIN: ['int', 13], A0: ['int', 14], A1: ['int', 15], A2: ['int', 16], A3: ['int', 17], A4: ['int', 18], A5: ['int', 19],
  true: ['bool', 1], false: ['bool', 0], DEC: ['int', 10], HEX: ['int', 16], OCT: ['int', 8], BIN: ['int', 2],
  PI: ['float', fround(Math.PI)], HALF_PI: ['float', fround(Math.PI / 2)], TWO_PI: ['float', fround(Math.PI * 2)],
  DEG_TO_RAD: ['float', fround(Math.PI / 180)], RAD_TO_DEG: ['float', fround(180 / Math.PI)], EULER: ['float', fround(Math.E)],
  NULL: ['int', 0], NEO_GRB: ['int', 0x52], NEO_RGB: ['int', 0x06], NEO_GRBW: ['int', 0xD2], NEO_RGBW: ['int', 0xC6],
  NEO_BRG: ['int', 0x58], NEO_KHZ800: ['int', 0], NEO_KHZ400: ['int', 0x100],
  SERIAL_8N1: ['int', 6], LSBFIRST: ['int', 0], MSBFIRST: ['int', 1],
};
const ASYNC_SERIAL = new Set(['parseInt', 'parseFloat', 'readString', 'readStringUntil', 'find', 'readBytes', 'readBytesUntil']);
const ASYNC_BUILTIN = new Set(['delay', 'delayMicroseconds']);
const MAX_DEPTH = 600;

/* ------------------------------------------------------------- 程式產生 */
class Gen {
  constructor(items, M) {
    this.M = M; this.items = items;
    this.G = []; this.gsyms = new Map(); this.fns = new Map();
    this.scope = null; this.fc = null; this.loops = 0; this.switches = 0;
    this.inits = [];
  }
  err(msg, node) { throw new CompileError(msg, node && node.line); }

  build() {
    const M = this.M;
    // 1. 函式登記
    for (const it of this.items) {
      if (it.k !== 'fn') continue;
      if (CONSTS[it.name] || BUILTINS[it.name]) this.err(`「${it.name}」是 Arduino 內建的名稱，請換一個函式名稱`, it);
      let list = this.fns.get(it.name);
      if (!list) this.fns.set(it.name, list = []);
      let fo = list.find(f => f.params.length === it.params.length);
      if (!fo) { fo = { name: it.name, ret: it.ret, params: it.params, node: null, async: false, n: 1, body: null, isGen: false }; list.push(fo); }
      if (fo.ret !== it.ret) this.err(`函式 ${it.name}() 的回傳型別和前面的宣告不一致`, it);
      if (it.body) {
        if (fo.node) this.err(`函式 ${it.name}() 重複定義了兩次`, it);
        fo.node = it; fo.params = it.params;
      }
    }
    for (const [name, list] of this.fns) for (const fo of list) if (!fo.node) this.err(`函式 ${name}() 只有宣告，沒有寫出內容 { }`, { line: 0 });
    const setup = (this.fns.get('setup') || []).find(f => f.params.length === 0);
    const loop = (this.fns.get('loop') || []).find(f => f.params.length === 0);
    if (!setup) this.err('找不到 void setup() 函式（Arduino 程式一定要有 setup 和 loop）', { line: 1 });
    if (!loop) this.err('找不到 void loop() 函式（Arduino 程式一定要有 setup 和 loop）', { line: 1 });
    const serialEvent = (this.fns.get('serialEvent') || []).find(f => f.params.length === 0);
    // 2. 非同步分析（含有迴圈或 delay 的函式需要能暫停）
    let changed = true;
    while (changed) {
      changed = false;
      for (const list of this.fns.values()) for (const fo of list) {
        if (!fo.async && this.scanAsync(fo.node.body)) { fo.async = true; changed = true; }
      }
    }
    // 3. 依照原始碼順序編譯（全域變數須先宣告才能使用）
    this.fc = { n: 1, fo: null, main: true };
    const mainFc = this.fc;
    for (const it of this.items) {
      if (it.k === 'decl') { this.fc = mainFc; this.scope = null; this.declare(it, true); }
      else if (it.k === 'fn' && it.body) {
        const fo = this.fns.get(it.name).find(f => f.node === it);
        this.compileFn(fo);
      }
    }
    const mainN = mainFc.n;
    const inits = this.inits;
    const G = this.G;
    function* callTop(fo) {
      const nf = new Array(fo.n); nf[0] = 0;
      M.t += 1;
      if (fo.isGen) yield* fo.body(nf); else fo.body(nf);
    }
    return function* main() {
      const fr = new Array(mainN);
      for (const st of inits) { if (st.sync) st.f(fr); else yield* st.f(fr); }
      M.line = setup.node.line;
      yield* callTop(setup);
      for (;;) {
        M.line = loop.node.line;
        M.depth = 0;
        yield* callTop(loop);
        M.t += 2;
        if (serialEvent && M.serialAvailable() > 0) yield* callTop(serialEvent);
        if (M.t >= M.until) yield 0;
      }
    };
  }

  scanAsync(node) {
    if (!node || typeof node !== 'object') return false;
    if (Array.isArray(node)) return node.some(n => this.scanAsync(n));
    if (node.k === 'while' || node.k === 'dowhile' || node.k === 'for') return true;
    if (node.k === 'call') {
      const f = node.f;
      if (f.k === 'id') {
        if (ASYNC_BUILTIN.has(f.name)) return true;
        const list = this.fns.get(f.name);
        if (list && list.some(fo => fo.async)) return true;
      }
      if (f.k === 'mem' && f.a.k === 'id' && f.a.name === 'Serial' && ASYNC_SERIAL.has(f.name)) return true;
    }
    for (const key in node) {
      if (key === 'line' || key === 'k') continue;
      const v = node[key];
      if (v && typeof v === 'object' && this.scanAsync(v)) return true;
    }
    return false;
  }

  compileFn(fo) {
    const node = fo.node;
    this.fc = { n: 1, fo };
    this.scope = { vars: new Map(), parent: null };
    for (const p of node.params) {
      if (!p.name) this.err(`函式 ${fo.name}() 的參數需要名稱`, p);
      if (p.t === 'void') this.err('參數不能是 void 型別', p);
      if (this.scope.vars.has(p.name)) this.err(`參數名稱「${p.name}」重複了`, p);
      this.scope.vars.set(p.name, { kind: 'l', slot: this.fc.n++, t: p.t, d: p.d, name: p.name });
    }
    const body = this.block(node.body, false);
    fo.n = this.fc.n;
    if (fo.async) { fo.body = toGen(body); fo.isGen = true; }
    else {
      if (!body.sync) throw new Error('internal: async mismatch in ' + fo.name);
      fo.body = body.f; fo.isGen = false;
    }
    this.scope = null;
  }

  /* ---------------------------------------------------------- 變數 */
  lookup(name) {
    for (let s = this.scope; s; s = s.parent) { const v = s.vars.get(name); if (v) return v; }
    return this.gsyms.get(name) || null;
  }
  addVar(name, sym, node) {
    if (CONSTS[name] && name !== 'NULL') this.err(`「${name}」是 Arduino 內建常數，不能當變數名稱`, node);
    if (name === 'Serial') this.err('「Serial」是內建物件，不能當變數名稱', node);
    if (this.scope) {
      if (this.scope.vars.has(name)) this.err(`變數「${name}」在同一個區塊裡重複宣告`, node);
      this.scope.vars.set(name, sym);
    } else {
      if (this.gsyms.has(name)) this.err(`全域變數「${name}」重複宣告`, node);
      if (this.fns.has(name)) this.err(`「${name}」已經是函式名稱，不能再當變數名稱`, node);
      this.gsyms.set(name, sym);
    }
  }
  declare(node, isGlobal) {
    // 回傳一個敘述 {sync, f}
    const M = this.M, G = this.G;
    const ty = node.ty;
    if (ty.t === 'void') this.err('變數不能宣告成 void', node);
    const stmts = [];
    for (const it of node.items) {
      const d = it.dims.length;
      const isStaticLocal = !isGlobal && ty.isStatic;
      const useGlobal = isGlobal || isStaticLocal;
      const slot = useGlobal ? G.push(undefined) - 1 : this.fc.n++;
      const sym = { kind: useGlobal ? 'g' : 'l', slot, t: ty.t, d, isConst: ty.isConst, name: it.name };
      // 初始化運算式在加入變數之前編譯（int x = x; 這種寫法不允許）
      const initE = this.initExpr(ty, it);
      this.addVar(it.name, sym, it);
      if (ty.isConst && d === 0 && initE.lit !== undefined) sym.lit = initE.lit;
      if (ty.isConst && !it.init && !it.ctor && d === 0) this.err(`常數「${it.name}」宣告時就必須給初始值`, it);
      let st;
      const f = initE.f;
      if (useGlobal) st = initE.sync ? { sync: true, f: fr => { G[slot] = f(fr); return 0; } }
        : { sync: false, f: function* (fr) { G[slot] = yield* f(fr); return 0; } };
      else st = initE.sync ? { sync: true, f: fr => { fr[slot] = f(fr); return 0; } }
        : { sync: false, f: function* (fr) { fr[slot] = yield* f(fr); return 0; } };
      if (useGlobal) this.inits.push(this.withLine(st, it.line));
      else stmts.push(this.withLine(st, it.line));
    }
    return this.seq(stmts);
  }
  defaultVal(t) {
    if (t === 'String' || t === 'cstr') return '';
    return 0;
  }
  initExpr(ty, it) {
    const M = this.M;
    const t = ty.t;
    const d = it.dims.length;
    if (d === 0) {
      if (CLASSES.has(t)) {
        if (it.init) {
          if (it.init.k !== 'ctor' || it.init.cls !== t) this.err(`${t} 物件的初始化寫法不正確`, it);
          return this.ctorExpr(t, it.init.args, it);
        }
        return this.ctorExpr(t, it.ctor || [], it);
      }
      if (it.ctor) {
        if (it.ctor.length !== 1) this.err('變數初始化只能給一個值', it);
        return this.conv(this.ex(it.ctor[0]), t, 0, it);
      }
      if (!it.init) return LIT(t, this.defaultVal(t));
      if (it.init.k === 'list') {
        if (it.init.items.length !== 1 || it.init.items[0].k === 'list') this.err('一般變數只能用一個值初始化', it);
        return this.conv(this.ex(it.init.items[0]), t, 0, it);
      }
      return this.conv(this.ex(it.init), t, 0, it);
    }
    // 陣列
    if (d > 3) this.err('模擬器最多支援三維陣列', it);
    const sizeEs = it.dims.map((de, k) => {
      if (de === null) {
        if (k !== 0) this.err('多維陣列只有第一維可以省略大小', it);
        return null;
      }
      const e = this.conv(this.ex(de), 'long', 0, de);
      return e;
    });
    let initE = null;
    let firstLen = null;
    if (it.init) {
      if (it.init.k === 'str' && (t === 'char' || t === 'byte') && d === 1) {
        const s = it.init.v;
        const codes = [];
        for (let i = 0; i < s.length; i++) codes.push(WRAP[t](s.charCodeAt(i)));
        codes.push(0);
        firstLen = codes.length;
        initE = LIT('list', codes);
      } else {
        if (it.init.k !== 'list') this.err('陣列初始化要用大括號，例如 {1, 2, 3}', it);
        firstLen = it.init.items.length;
        initE = this.listExpr(it.init, t, d, it);
      }
    } else if (it.ctor) this.err('陣列不能這樣初始化', it);
    if (sizeEs[0] === null) {
      if (firstLen === null) this.err(`陣列「${it.name}」沒有給大小，也沒有初始值`, it);
      sizeEs[0] = LIT('int', firstLen);
    }
    const def = CLASSES.has(t) ? (t === 'Servo' ? () => M.newServo() : () => M.newPixels(0, -1, 0)) : this.defaultVal(t);
    const parts = sizeEs.slice();
    if (initE) parts.push(initE);
    const L = evalList(parts);
    const hasInit = !!initE;
    return L.sync
      ? S(t, fr => { const v = L.f(fr); return M.mkArr(hasInit ? v.slice(0, -1) : v, def, hasInit ? v[v.length - 1] : null, 0); }, d)
      : A(t, function* (fr) { const v = yield* L.f(fr); return M.mkArr(hasInit ? v.slice(0, -1) : v, def, hasInit ? v[v.length - 1] : null, 0); }, d);
  }
  listExpr(node, t, d, it) {
    // 回傳巢狀陣列值的運算式
    const parts = node.items.map(x => {
      if (d > 1) {
        if (x.k !== 'list') this.err('多維陣列的初始值請用巢狀大括號，例如 {{1,2},{3,4}}', it);
        return this.listExpr(x, t, d - 1, it);
      }
      if (x.k === 'list') this.err('初始值的大括號層數太多', it);
      return this.conv(this.ex(x), t, 0, x);
    });
    const L = evalList(parts);
    return L.sync ? S('list', L.f) : A('list', L.f);
  }
  ctorExpr(cls, args, node) {
    const M = this.M;
    if (cls === 'Servo') {
      if (args.length) this.err('Servo 物件宣告時不需要參數，請在 setup() 裡用 attach(腳位)', node);
      return S('Servo', () => M.newServo());
    }
    if (args.length === 0) return S(cls, () => M.newPixels(0, -1, 0));
    if (args.length < 2) this.err('Adafruit_NeoPixel 需要參數：(燈珠數量, 腳位, NEO_GRB + NEO_KHZ800)', node);
    const es = [this.conv(this.ex(args[0]), 'uint', 0, node), this.conv(this.ex(args[1]), 'int', 0, node)];
    if (args[2]) es.push(this.conv(this.ex(args[2]), 'uint', 0, node));
    return mkCall(es, (n, p, ty) => M.newPixels(n, p, ty || 0), cls, false);
  }

  /* ---------------------------------------------------------- 敘述 */
  withLine(st, line) {
    const M = this.M;
    if (!line) return st;
    const f = st.f;
    return st.sync ? { sync: true, f: fr => { M.line = line; return f(fr); } }
      : { sync: false, f: function* (fr) { M.line = line; return yield* f(fr); } };
  }
  seq(stmts) {
    const n = stmts.length;
    if (n === 0) return { sync: true, f: () => 0 };
    if (n === 1) return stmts[0];
    const fs = stmts.map(s => s.f);
    if (stmts.every(s => s.sync)) {
      return { sync: true, f: fr => { for (let i = 0; i < n; i++) { const c = fs[i](fr); if (c) return c; } return 0; } };
    }
    const syncs = stmts.map(s => s.sync);
    return {
      sync: false, f: function* (fr) {
        for (let i = 0; i < n; i++) { const c = syncs[i] ? fs[i](fr) : yield* fs[i](fr); if (c) return c; }
        return 0;
      },
    };
  }
  block(node, newScope) {
    if (newScope !== false) this.scope = { vars: new Map(), parent: this.scope };
    const stmts = node.list.map(s => this.stmt(s));
    if (newScope !== false) this.scope = this.scope.parent;
    return this.seq(stmts);
  }
  cond(node) {
    const E = this.ex(node);
    if (E.d) this.err('陣列不能當成條件', node);
    if (E.t === 'void') this.err('這個函式沒有回傳值（void），不能當條件', node);
    if (CLASSES.has(E.t)) this.err('物件不能當條件', node);
    return E;
  }
  stmt(node) {
    const M = this.M;
    const self = this;
    switch (node.k) {
      case 'block': return this.block(node);
      case 'empty': return { sync: true, f: () => 0 };
      case 'decl': return this.declare(node, false);
      case 'expr': {
        const E = this.ex(node.e);
        const f = E.f, ln = node.line;
        return E.sync ? { sync: true, f: fr => { M.line = ln; f(fr); return 0; } }
          : { sync: false, f: function* (fr) { M.line = ln; yield* f(fr); return 0; } };
      }
      case 'if': {
        const C = this.cond(node.c);
        this.scope = { vars: new Map(), parent: this.scope };
        const Ta = this.stmt(node.a);
        this.scope = this.scope.parent;
        let Tb = null;
        if (node.b) { this.scope = { vars: new Map(), parent: this.scope }; Tb = this.stmt(node.b); this.scope = this.scope.parent; }
        const c = C.f, a = Ta.f, b = Tb ? Tb.f : null, ln = node.line;
        if (C.sync && Ta.sync && (!Tb || Tb.sync)) {
          return { sync: true, f: b ? (fr => { M.line = ln; return c(fr) ? a(fr) : b(fr); }) : (fr => { M.line = ln; return c(fr) ? a(fr) : 0; }) };
        }
        const cg = toGen(C), ag = toGen(Ta), bg = Tb ? toGen(Tb) : null;
        return { sync: false, f: function* (fr) { M.line = ln; if (yield* cg(fr)) return yield* ag(fr); return bg ? yield* bg(fr) : 0; } };
      }
      case 'while': case 'dowhile': {
        const C = this.cond(node.c);
        this.loops++;
        this.scope = { vars: new Map(), parent: this.scope };
        const B = this.stmt(node.body);
        this.scope = this.scope.parent;
        this.loops--;
        const ln = node.line;
        const cs = C.sync, c = C.f, bs = B.sync, b = B.f;
        if (node.k === 'while') {
          return {
            sync: false, f: function* (fr) {
              for (;;) {
                if ((M.t += 1) >= M.until) yield 0;
                M.line = ln;
                if (!(cs ? c(fr) : yield* c(fr))) return 0;
                const r = bs ? b(fr) : yield* b(fr);
                if (r === 1) return 0;
                if (r === 3) return 3;
              }
            },
          };
        }
        return {
          sync: false, f: function* (fr) {
            for (;;) {
              if ((M.t += 1) >= M.until) yield 0;
              const r = bs ? b(fr) : yield* b(fr);
              if (r === 1) return 0;
              if (r === 3) return 3;
              M.line = ln;
              if (!(cs ? c(fr) : yield* c(fr))) return 0;
            }
          },
        };
      }
      case 'for': {
        this.scope = { vars: new Map(), parent: this.scope };
        const I = node.init ? (node.init.k === 'decl' ? this.declare(node.init, false) : this.stmt(node.init)) : null;
        const C = node.c ? this.cond(node.c) : null;
        const U = node.u ? this.ex(node.u) : null;
        this.loops++;
        this.scope = { vars: new Map(), parent: this.scope };
        const B = this.stmt(node.body);
        this.scope = this.scope.parent;
        this.loops--;
        this.scope = this.scope.parent;
        const ln = node.line;
        const is = I ? I.sync : true, i = I ? I.f : null;
        const cs = C ? C.sync : true, c = C ? C.f : null;
        const us = U ? U.sync : true, u = U ? U.f : null;
        const bs = B.sync, b = B.f;
        return {
          sync: false, f: function* (fr) {
            M.line = ln;
            if (i) { if (is) i(fr); else yield* i(fr); }
            for (;;) {
              if ((M.t += 1) >= M.until) yield 0;
              M.line = ln;
              if (c && !(cs ? c(fr) : yield* c(fr))) return 0;
              const r = bs ? b(fr) : yield* b(fr);
              if (r === 1) return 0;
              if (r === 3) return 3;
              M.line = ln;
              if (u) { if (us) u(fr); else yield* u(fr); }
            }
          },
        };
      }
      case 'switch': {
        const E = this.ex(node.e);
        if (!isInt(E.t)) this.err('switch 只能用在整數或字元（不能用 float 或 String）', node);
        this.switches++;
        this.scope = { vars: new Map(), parent: this.scope };
        const stmts = []; const labels = []; let defIdx = -1;
        for (const it of node.items) {
          if (it.k === 'case') {
            const V = this.ex(it.e);
            if (V.lit === undefined || !isInt(V.t)) this.err('case 後面要接整數或字元常數（例如 case 1: 或 case \'a\':）', it);
            if (labels.some(l => l.v === V.lit)) this.err(`case ${V.lit} 重複了`, it);
            labels.push({ v: V.lit, idx: stmts.length });
          } else if (it.k === 'default') {
            if (defIdx >= 0) this.err('switch 裡只能有一個 default', it);
            defIdx = stmts.length;
          } else stmts.push(this.stmt(it));
        }
        this.scope = this.scope.parent;
        this.switches--;
        const map = new Map(labels.map(l => [l.v, l.idx]));
        const n = stmts.length, fs = stmts.map(s => s.f), syncs = stmts.map(s => s.sync);
        const ln = node.line;
        if (E.sync && stmts.every(s => s.sync)) {
          const e = E.f;
          return {
            sync: true, f: fr => {
              M.line = ln;
              let st = map.get(e(fr)); if (st === undefined) st = defIdx;
              if (st < 0) return 0;
              for (let i = st; i < n; i++) { const r = fs[i](fr); if (r === 1) return 0; if (r) return r; }
              return 0;
            },
          };
        }
        const eg = toGen(E);
        return {
          sync: false, f: function* (fr) {
            M.line = ln;
            let st = map.get(yield* eg(fr)); if (st === undefined) st = defIdx;
            if (st < 0) return 0;
            for (let i = st; i < n; i++) { const r = syncs[i] ? fs[i](fr) : yield* fs[i](fr); if (r === 1) return 0; if (r) return r; }
            return 0;
          },
        };
      }
      case 'break':
        if (!this.loops && !this.switches) this.err('break 只能用在迴圈或 switch 裡', node);
        return { sync: true, f: () => 1 };
      case 'continue':
        if (!this.loops) this.err('continue 只能用在迴圈裡', node);
        return { sync: true, f: () => 2 };
      case 'return': {
        const fo = this.fc.fo;
        if (!node.e) {
          return { sync: true, f: () => 3 };
        }
        if (fo.ret === 'void') this.err(`函式 ${fo.name}() 是 void，不能 return 一個值`, node);
        const E = this.conv(this.ex(node.e), fo.ret, 0, node);
        const f = E.f, ln = node.line;
        return E.sync ? { sync: true, f: fr => { M.line = ln; fr[0] = f(fr); return 3; } }
          : { sync: false, f: function* (fr) { M.line = ln; fr[0] = yield* f(fr); return 3; } };
      }
    }
    this.err('不支援的敘述', node);
  }

  /* ---------------------------------------------------------- 轉型 */
  conv(E, t, d, node) {
    const M = this.M;
    d = d || 0;
    if (E.t === 'void') this.err('這個函式沒有回傳值（void），不能當成數值使用', node);
    if (d > 0 || E.d > 0) {
      if (E.d === d && (E.t === t || (d > 0 && isInt(E.t) && isInt(t) && SIZEOF[E.t] === SIZEOF[t]))) return E;
      if (d === 0 && E.d === 1 && (E.t === 'char' || E.t === 'byte') && isStr(t)) return map1(E, a => M.carrToStr(a), t);
      if (d === 0 && E.d > 0) this.err(`這裡需要 ${tname(t, d)}，但「${this.nodeName(node)}」是陣列（是不是少了 [索引]？）`, node);
      this.err(`型別不符：需要 ${tname(t, d)}，卻給了 ${tname(E.t, E.d)}`, node);
    }
    if (E.t === t) return E;
    if (isNum(t)) {
      if (!isNum(E.t)) {
        if (isStr(E.t)) this.err(`字串不能直接當成數字使用（可以用 .toInt() 轉換）`, node);
        this.err(`型別不符：需要 ${tname(t)}，卻給了 ${tname(E.t)}`, node);
      }
      if (t === 'float') {
        if (E.lit !== undefined) return LIT('float', fround(E.lit));
        return Object.assign({}, E, { t: 'float' });
      }
      if (isInt(E.t) && fits(E.t, t)) return Object.assign({}, E, { t });
      const w = WRAP[t];
      if (E.lit !== undefined) return LIT(t, w(E.lit));
      return map1(E, w, t);
    }
    if (t === 'String') {
      if (E.t === 'cstr') return Object.assign({}, E, { t: 'String' });
      const et = E.t;
      if (!isNum(et)) this.err(`無法把 ${tname(et)} 轉成 String`, node);
      return map1(E, v => M.toStr(v, et), 'String');
    }
    if (t === 'cstr') {
      if (E.t === 'String') return Object.assign({}, E, { t: 'cstr' });
      this.err(`這裡需要字串，卻給了 ${tname(E.t)}`, node);
    }
    this.err(`型別不符：需要 ${tname(t)}，卻給了 ${tname(E.t)}`, node);
  }
  nodeName(node) {
    if (!node) return '';
    if (node.k === 'id') return node.name;
    if (node.k === 'idx') return this.nodeName(node.a) + '[...]';
    return '這個值';
  }
  num(node) {
    const E = this.ex(node);
    if (E.d) this.err(`「${this.nodeName(node)}」是陣列，不能直接拿來計算（是不是少了 [索引]？）`, node);
    if (!isNum(E.t)) {
      if (E.t === 'void') this.err('這個函式沒有回傳值（void），不能拿來計算', node);
      this.err(`${tname(E.t)} 不能拿來做數學運算`, node);
    }
    return E;
  }

  /* ---------------------------------------------------------- 運算式 */
  ex(node) {
    const M = this.M, G = this.G;
    switch (node.k) {
      case 'num': return LIT(node.t, node.v);
      case 'str': return LIT('cstr', node.v);
      case 'id': {
        const sym = this.lookup(node.name);
        if (sym) {
          if (sym.lit !== undefined) return LIT(sym.t, sym.lit);
          const s = sym.slot;
          return sym.kind === 'l' ? S(sym.t, fr => fr[s], sym.d) : S(sym.t, () => G[s], sym.d);
        }
        const c = CONSTS[node.name];
        if (c) return LIT(c[0], c[1]);
        if (node.name === 'Serial') return LIT('bool', 1);
        if (/^B[01]{1,8}$/.test(node.name)) return LIT('int', parseInt(node.name.slice(1), 2));
        if (this.fns.has(node.name) || BUILTINS[node.name]) this.err(`「${node.name}」是函式，呼叫時要加上括號，例如 ${node.name}()`, node);
        this.err(`「${node.name}」沒有宣告${this.suggest(node.name)}`, node);
        break;
      }
      case 'comma': {
        const es = node.list.map(e => this.ex(e));
        const last = es[es.length - 1];
        const L = evalList(es);
        return L.sync ? S(last.t, fr => { const v = L.f(fr); return v[v.length - 1]; }, last.d)
          : A(last.t, function* (fr) { const v = yield* L.f(fr); return v[v.length - 1]; }, last.d);
      }
      case 'cond': {
        const C = this.cond(node.c);
        let X = this.ex(node.a), Y = this.ex(node.b);
        let t;
        if (isNum(X.t) && isNum(Y.t) && !X.d && !Y.d) t = (X.t === 'bool' && Y.t === 'bool') ? 'bool' : arith(X.t, Y.t);
        else if (isStr(X.t) && isStr(Y.t)) t = (X.t === 'String' || Y.t === 'String') ? 'String' : 'cstr';
        else if ((X.t === 'String' && isNum(Y.t)) || (Y.t === 'String' && isNum(X.t))) t = 'String';
        else if (X.t === Y.t && X.d === Y.d) t = X.t;
        else this.err('「? :」兩邊的型別不一致', node);
        X = this.conv(X, t, X.d, node); Y = this.conv(Y, t, Y.d, node);
        if (C.sync && X.sync && Y.sync) { const c = C.f, a = X.f, b = Y.f; return S(t, fr => c(fr) ? a(fr) : b(fr), X.d); }
        const cg = toGen(C), ag = toGen(X), bg = toGen(Y);
        return A(t, function* (fr) { return (yield* cg(fr)) ? yield* ag(fr) : yield* bg(fr); }, X.d);
      }
      case 'log': {
        const X = this.cond(node.a), Y = this.cond(node.b);
        const and = node.op === '&&';
        if (X.lit !== undefined && Y.lit !== undefined) return LIT('bool', and ? (X.lit && Y.lit ? 1 : 0) : (X.lit || Y.lit ? 1 : 0));
        if (X.sync && Y.sync) {
          const a = X.f, b = Y.f;
          return S('bool', and ? (fr => (a(fr) && b(fr)) ? 1 : 0) : (fr => (a(fr) || b(fr)) ? 1 : 0));
        }
        const ag = toGen(X), bg = toGen(Y);
        return A('bool', and ? function* (fr) { return ((yield* ag(fr)) && (yield* bg(fr))) ? 1 : 0; }
          : function* (fr) { return ((yield* ag(fr)) || (yield* bg(fr))) ? 1 : 0; });
      }
      case 'bin': return this.binary(node);
      case 'un': {
        if (node.op === '!') {
          const X = this.cond(node.a);
          if (X.lit !== undefined) return LIT('bool', X.lit ? 0 : 1);
          return map1(X, v => v ? 0 : 1, 'bool');
        }
        const X = this.num(node.a);
        const t = promote(X.t);
        let fn;
        if (node.op === '+') fn = v => v;
        else if (node.op === '-') fn = t === 'float' ? (v => -v) : (v => WRAP[t](-v));
        else {
          if (t === 'float') this.err('~ 只能用在整數', node);
          fn = v => WRAP[t](~v);
        }
        if (X.lit !== undefined) return LIT(t, fn(X.lit));
        return map1(X, fn, t);
      }
      case 'cast': {
        const E = this.ex(node.a);
        const t = node.ty.t;
        if (t === 'void') return map1(E, () => undefined, 'void');
        if (isNum(t) && !isNum(E.t)) {
          if (isStr(E.t)) this.err(`字串不能用 (${tname(t)}) 轉成數字，請用 .toInt() 或 .toFloat()`, node);
        }
        return this.conv(E, t, 0, node);
      }
      case 'sizeofT': return LIT('uint', SIZEOF[node.ty.t] || 2);
      case 'sizeofE': {
        const E = this.ex(node.a);
        const es = SIZEOF[E.t] || 2;
        if (E.d) {
          const f = E.f;
          if (!E.sync) this.err('sizeof 裡面不能呼叫函式', node);
          return S('uint', fr => M.arrBytes(f(fr), es));
        }
        if (E.t === 'cstr' && E.lit !== undefined) return LIT('uint', E.lit.length + 1);
        return LIT('uint', es);
      }
      case 'idx': {
        const B = this.ex(node.a);
        const I = this.num(node.i);
        if (I.t === 'float') this.err('陣列索引必須是整數', node.i);
        if (B.d > 0) {
          const name = this.nodeName(node.a);
          const E = map2(B, I, (a, i) => { if (!(i >= 0 && i < a.length)) M.oob(name, i, a.length); return a[i]; }, B.t);
          E.d = B.d - 1;
          return E;
        }
        if (isStr(B.t)) return map2(B, I, (s, i) => (i >= 0 && i < s.length) ? WRAP.char(s.charCodeAt(i)) : 0, 'char');
        this.err(`「${this.nodeName(node.a)}」不是陣列，不能用 [ ]`, node);
        break;
      }
      case 'asg': return this.assignment(node);
      case 'pre': case 'post': {
        const one = node.op === '++' ? 1 : -1;
        const post = node.k === 'post';
        return this.update(node.a, null, (old, _r, t) => {
          if (t === 'float') return fround(old + one);
          if (t === 'bool') return one > 0 ? 1 : (old ? 0 : 1);
          return WRAP[t](old + one);
        }, post, node);
      }
      case 'call': return this.call(node);
      case 'ctor': return this.ctorExpr(node.cls, node.args, node);
      case 'mem': this.err(`「.${node.name}」後面要加括號呼叫，例如 .${node.name}()`, node); break;
      case 'scope': this.err(`${node.cls}::${node.name} 要加括號呼叫`, node); break;
      case 'list': this.err('大括號 { } 只能用在陣列初始化', node); break;
    }
    this.err('不支援的運算式', node);
  }

  suggest(name) {
    const low = name.toLowerCase();
    const cands = [...Object.keys(BUILTINS), ...Object.keys(CONSTS), ...this.fns.keys(), ...this.gsyms.keys()];
    for (let s = this.scope; s; s = s.parent) cands.push(...s.vars.keys());
    const hit = cands.find(c => c.toLowerCase() === low);
    if (hit) return `（大小寫要完全一樣，是不是要寫「${hit}」？）`;
    if (name === 'serial') return '（應該是 Serial，S 要大寫）';
    return '（是不是拼錯字，或忘了宣告這個變數？）';
  }

  binary(node) {
    const M = this.M;
    const op = node.op;
    let X = this.ex(node.a), Y = this.ex(node.b);
    if (X.d || Y.d) {
      if ((X.d === 1 && (X.t === 'char' || X.t === 'byte')) && (Y.t === 'String')) X = this.conv(X, 'String', 0, node.a);
      else if ((Y.d === 1 && (Y.t === 'char' || Y.t === 'byte')) && (X.t === 'String')) Y = this.conv(Y, 'String', 0, node.b);
      else this.err(`「${this.nodeName(X.d ? node.a : node.b)}」是陣列，不能直接拿來運算（是不是少了 [索引]？）`, node);
    }
    // 字串
    if (isStr(X.t) || isStr(Y.t)) {
      if (op === '+') {
        if (X.t === 'cstr' && Y.t === 'cstr') this.err('兩個字串常數不能直接用 + 相接，請寫成 String("...") + "..."', node);
        if (X.t !== 'String' && Y.t !== 'String') this.err('C++ 的「"文字" + 數字」不會把字串接起來！請改成 String("文字") + 數字，或分成兩次 print', node);
        const xt = X.t, yt = Y.t;
        if (!isStr(xt) && !isNum(xt)) this.err(`${tname(xt)} 不能和字串相加`, node);
        if (!isStr(yt) && !isNum(yt)) this.err(`${tname(yt)} 不能和字串相加`, node);
        return map2(X, Y, (a, b) => M.toStr(a, xt) + M.toStr(b, yt), 'String');
      }
      if (['==', '!=', '<', '>', '<=', '>='].includes(op)) {
        if (!(isStr(X.t) && isStr(Y.t))) this.err('字串只能和字串比較', node);
        if (X.t === 'cstr' && Y.t === 'cstr') this.err('兩個字串常數不能用 == 比較，請把其中一個寫成 String 變數', node);
        const cmp = { '==': (a, b) => a === b ? 1 : 0, '!=': (a, b) => a !== b ? 1 : 0, '<': (a, b) => a < b ? 1 : 0,
          '>': (a, b) => a > b ? 1 : 0, '<=': (a, b) => a <= b ? 1 : 0, '>=': (a, b) => a >= b ? 1 : 0 }[op];
        return map2(X, Y, cmp, 'bool');
      }
      this.err(`字串不能使用「${op}」運算`, node);
    }
    if (!isNum(X.t)) this.num(node.a);
    if (!isNum(Y.t)) this.num(node.b);
    const fn = this.binFn(op, X.t, Y.t, node);
    const rt = fn.t;
    if (X.lit !== undefined && Y.lit !== undefined) {
      try { return LIT(rt, fn.f(X.lit, Y.lit)); } catch (e) { /* 執行時再報錯 */ }
    }
    return map2(X, Y, fn.f, rt);
  }
  binFn(op, xt, yt, node) {
    const M = this.M;
    if (op === '<<' || op === '>>') {
      const t = promote(xt);
      if (t === 'float' || yt === 'float') this.err('位移運算只能用在整數', node);
      const w = WRAP[t];
      if (op === '<<') return { t, f: (a, b) => w(a << (b & 31)) };
      return { t, f: (t === 'uint' || t === 'ulong') ? ((a, b) => w(a >>> (b & 31))) : ((a, b) => w(a >> (b & 31))) };
    }
    const t = arith(xt, yt);
    const cx = (xt !== t && !fits(xt, t)) ? WRAP[t] : null;
    const cy = (yt !== t && !fits(yt, t)) ? WRAP[t] : null;
    const w = WRAP[t];
    let f;
    const isF = t === 'float';
    switch (op) {
      case '+': f = isF ? ((a, b) => fround(a + b)) : ((a, b) => w(a + b)); break;
      case '-': f = isF ? ((a, b) => fround(a - b)) : ((a, b) => w(a - b)); break;
      case '*': f = isF ? ((a, b) => fround(a * b)) : (t === 'long' || t === 'ulong') ? ((a, b) => w(Math.imul(a, b))) : ((a, b) => w(a * b)); break;
      case '/': f = isF ? ((a, b) => fround(a / b)) : ((a, b) => { if (b === 0) M.err('除以 0：整數除法的分母不能是 0'); return w(Math.trunc(a / b)); }); break;
      case '%':
        if (isF) this.err('% 只能用在整數（float 請用 fmod）', node);
        f = (a, b) => { if (b === 0) M.err('除以 0：% 的右邊不能是 0'); return w(a % b); }; break;
      case '&': case '|': case '^':
        if (isF) this.err(`「${op}」只能用在整數`, node);
        f = op === '&' ? ((a, b) => w(a & b)) : op === '|' ? ((a, b) => w(a | b)) : ((a, b) => w(a ^ b)); break;
      case '==': return { t: 'bool', f: wrapC(cx, cy, (a, b) => a === b ? 1 : 0) };
      case '!=': return { t: 'bool', f: wrapC(cx, cy, (a, b) => a !== b ? 1 : 0) };
      case '<': return { t: 'bool', f: wrapC(cx, cy, (a, b) => a < b ? 1 : 0) };
      case '>': return { t: 'bool', f: wrapC(cx, cy, (a, b) => a > b ? 1 : 0) };
      case '<=': return { t: 'bool', f: wrapC(cx, cy, (a, b) => a <= b ? 1 : 0) };
      case '>=': return { t: 'bool', f: wrapC(cx, cy, (a, b) => a >= b ? 1 : 0) };
      default: this.err(`不支援的運算「${op}」`, node);
    }
    return { t, f: wrapC(cx, cy, f) };
    function wrapC(cx, cy, g) {
      if (!cx && !cy) return g;
      return (a, b) => g(cx ? cx(a) : a, cy ? cy(b) : b);
    }
  }

  /* ---------------------------------------------------------- 指定 */
  lval(node) {
    const G = this.G, M = this.M;
    if (node.k === 'id') {
      const sym = this.lookup(node.name);
      if (!sym) {
        if (CONSTS[node.name]) this.err(`「${node.name}」是內建常數，不能修改`, node);
        this.err(`「${node.name}」沒有宣告${this.suggest(node.name)}`, node);
      }
      if (sym.isConst) this.err(`「${node.name}」是常數（const），不能修改`, node);
      const s = sym.slot;
      if (sym.kind === 'l') return { t: sym.t, d: sym.d, sync: true, get: fr => fr[s], set: (fr, v) => { fr[s] = v; } };
      return { t: sym.t, d: sym.d, sync: true, get: () => G[s], set: (fr, v) => { G[s] = v; } };
    }
    if (node.k === 'idx') {
      const B = this.ex(node.a);
      const I = this.num(node.i);
      if (I.t === 'float') this.err('陣列索引必須是整數', node.i);
      if (B.d > 0) {
        if (node.a.k === 'id') { const sym = this.lookup(node.a.name); if (sym && sym.isConst) this.err(`「${node.a.name}」是常數陣列，不能修改`, node); }
        return { t: B.t, d: B.d - 1, sync: false, arr: B, idx: I, name: this.nodeName(node.a) };
      }
      if (B.t === 'String') {
        const inner = this.lval(node.a);
        if (!inner.get) this.err('只能修改 String 變數裡的字元', node);
        return { t: 'char', d: 0, sync: false, str: inner, idx: I };
      }
      if (B.t === 'cstr') this.err('字串常數不能修改，請改用 String 或 char 陣列', node);
      this.err(`「${this.nodeName(node.a)}」不是陣列，不能用 [ ]`, node);
    }
    if (node.k === 'cast') this.err('轉型後的值不能被指定', node);
    this.err('等號左邊必須是變數（例如 x = 5;）', node);
  }
  // compute(old, r, t) → new value；post 為 true 時回傳舊值
  update(lvNode, R, compute, post, node) {
    const M = this.M;
    const L = this.lval(lvNode);
    const t = L.t;
    if (L.d > 0) this.err('陣列不能整個指定，請用迴圈逐一設定元素', node);
    if (R === null && !isNum(t)) this.err(`${tname(t)} 不能使用 ++ 或 --`, node);
    const rf = R ? R.f : null;
    const rsync = !R || R.sync;
    if (L.get) {
      const get = L.get, set = L.set;
      if (rsync) {
        return S(t, fr => { const r = rf ? rf(fr) : 0; const old = get(fr); const nv = compute(old, r, t); set(fr, nv); return post ? old : nv; });
      }
      return A(t, function* (fr) { const r = yield* rf(fr); const old = get(fr); const nv = compute(old, r, t); set(fr, nv); return post ? old : nv; });
    }
    if (L.arr) {
      const B = L.arr, I = L.idx, name = L.name;
      if (B.sync && I.sync && rsync) {
        const b = B.f, i = I.f;
        return S(t, fr => {
          const a = b(fr), k = i(fr);
          if (!(k >= 0 && k < a.length)) M.oob(name, k, a.length);
          const r = rf ? rf(fr) : 0; const old = a[k]; const nv = compute(old, r, t); a[k] = nv; return post ? old : nv;
        });
      }
      const bg = toGen(B), ig = toGen(I), rg = R ? toGen(R) : null;
      return A(t, function* (fr) {
        const a = yield* bg(fr), k = yield* ig(fr);
        if (!(k >= 0 && k < a.length)) M.oob(name, k, a.length);
        const r = rg ? yield* rg(fr) : 0; const old = a[k]; const nv = compute(old, r, t); a[k] = nv; return post ? old : nv;
      });
    }
    if (L.str) {
      const inner = L.str, ig = toGen(L.idx), rg = R ? toGen(R) : null;
      const gen = function* (fr) {
        const s = inner.get(fr), k = yield* ig(fr);
        const r = rg ? yield* rg(fr) : 0;
        if (!(k >= 0 && k < s.length)) return 0;
        const old = WRAP.char(s.charCodeAt(k)); const nv = compute(old, r, 'char');
        inner.set(fr, s.slice(0, k) + String.fromCharCode(nv & 255) + s.slice(k + 1));
        return post ? old : nv;
      };
      if (L.idx.sync && rsync) {
        return S('char', fr => { const g = gen(fr); let x = g.next(); while (!x.done) x = g.next(); return x.value; });
      }
      return A('char', gen);
    }
    this.err('無法指定', node);
  }
  assignment(node) {
    const M = this.M;
    const L0 = this.lval(node.a);
    const t = L0.t;
    if (L0.d > 0) this.err('陣列不能整個用 = 指定，請用迴圈逐一設定元素', node);
    if (CLASSES.has(t)) {
      if (node.op !== '=') this.err('物件不能這樣運算', node);
      const R = this.ex(node.b);
      if (R.t !== t) this.err(`型別不符：需要 ${t} 物件`, node);
      return this.update(node.a, R, (o, r) => r, false, node);
    }
    if (node.op === '=') {
      const R = this.conv(this.ex(node.b), t, 0, node.b);
      return this.update(node.a, R, (o, r) => r, false, node);
    }
    const bop = node.op.slice(0, -1);
    if (t === 'String') {
      if (bop !== '+') this.err(`String 不能使用「${node.op}」`, node);
      const R = this.ex(node.b);
      const rt = R.t;
      if (R.d && !(R.d === 1 && (rt === 'char' || rt === 'byte'))) this.err('不能把陣列加到字串上', node);
      const R2 = R.d ? this.conv(R, 'String', 0, node) : R;
      const rt2 = R2.t;
      if (!isStr(rt2) && !isNum(rt2)) this.err(`${tname(rt2)} 不能加到字串上`, node);
      return this.update(node.a, R2, (o, r) => o + M.toStr(r, rt2), false, node);
    }
    if (!isNum(t)) this.err(`${tname(t)} 不能使用「${node.op}」`, node);
    const R = this.num(node.b);
    const fn = this.binFn(bop, t, R.t, node);
    const f = fn.f, w = WRAP[t];
    return this.update(node.a, R, (o, r) => w(f(o, r)), false, node);
  }

  /* ---------------------------------------------------------- 呼叫 */
  call(node) {
    const f = node.f;
    if (f.k === 'id') {
      const list = this.fns.get(f.name);
      if (list && !this.lookup(f.name)) {
        const fo = list.find(x => x.params.length === node.args.length);
        if (!fo) this.err(`函式 ${f.name}() 的參數數量不對：需要 ${list.map(x => x.params.length).join(' 或 ')} 個，卻給了 ${node.args.length} 個`, node);
        return this.userCall(fo, node);
      }
      const b = BUILTINS[f.name];
      if (b) return b(this, node.args, node);
      if (this.lookup(f.name)) this.err(`「${f.name}」是變數，不是函式`, node);
      this.err(`找不到函式「${f.name}」${this.suggest(f.name)}`, node);
    }
    if (f.k === 'mem') {
      if (f.a.k === 'id' && f.a.name === 'Serial' && !this.lookup('Serial')) {
        const m = SERIAL[f.name];
        if (!m) this.err(`Serial 沒有「${f.name}」這個功能${f.name.toLowerCase() === 'println' || f.name.toLowerCase() === 'print' ? '（注意大小寫：print / println）' : ''}`, node);
        return m(this, node.args, node);
      }
      const O = this.ex(f.a);
      if (O.d) this.err(`「${this.nodeName(f.a)}」是陣列，要先用 [索引] 取出元素`, node);
      if (isStr(O.t)) return strMethod(this, O, f, node);
      if (O.t === 'Servo') return objMethod(this, O, f.name, node, SERVO_M);
      if (O.t === 'Adafruit_NeoPixel') return objMethod(this, O, f.name, node, PIXEL_M);
      this.err(`${tname(O.t)} 沒有「.${f.name}()」這個功能`, node);
    }
    if (f.k === 'scope') {
      if (f.cls === 'Adafruit_NeoPixel' && (f.name === 'Color' || f.name === 'ColorHSV' || f.name === 'gamma32' || f.name === 'gamma8')) {
        return PIXEL_M[f.name](this, null, node.args, node);
      }
      this.err(`不支援 ${f.cls}::${f.name}`, node);
    }
    this.err('這個東西不能被呼叫', node);
  }
  userCall(fo, node) {
    const M = this.M;
    const args = node.args.map((a, i) => {
      const p = fo.params[i];
      const E = this.ex(a);
      if (p.d > 0) {
        if (E.d !== p.d || (E.t !== p.t && !(isInt(E.t) && isInt(p.t) && SIZEOF[E.t] === SIZEOF[p.t]))) {
          this.err(`函式 ${fo.name}() 第 ${i + 1} 個參數需要 ${tname(p.t, p.d)}，卻給了 ${tname(E.t, E.d)}`, a);
        }
        return E;
      }
      if (CLASSES.has(p.t)) { if (E.t !== p.t || E.d) this.err(`參數需要 ${p.t} 物件`, a); return E; }
      return this.conv(E, p.t, 0, a);
    });
    const n = args.length;
    const ret = fo.ret;
    const ns = args.length;
    if (!fo.async && args.every(a => a.sync)) {
      const fs = args.map(a => a.f);
      return S(ret, fr => {
        const nf = new Array(fo.n); nf[0] = 0;
        for (let i = 0; i < ns; i++) nf[i + 1] = fs[i](fr);
        if (++M.depth > MAX_DEPTH) M.overflow();
        M.t += 1;
        if ((++M.calls & 0xffff) === 0) M.wallCheck();
        fo.body(nf);
        M.depth--;
        return nf[0];
      });
    }
    const gs = args.map(toGen);
    return A(ret, function* (fr) {
      const nf = new Array(fo.n); nf[0] = 0;
      for (let i = 0; i < n; i++) nf[i + 1] = yield* gs[i](fr);
      if (++M.depth > MAX_DEPTH) M.overflow();
      if ((M.t += 1) >= M.until) yield 0;
      if (fo.isGen) yield* fo.body(nf); else fo.body(nf);
      M.depth--;
      return nf[0];
    });
  }
  args(args, types, node, fname) {
    if (args.length !== types.length) this.err(`${fname}() 需要 ${types.length} 個參數，卻給了 ${args.length} 個`, node);
    return args.map((a, i) => types[i] === '*' ? this.ex(a) : this.conv(this.ex(a), types[i], 0, a));
  }
}

/* --------------------------------------------------------------- 內建函式 */
function simple(types, ret, implOf, isGen) {
  // types 可以是陣列（固定參數）或陣列的陣列（多種參數數量）
  return (g, args, node) => {
    const name = node.f.name;
    let ts = types;
    if (Array.isArray(types[0])) {
      ts = types.find(x => x.length === args.length);
      if (!ts) g.err(`${name}() 的參數數量不對（可以是 ${types.map(x => x.length).join(' 或 ')} 個）`, node);
    }
    const es = g.args(args, ts, node, name);
    return mkCall(es, implOf(g.M, es), ret, isGen);
  };
}
function numGeneric(fn, minArgs, name) {
  // min/max/abs/constrain/sq：結果型別依參數決定
  return (g, args, node) => {
    if (args.length !== minArgs) g.err(`${name}() 需要 ${minArgs} 個參數`, node);
    const es = args.map(a => g.num(a));
    let t = es.reduce((acc, e) => acc ? arith(acc, e.t) : promote(e.t), null);
    const conv = es.map(e => g.conv(e, t, 0, node));
    const w = WRAP[t];
    return mkCall(conv, (...v) => w(fn(...v)), t, false);
  };
}
const BUILTINS = {
  pinMode: simple(['byte', 'byte'], 'void', M => (p, m) => M.pinMode(p, m)),
  digitalWrite: simple(['byte', 'byte'], 'void', M => (p, v) => M.digitalWrite(p, v)),
  digitalRead: simple(['byte'], 'int', M => p => M.digitalRead(p)),
  analogRead: simple(['byte'], 'int', M => p => M.analogRead(p)),
  analogWrite: simple(['byte', 'int'], 'void', M => (p, v) => M.analogWrite(p, v)),
  analogReference: simple(['byte'], 'void', () => () => undefined),
  delay: simple(['ulong'], 'void', M => function* (ms) { yield* M.delay(ms); }, true),
  delayMicroseconds: simple(['uint'], 'void', M => function* (us) { yield* M.delayUs(us); }, true),
  millis: simple([], 'ulong', M => () => M.millis()),
  micros: simple([], 'ulong', M => () => M.micros()),
  tone: simple([['byte', 'uint'], ['byte', 'uint', 'ulong']], 'void', M => (p, f, d) => M.tone(p, f, d || 0)),
  noTone: simple(['byte'], 'void', M => p => M.noTone(p)),
  random: simple([['long'], ['long', 'long']], 'long', M => (a, b) => b === undefined ? M.random(a) : M.random2(a, b)),
  randomSeed: simple(['ulong'], 'void', M => s => M.randomSeed(s)),
  map: simple(['long', 'long', 'long', 'long', 'long'], 'long', M => (x, a, b, c, d) => {
    if (b === a) M.err('map() 的輸入範圍不能相同（會除以 0）');
    return WRAP.long(Math.trunc(((x - a) * (d - c)) / (b - a)) + c);
  }),
  min: numGeneric((a, b) => a < b ? a : b, 2, 'min'),
  max: numGeneric((a, b) => a > b ? a : b, 2, 'max'),
  abs: numGeneric(a => a < 0 ? -a : a, 1, 'abs'),
  sq: numGeneric(a => a * a, 1, 'sq'),
  constrain: numGeneric((x, a, b) => x < a ? a : x > b ? b : x, 3, 'constrain'),
  pow: simple(['float', 'float'], 'float', () => (a, b) => fround(Math.pow(a, b))),
  sqrt: simple(['float'], 'float', () => a => fround(Math.sqrt(a))),
  sin: simple(['float'], 'float', () => a => fround(Math.sin(a))),
  cos: simple(['float'], 'float', () => a => fround(Math.cos(a))),
  tan: simple(['float'], 'float', () => a => fround(Math.tan(a))),
  asin: simple(['float'], 'float', () => a => fround(Math.asin(a))),
  acos: simple(['float'], 'float', () => a => fround(Math.acos(a))),
  atan: simple(['float'], 'float', () => a => fround(Math.atan(a))),
  atan2: simple(['float', 'float'], 'float', () => (a, b) => fround(Math.atan2(a, b))),
  exp: simple(['float'], 'float', () => a => fround(Math.exp(a))),
  log: simple(['float'], 'float', () => a => fround(Math.log(a))),
  log10: simple(['float'], 'float', () => a => fround(Math.log10(a))),
  fabs: simple(['float'], 'float', () => a => Math.abs(a)),
  floor: simple(['float'], 'float', () => a => Math.floor(a)),
  ceil: simple(['float'], 'float', () => a => Math.ceil(a)),
  trunc: simple(['float'], 'float', () => a => Math.trunc(a)),
  fmod: simple(['float', 'float'], 'float', () => (a, b) => fround(a % b)),
  round: simple(['float'], 'long', () => x => WRAP.long(x >= 0 ? Math.trunc(x + 0.5) : Math.trunc(x - 0.5))),
  radians: simple(['float'], 'float', () => d => fround(d * Math.PI / 180)),
  degrees: simple(['float'], 'float', () => r => fround(r * 180 / Math.PI)),
  bitRead: simple(['ulong', 'byte'], 'int', () => (x, n) => (x >>> n) & 1),
  bit: simple(['byte'], 'ulong', () => n => (1 << n) >>> 0),
  lowByte: simple(['ulong'], 'byte', () => x => x & 255),
  highByte: simple(['ulong'], 'byte', () => x => (x >>> 8) & 255),
  bitSet: (g, args, node) => bitMod(g, args, node, (x, n) => x | (1 << n), 2),
  bitClear: (g, args, node) => bitMod(g, args, node, (x, n) => x & ~(1 << n), 2),
  bitWrite: (g, args, node) => bitMod(g, args, node, (x, n, b) => b ? (x | (1 << n)) : (x & ~(1 << n)), 3),
  isDigit: simple(['int'], 'bool', () => c => (c >= 48 && c <= 57) ? 1 : 0),
  isAlpha: simple(['int'], 'bool', () => c => ((c | 32) >= 97 && (c | 32) <= 122) ? 1 : 0),
  isAlphaNumeric: simple(['int'], 'bool', () => c => ((c >= 48 && c <= 57) || ((c | 32) >= 97 && (c | 32) <= 122)) ? 1 : 0),
  isSpace: simple(['int'], 'bool', () => c => (c === 32 || (c >= 9 && c <= 13)) ? 1 : 0),
  isWhitespace: simple(['int'], 'bool', () => c => (c === 32 || c === 9) ? 1 : 0),
  isUpperCase: simple(['int'], 'bool', () => c => (c >= 65 && c <= 90) ? 1 : 0),
  isLowerCase: simple(['int'], 'bool', () => c => (c >= 97 && c <= 122) ? 1 : 0),
  isPunct: simple(['int'], 'bool', () => c => (c > 32 && c < 127 && !((c >= 48 && c <= 57) || ((c | 32) >= 97 && (c | 32) <= 122))) ? 1 : 0),
  isPrintable: simple(['int'], 'bool', () => c => (c >= 32 && c < 127) ? 1 : 0),
  toupper: simple(['int'], 'int', () => c => (c >= 97 && c <= 122) ? c - 32 : c),
  tolower: simple(['int'], 'int', () => c => (c >= 65 && c <= 90) ? c + 32 : c),
  toUpperCase: simple(['int'], 'int', () => c => (c >= 97 && c <= 122) ? c - 32 : c),
  toLowerCase: simple(['int'], 'int', () => c => (c >= 65 && c <= 90) ? c + 32 : c),
  strlen: (g, args, node) => {
    if (args.length !== 1) g.err('strlen() 需要 1 個參數', node);
    const E = g.conv(g.ex(args[0]), 'cstr', 0, args[0]);
    return map1(E, s => s.length, 'uint');
  },
  strcmp: (g, args, node) => {
    if (args.length !== 2) g.err('strcmp() 需要 2 個參數', node);
    const a = g.conv(g.ex(args[0]), 'cstr', 0, args[0]), b = g.conv(g.ex(args[1]), 'cstr', 0, args[1]);
    return map2(a, b, (x, y) => x < y ? -1 : x > y ? 1 : 0, 'int');
  },
  atoi: (g, args, node) => {
    if (args.length !== 1) g.err('atoi() 需要 1 個參數', node);
    return map1(g.conv(g.ex(args[0]), 'cstr', 0, args[0]), s => WRAP.int(parseLeadingInt(s)), 'int');
  },
  atol: (g, args, node) => {
    if (args.length !== 1) g.err('atol() 需要 1 個參數', node);
    return map1(g.conv(g.ex(args[0]), 'cstr', 0, args[0]), s => WRAP.long(parseLeadingInt(s)), 'long');
  },
  F: (g, args, node) => {
    if (args.length !== 1 || args[0].k !== 'str') g.err('F() 裡面要放字串常數，例如 F("Hello")', node);
    return LIT('cstr', args[0].v);
  },
  String: (g, args, node) => {
    const M = g.M;
    if (args.length === 0) return LIT('String', '');
    if (args.length > 2) g.err('String() 最多 2 個參數', node);
    const E = g.ex(args[0]);
    if (E.d === 1 && (E.t === 'char' || E.t === 'byte')) return g.conv(E, 'String', 0, node);
    if (E.d) g.err('String() 不能放陣列', node);
    const t = E.t;
    if (isStr(t)) { if (args.length > 1) g.err('String("文字") 只能有一個參數', node); return Object.assign({}, E, { t: 'String' }); }
    if (!isNum(t)) g.err(`無法把 ${tname(t)} 轉成 String`, node);
    if (args.length === 1) return map1(E, v => M.toStr(v, t), 'String');
    const F = g.conv(g.ex(args[1]), 'int', 0, args[1]);
    return map2(E, F, (v, b) => M.toStrFmt(v, t, b), 'String');
  },
  yield: simple([], 'void', () => () => undefined),
  interrupts: simple([], 'void', () => () => undefined),
  noInterrupts: simple([], 'void', () => () => undefined),
  pulseIn: (g, a, node) => g.err('模擬器目前不支援 pulseIn()', node),
  attachInterrupt: (g, a, node) => g.err('模擬器目前不支援 attachInterrupt()，請在 loop() 裡用 digitalRead() 檢查按鈕', node),
  shiftOut: (g, a, node) => g.err('模擬器目前不支援 shiftOut()', node),
  sprintf: (g, a, node) => g.err('模擬器目前不支援 sprintf()，請用 Serial.print 分段輸出或 String 相加', node),
  printf: (g, a, node) => g.err('Arduino 沒有 printf()，請用 Serial.print()', node),
  main: (g, a, node) => g.err('Arduino 程式不需要 main()，請使用 setup() 與 loop()', node),
};
function parseLeadingInt(s) {
  const m = /^\s*([+-]?\d+)/.exec(s);
  return m ? parseInt(m[1], 10) : 0;
}
function bitMod(g, args, node, fn, n) {
  if (args.length !== n) g.err(`${node.f.name}() 需要 ${n} 個參數`, node);
  const extra = args.slice(1).map(a => g.conv(g.ex(a), 'int', 0, a));
  const L = evalList(extra);
  const R = L.sync ? S('list', L.f) : A('list', L.f);
  return g.update(args[0], R, (old, r, t) => WRAP[t](fn(old, r[0], r[1])), false, node);
}

/* ------------------------------------------------------------- Serial */
function printArg(g, a, node) {
  const M = g.M;
  const E = g.ex(a);
  if (E.d === 1 && (E.t === 'char' || E.t === 'byte')) return map1(E, arr => M.carrToStr(arr), 'cstr');
  if (E.d) g.err('Serial.print 不能直接印出整個陣列，請用迴圈一個一個印', node);
  if (E.t === 'void') g.err('這個函式沒有回傳值（void），不能印出來', node);
  if (CLASSES.has(E.t)) g.err('物件不能直接印出來', node);
  return E;
}
function printCall(g, args, node, ln) {
  const M = g.M;
  if (args.length === 0) {
    if (!ln) g.err('Serial.print() 需要要印出的內容', node);
    return S('uint', () => M.serialWrite('\r\n'));
  }
  if (args.length > 2) g.err(`Serial.${ln ? 'println' : 'print'}() 最多 2 個參數（要印多個值請分開寫）`, node);
  const E = printArg(g, args[0], node);
  const t = E.t;
  const nl = ln ? '\r\n' : '';
  if (args.length === 1) return map1(E, v => M.serialWrite(M.fmt(v, t, undefined) + nl), 'uint');
  if (isStr(t)) g.err('印字串時不需要第二個參數', node);
  const F = g.conv(g.ex(args[1]), 'int', 0, args[1]);
  return map2(E, F, (v, b) => M.serialWrite(M.fmt(v, t, b) + nl), 'uint');
}
const SERIAL = {
  begin: simple([['ulong'], ['ulong', 'byte']], 'void', M => b => M.serialBegin(b)),
  end: simple([], 'void', M => () => M.serialEnd()),
  print: (g, args, node) => printCall(g, args, node, false),
  println: (g, args, node) => printCall(g, args, node, true),
  write: (g, args, node) => {
    const M = g.M;
    if (args.length !== 1) g.err('Serial.write() 需要 1 個參數', node);
    const E = printArg(g, args[0], node);
    if (isStr(E.t)) return map1(E, s => M.serialWrite(s), 'uint');
    return map1(g.conv(E, 'byte', 0, node), v => M.serialWrite(String.fromCharCode(v)), 'uint');
  },
  available: simple([], 'int', M => () => M.serialAvailable()),
  availableForWrite: simple([], 'int', () => () => 63),
  read: simple([], 'int', M => () => M.serialRead()),
  peek: simple([], 'int', M => () => M.serialPeek()),
  flush: simple([], 'void', () => () => undefined),
  setTimeout: simple(['ulong'], 'void', M => ms => { M.serial.timeout = ms; }),
  parseInt: simple([], 'long', M => function* () { return yield* M.serialParseInt(); }, true),
  parseFloat: simple([], 'float', M => function* () { return yield* M.serialParseFloat(); }, true),
  readString: simple([], 'String', M => function* () { return yield* M.serialReadString(); }, true),
  readStringUntil: simple(['char'], 'String', M => function* (c) { return yield* M.serialReadUntil(c); }, true),
  find: (g, a, node) => g.err('模擬器目前不支援 Serial.find()', node),
  readBytes: (g, a, node) => g.err('模擬器目前不支援 Serial.readBytes()，請用 Serial.read()', node),
  readBytesUntil: (g, a, node) => g.err('模擬器目前不支援 Serial.readBytesUntil()，請用 Serial.readStringUntil()', node),
};

/* -------------------------------------------------------- String 方法 */
const STR_MUT = new Set(['trim', 'toUpperCase', 'toLowerCase', 'replace', 'remove', 'setCharAt', 'concat', 'reserve']);
function strMethod(g, O, f, node) {
  const M = g.M;
  const name = f.name, args = node.args;
  const need = (n) => { if (args.length !== n) g.err(`.${name}() 需要 ${n} 個參數`, node); };
  const ex = (a, t) => g.conv(g.ex(a), t, 0, a);
  const strOrChar = a => { const E = g.ex(a); if (E.d === 1) return g.conv(E, 'String', 0, a); if (E.t === 'char') return map1(E, c => String.fromCharCode(c & 255), 'String'); return g.conv(E, 'String', 0, a); };
  if (STR_MUT.has(name)) {
    if (O.t === 'cstr' && f.a.k === 'str') g.err('字串常數不能修改', node);
    const extra = [];
    if (name === 'replace') { need(2); extra.push(strOrChar(args[0]), strOrChar(args[1])); }
    else if (name === 'remove') { if (args.length < 1 || args.length > 2) g.err('.remove() 需要 1 或 2 個參數', node); extra.push(...args.map(a => ex(a, 'uint'))); }
    else if (name === 'setCharAt') { need(2); extra.push(ex(args[0], 'uint'), ex(args[1], 'char')); }
    else if (name === 'concat') { need(1); const E = g.ex(args[0]); const et = E.t; extra.push(map1(E, v => M.toStr(v, et), 'String')); }
    else if (name === 'reserve') { need(1); return LIT('bool', 1); }
    else need(0);
    const L = evalList(extra);
    const R = L.sync ? S('list', L.f) : A('list', L.f);
    const tf = {
      trim: s => s.replace(/^[\s]+|[\s]+$/g, ''),
      toUpperCase: s => s.toUpperCase(),
      toLowerCase: s => s.toLowerCase(),
      replace: (s, r) => r[0] === '' ? s : s.split(r[0]).join(r[1]),
      remove: (s, r) => r.length === 1 ? s.slice(0, r[0]) : s.slice(0, r[0]) + s.slice(r[0] + r[1]),
      setCharAt: (s, r) => r[0] < s.length ? s.slice(0, r[0]) + String.fromCharCode(r[1] & 255) + s.slice(r[0] + 1) : s,
      concat: (s, r) => s + r[0],
    }[name];
    const U = g.update(f.a, R, (old, r) => tf(old, r), false, node);
    return map1(U, () => (name === 'concat' ? 1 : undefined), name === 'concat' ? 'bool' : 'void');
  }
  switch (name) {
    case 'length': need(0); return map1(O, s => s.length, 'uint');
    case 'charAt': need(1); return map2(O, ex(args[0], 'uint'), (s, i) => i < s.length ? WRAP.char(s.charCodeAt(i)) : 0, 'char');
    case 'substring': {
      if (args.length === 1) return map2(O, ex(args[0], 'uint'), (s, a) => s.substring(a), 'String');
      need(2);
      const L = evalList([O, ex(args[0], 'uint'), ex(args[1], 'uint')]);
      return (L.sync ? S : A)('String', L.sync ? (fr => { const v = L.f(fr); return v[0].substring(v[1], v[2]); })
        : function* (fr) { const v = yield* L.f(fr); return v[0].substring(v[1], v[2]); });
    }
    case 'indexOf': case 'lastIndexOf': {
      if (args.length < 1 || args.length > 2) g.err(`.${name}() 需要 1 或 2 個參數`, node);
      const parts = [O, strOrChar(args[0])];
      if (args[1]) parts.push(ex(args[1], 'uint'));
      const L = evalList(parts);
      const fn = name === 'indexOf' ? (v => v.length > 2 ? v[0].indexOf(v[1], v[2]) : v[0].indexOf(v[1]))
        : (v => v.length > 2 ? v[0].lastIndexOf(v[1], v[2]) : v[0].lastIndexOf(v[1]));
      return L.sync ? S('int', fr => fn(L.f(fr))) : A('int', function* (fr) { return fn(yield* L.f(fr)); });
    }
    case 'toInt': need(0); return map1(O, s => WRAP.long(parseLeadingInt(s)), 'long');
    case 'toFloat': case 'toDouble': need(0); return map1(O, s => { const v = parseFloat(s); return isNaN(v) ? 0 : fround(v); }, 'float');
    case 'equals': need(1); return map2(O, ex(args[0], 'String'), (a, b) => a === b ? 1 : 0, 'bool');
    case 'equalsIgnoreCase': need(1); return map2(O, ex(args[0], 'String'), (a, b) => a.toLowerCase() === b.toLowerCase() ? 1 : 0, 'bool');
    case 'startsWith': need(1); return map2(O, ex(args[0], 'String'), (a, b) => a.startsWith(b) ? 1 : 0, 'bool');
    case 'endsWith': need(1); return map2(O, ex(args[0], 'String'), (a, b) => a.endsWith(b) ? 1 : 0, 'bool');
    case 'compareTo': need(1); return map2(O, ex(args[0], 'String'), (a, b) => a < b ? -1 : a > b ? 1 : 0, 'int');
    case 'c_str': need(0); return Object.assign({}, O, { t: 'cstr' });
    case 'isEmpty': need(0); return map1(O, s => s.length ? 0 : 1, 'bool');
  }
  g.err(`String 沒有「.${name}()」這個功能`, node);
}

/* ------------------------------------------------------ 物件方法 */
function objMethod(g, O, name, node, table) {
  const m = table[name];
  if (!m) g.err(`${O.t} 沒有「.${name}()」這個功能`, node);
  return m(g, O, node.args, node);
}
function meth(types, ret, fn) {
  return (g, O, args, node) => {
    let ts = types;
    if (Array.isArray(types[0])) {
      ts = types.find(x => x.length === args.length);
      if (!ts) g.err(`.${node.f.name}() 的參數數量不對（可以是 ${types.map(x => x.length).join(' 或 ')} 個）`, node);
    } else if (args.length !== types.length) g.err(`.${node.f.name}() 需要 ${types.length} 個參數，卻給了 ${args.length} 個`, node);
    const es = args.map((a, i) => g.conv(g.ex(a), ts[i], 0, a));
    const all = O ? [O].concat(es) : es;
    return mkCall(all, fn, ret, false);
  };
}
const SERVO_M = {
  attach: meth([['int'], ['int', 'int', 'int']], 'byte', (o, p, mn, mx) => o.attach(p, mn, mx)),
  write: meth(['int'], 'void', (o, a) => o.write(a)),
  writeMicroseconds: meth(['int'], 'void', (o, us) => o.writeMicroseconds(us)),
  read: meth([], 'int', o => o.read()),
  readMicroseconds: meth([], 'int', o => o.readMicroseconds()),
  attached: meth([], 'bool', o => o.isAttached() ? 1 : 0),
  detach: meth([], 'void', o => o.detach()),
};
function hsv(hue, sat, val) {
  // Adafruit_NeoPixel::ColorHSV
  let r, g, b;
  hue = (hue * 1530 + 32768) / 65536 | 0;
  if (hue < 510) { b = 0; if (hue < 255) { r = 255; g = hue; } else { r = 510 - hue; g = 255; } }
  else if (hue < 1020) { r = 0; if (hue < 765) { g = 255; b = hue - 510; } else { g = 1020 - hue; b = 255; } }
  else if (hue < 1530) { g = 0; if (hue < 1275) { r = hue - 1020; b = 255; } else { r = 255; b = 1530 - hue; } }
  else { r = 255; g = b = 0; }
  const v1 = 1 + val, s1 = 1 + sat, s2 = 255 - sat;
  const f = c => (((((c * s1) >> 8) + s2) * v1) & 0xff00) >> 8;
  return ((f(r) << 16) | (f(g) << 8) | f(b)) >>> 0;
}
const gamma8 = x => Math.round(Math.pow(x / 255, 2.6) * 255);
const PIXEL_M = {
  begin: meth([], 'void', o => o.begin()),
  show: meth([], 'void', o => o.show()),
  clear: meth([], 'void', o => o.clear()),
  setBrightness: meth(['byte'], 'void', (o, b) => o.setBrightness(b)),
  getBrightness: meth([], 'byte', o => o.getBrightness()),
  numPixels: meth([], 'uint', o => o.n),
  canShow: meth([], 'bool', () => 1),
  setPin: meth(['int'], 'void', (o, p) => o.setPin(p)),
  updateLength: meth(['uint'], 'void', (o, n) => o.updateLength(n)),
  getPixelColor: meth(['uint'], 'ulong', (o, i) => o.getPixelColor(i)),
  setPixelColor: meth([['uint', 'ulong'], ['uint', 'byte', 'byte', 'byte'], ['uint', 'byte', 'byte', 'byte', 'byte']], 'void',
    (o, i, a, b, c) => (b === undefined ? o.setPixelColor(i, a) : o.setPixelColor(i, ((a << 16) | (b << 8) | c) >>> 0))),
  fill: meth([[], ['ulong'], ['ulong', 'uint'], ['ulong', 'uint', 'uint']], 'void', (o, c, first, count) => o.fill(c || 0, first || 0, count || 0)),
  Color: (g, O, args, node) => meth([['byte', 'byte', 'byte'], ['byte', 'byte', 'byte', 'byte']], 'ulong',
    (...v) => { const k = O ? 1 : 0; return ((v[k] << 16) | (v[k + 1] << 8) | v[k + 2]) >>> 0; })(g, O, args, node),
  ColorHSV: (g, O, args, node) => meth([['uint'], ['uint', 'byte'], ['uint', 'byte', 'byte']], 'ulong',
    (...v) => { const k = O ? 1 : 0; return hsv(v[k], v[k + 1] === undefined ? 255 : v[k + 1], v[k + 2] === undefined ? 255 : v[k + 2]); })(g, O, args, node),
  gamma32: (g, O, args, node) => meth(['ulong'], 'ulong', (...v) => {
    const c = v[O ? 1 : 0];
    return ((gamma8((c >>> 16) & 255) << 16) | (gamma8((c >>> 8) & 255) << 8) | gamma8(c & 255)) >>> 0;
  })(g, O, args, node),
  gamma8: (g, O, args, node) => meth(['byte'], 'byte', (...v) => gamma8(v[O ? 1 : 0]))(g, O, args, node),
};

/* ----------------------------------------------------------------- 入口 */
function compile(src, M) {
  const pp = preprocess(src);
  let toks = lexRaw(pp.code, 1);
  toks = expandTokens(toks, pp.defines, new Set(), 0);
  const lastLine = src.split('\n').length;
  toks.push({ t: 'eof', v: '', line: lastLine });
  const items = new Parser(toks).program();
  const g = new Gen(items, M);
  const main = g.build();
  return { main, warnings: pp.warnings, includes: pp.includes };
}

AJ.compile = compile;
AJ.hsv = hsv;
AJ._internal = { lexRaw, preprocess, Parser, WRAP };
})(typeof window !== 'undefined' ? window : globalThis);
