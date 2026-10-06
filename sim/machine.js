/* Arduino UNO 模擬：腳位、元件、序列埠與時間軸紀錄 */
(function (G) {
'use strict';
const AJ = G.AJ = G.AJ || {};
const fround = Math.fround;
const PWM_PINS = new Set([3, 5, 6, 9, 10, 11]);
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Arduino Print::printFloat（以 32 位元 float 計算）
function printFloat(number, digits) {
  if (digits < 0) digits = 2;
  if (digits > 7) digits = 7;
  if (isNaN(number)) return 'nan';
  if (!isFinite(number)) return 'inf';
  if (number > 4294967040.0) return 'ovf';
  if (number < -4294967040.0) return 'ovf';
  let s = '';
  if (number < 0) { s = '-'; number = -number; }
  let rounding = fround(0.5);
  for (let i = 0; i < digits; i++) rounding = fround(rounding / 10);
  number = fround(number + rounding);
  const intPart = Math.floor(number) >>> 0;
  let rem = fround(number - intPart);
  s += String(intPart);
  if (digits > 0) s += '.';
  while (digits-- > 0) {
    rem = fround(rem * 10);
    const d = Math.floor(rem);
    s += String(d);
    rem = fround(rem - d);
  }
  return s;
}
AJ.printFloat = printFloat;

function utf8len(s) {
  let n = 0;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); n += c < 128 ? 1 : c < 2048 ? 2 : 3; }
  return n;
}

const INPUT_TYPES = new Set(['button', 'switch']);
const ANALOG_TYPES = new Set(['pot', 'ldr']);

class Machine {
  constructor(circuit, opts) {
    opts = opts || {};
    this.t = 0; this.until = 0; this.depth = 0; this.line = 0; this.calls = 0;
    this.slice = opts.slice || 20000;
    this.pins = [];
    for (let i = 0; i < 20; i++) this.pins.push({ mode: 0, out: 0, pull: 0, pwm: -1 });
    this.comps = (circuit || []).map(c => Object.assign({}, c, { state: Machine.initState(c) }));
    this.byId = {};
    this.digitalIn = {}; this.analogIn = {};
    for (const c of this.comps) {
      this.byId[c.id] = c;
      if (INPUT_TYPES.has(c.type)) this.digitalIn[c.pin] = c;
      if (ANALOG_TYPES.has(c.type)) this.analogIn[c.pin >= 14 ? c.pin - 14 : c.pin] = c;
    }
    this.servos = {}; this.tones = {}; this.pixelOut = {};
    this.serial = { begun: false, baud: 0, out: '', rx: [], timeout: 1000, txFree: 0, lastTx: -1e9 };
    this.trace = { pins: {}, tone: {}, servo: {}, pixels: {} };
    this.randState = 1;
    this.noise = mulberry(opts.seed || 20240917);
    this.floatA = 380;
    this.events = (opts.events || []).slice().sort((a, b) => a.t - b.t);
    this.ev = 0;
    this.onSerial = opts.onSerial || null;
    this.onWarn = opts.onWarn || null;
    this.warned = {}; this.warnings = [];
    this.wallLimit = opts.wallLimit || 0; this.wallStart = 0;
    this.outLimit = opts.outLimit || 100000;
    this.done = false; this.error = null; this.gen = null;
  }
  static initState(c) {
    if (c.type === 'button' || c.type === 'switch') return { active: !!c.initial };
    if (c.type === 'pot' || c.type === 'ldr') return { value: c.value != null ? c.value : 512 };
    return {};
  }

  load(src) {
    const r = AJ.compile(src, this);
    this.gen = r.main();
    this.compileWarnings = r.warnings;
    return r;
  }

  /* ------------------------------------------------------- 執行控制 */
  applyEvents() {
    while (this.ev < this.events.length && this.events[this.ev].t <= this.t) this.applyEvent(this.events[this.ev++]);
  }
  applyEvent(e) {
    if (e.kind === 'serial') { this.serialFeed(e.text); return; }
    const c = this.byId[e.comp];
    if (!c) return;
    if (e.kind === 'press') c.state.active = true;
    else if (e.kind === 'release') c.state.active = false;
    else if (e.kind === 'toggle') c.state.active = !c.state.active;
    else if (e.kind === 'set') {
      if (c.type === 'switch' || c.type === 'button') c.state.active = !!e.value;
      else c.state.value = Math.max(0, Math.min(1023, e.value | 0));
    }
  }
  runUntil(targetUs) {
    if (this.done || !this.gen) return;
    if (this.wallLimit && !this.wallStart) this.wallStart = now();
    try {
      while (this.t < targetUs) {
        this.applyEvents();
        const ne = this.ev < this.events.length ? this.events[this.ev].t : Infinity;
        this.until = Math.min(targetUs, ne, this.t + this.slice);
        if (this.wallLimit && now() - this.wallStart > this.wallLimit) this.tle();
        const r = this.gen.next();
        if (r.done) { this.done = true; break; }
      }
      this.applyEvents();
    } catch (e) {
      this.done = true;
      this.error = this.normError(e);
    }
  }
  normError(e) {
    if (e instanceof AJ.RunError) return e;
    if (e instanceof RangeError) return new AJ.RunError('遞迴太深或記憶體不足（Stack overflow）', this.line, 'RE');
    if (e instanceof AJ.CompileError) return e;
    return new AJ.RunError('模擬器內部錯誤：' + (e && e.message), this.line, 'RE');
  }
  err(msg) { throw new AJ.RunError(msg, this.line, 'RE'); }
  tle() { throw new AJ.RunError('執行時間過長（程式可能計算量太大或卡在迴圈裡）', this.line, 'TLE'); }
  oob(name, i, len) {
    throw new AJ.RunError(`陣列索引超出範圍：${name}[${i}]，但這個陣列只有 ${len} 格（索引 0 ~ ${len - 1}）`, this.line, 'RE');
  }
  overflow() { throw new AJ.RunError('函式呼叫太多層（遞迴沒有結束條件？）', this.line, 'RE'); }
  wallCheck() { if (this.wallLimit && now() - this.wallStart > this.wallLimit) this.tle(); }
  warn(key, msg) {
    if (this.warned[key]) return;
    this.warned[key] = true;
    const w = { line: this.line, msg, t: this.t };
    this.warnings.push(w);
    if (this.onWarn) this.onWarn(w);
  }

  /* ------------------------------------------------------- 腳位 */
  pin(p) {
    const P = this.pins[p];
    if (!P) this.warn('badpin' + p, `腳位 ${p} 不存在（UNO 的腳位是 0~13、A0~A5）`);
    return P;
  }
  level(p) {
    const P = this.pins[p];
    if (P.mode === 1) return P.pwm >= 0 ? P.pwm / 255 : P.out;
    return 0;
  }
  rec(p) {
    const L = this.level(p);
    const arr = this.trace.pins[p] || (this.trace.pins[p] = []);
    const last = arr.length ? arr[arr.length - 1][1] : 0;
    if (L !== last) {
      if (arr.length && arr[arr.length - 1][0] === this.t) { arr[arr.length - 1][1] = L; if (arr.length > 1 && arr[arr.length - 2][1] === L) arr.pop(); }
      else arr.push([this.t, L]);
    }
  }
  pinMode(p, m) {
    const P = this.pin(p); if (!P) return;
    this.t += 3;
    if (m === 1) P.mode = 1;
    else { P.mode = 0; P.pull = m === 2 ? 1 : 0; P.pwm = -1; }
    this.rec(p);
  }
  digitalWrite(p, v) {
    const P = this.pin(p); if (!P) return;
    this.t += 4;
    if (P.mode === 1) { P.out = v ? 1 : 0; P.pwm = -1; }
    else {
      P.pull = v ? 1 : 0;
      if (this.isOutputPin(p)) this.warn('nomode' + p, `腳位 ${p} 還沒有設定 pinMode(${p}, OUTPUT)，所以接在上面的元件只會微微亮或沒反應`);
    }
    this.rec(p);
  }
  isOutputPin(p) {
    return this.comps.some(c => (c.type === 'led' || c.type === 'buzzer') && c.pin === p ||
      (c.type === 'rgb' && (c.r === p || c.g === p || c.b === p)));
  }
  digitalRead(p) {
    const P = this.pin(p); if (!P) return 0;
    this.t += 4;
    if (P.mode === 1) return P.out;
    const c = this.digitalIn[p];
    if (c) {
      if (c.wiring === 'pulldown') return c.state.active ? 1 : 0;
      if (c.state.active) return 0;
      if (P.pull) return 1;
      this.warn('float' + p, `腳位 ${p} 的按鈕接 GND，但沒有用 pinMode(${p}, INPUT_PULLUP)，放開時讀到的值會亂跳`);
      return this.noise() < 0.5 ? 1 : 0;
    }
    const a = this.analogIn[p >= 14 ? p - 14 : -1];
    if (a) return a.state.value >= 600 ? 1 : 0;
    if (P.pull) return 1;
    return this.noise() < 0.5 ? 1 : 0;
  }
  analogRead(p) {
    this.t += 112;
    const ch = p >= 14 ? p - 14 : p;
    if (ch < 0 || ch > 5) { this.warn('badapin' + p, `analogRead(${p})：UNO 只有 A0~A5 能讀類比值`); return 0; }
    const c = this.analogIn[ch];
    if (c) return Math.max(0, Math.min(1023, Math.round(c.state.value)));
    const d = this.digitalIn[ch + 14];
    if (d) {
      const P = this.pins[ch + 14];
      if (d.wiring === 'pulldown') return d.state.active ? 1023 : 0;
      return d.state.active ? 0 : (P.pull ? 1023 : Math.round(this.noise() * 1023));
    }
    this.floatA = Math.max(150, Math.min(700, this.floatA + (this.noise() - 0.5) * 60));
    return Math.round(this.floatA);
  }
  analogWrite(p, v) {
    const P = this.pin(p); if (!P) return;
    this.t += 5;
    P.mode = 1;
    if (v === 0) { P.out = 0; P.pwm = -1; }
    else if (v === 255) { P.out = 1; P.pwm = -1; }
    else if (PWM_PINS.has(p)) {
      P.pwm = v & 255; P.out = 0;
      if (v > 255 || v < 0) this.warn('pwmrange' + p, `analogWrite(${p}, ${v})：數值超出 0~255，實際輸出會變成 ${v & 255}`);
    } else {
      P.pwm = -1; P.out = v < 128 ? 0 : 1;
      this.warn('nopwm' + p, `腳位 ${p} 不支援 PWM（UNO 只有 3、5、6、9、10、11），analogWrite 只會全亮或全暗`);
    }
    this.rec(p);
  }

  /* ------------------------------------------------------- 時間 */
  *delay(ms) {
    this.t += ms * 1000;
    if (this.t >= this.until) yield 0;
  }
  *delayUs(us) {
    this.t += us;
    if (this.t >= this.until) yield 0;
  }
  millis() { return Math.floor(this.t / 1000) >>> 0; }
  micros() { return (Math.floor(this.t) & ~3) >>> 0; }

  /* ------------------------------------------------------- 亂數（avr-libc random） */
  rawRandom() {
    let x = this.randState;
    if (x === 0) x = 123459876;
    const hi = Math.trunc(x / 127773), lo = x % 127773;
    x = 16807 * lo - 2836 * hi;
    if (x < 0) x += 0x7fffffff;
    this.randState = x;
    return x % 0x80000000;
  }
  random(max) { if (max === 0) return 0; return this.rawRandom() % max; }
  random2(min, max) { if (min >= max) return min; return this.random(max - min) + min; }
  randomSeed(s) { if (s !== 0) this.randState = s >>> 0; }

  /* ------------------------------------------------------- 蜂鳴器 */
  tone(p, f, d) {
    if (!this.pin(p)) return;
    this.t += 10;
    const end = d ? this.t + d * 1000 : Infinity;
    this.tones[p] = { f, end };
    (this.trace.tone[p] || (this.trace.tone[p] = [])).push([this.t, f, end]);
  }
  noTone(p) {
    if (!this.pin(p)) return;
    this.tones[p] = null;
    (this.trace.tone[p] || (this.trace.tone[p] = [])).push([this.t, 0, Infinity]);
  }
  toneNow(p) {
    const tn = this.tones[p];
    if (!tn) return 0;
    if (this.t >= tn.end) return 0;
    return tn.f;
  }

  /* ------------------------------------------------------- 伺服馬達 */
  newServo() {
    const M = this;
    return {
      pin: -1, us: 1500, att: false,
      attach(p, mn, mx) {
        this.pin = p; this.att = true; this.min = mn || 544; this.max = mx || 2400;
        if (M.pins[p]) M.pins[p].mode = 1;
        M.servos[p] = this; M.recServo(this);
        return 1;
      },
      angle() { return Math.round((this.us - this.min) * 180 / (this.max - this.min)); },
      write(a) {
        if (a < 544) {
          if (a < 0) a = 0; else if (a > 180) a = 180;
          this.us = Math.round(this.min + (this.max - this.min) * a / 180);
          this.writeMicroseconds(this.us);
        } else this.writeMicroseconds(a);
      },
      writeMicroseconds(us) {
        if (us < this.min) us = this.min; else if (us > this.max) us = this.max;
        this.us = us;
        if (this.att) M.recServo(this);
      },
      read() { return this.angle(); },
      readMicroseconds() { return this.us; },
      isAttached() { return this.att; },
      detach() { this.att = false; },
      min: 544, max: 2400,
    };
  }
  recServo(s) {
    const arr = this.trace.servo[s.pin] || (this.trace.servo[s.pin] = []);
    const a = s.angle();
    if (!arr.length || arr[arr.length - 1][1] !== a) arr.push([this.t, a]);
  }

  /* ------------------------------------------------------- WS2812 */
  newPixels(n, pin, type) {
    const M = this;
    return {
      n: n | 0, pin, buf: new Array(n | 0).fill(0), bright: 0, begun: false,
      begin() { this.begun = true; if (M.pins[this.pin]) M.pins[this.pin].mode = 1; },
      setPin(p) { this.pin = p; },
      updateLength(k) { this.n = k; this.buf = new Array(k).fill(0); },
      show() {
        M.t += this.n * 30 + 50;
        if (!this.begun) { M.warn('nopixbegin', '燈條還沒有呼叫 begin()，所以 show() 不會亮'); return; }
        M.showPixels(this.pin, this.buf.slice());
      },
      clear() { this.buf.fill(0); },
      setBrightness(b) {
        // 與 Adafruit 函式庫相同：亮度變化時重新縮放緩衝區
        const nb = (b + 1) & 255;
        if (nb !== this.bright) {
          const old = this.bright - 1 & 255;
          let scale;
          if (old === 0) scale = 0;
          else if (b === 255) scale = Math.floor(65535 / old);
          else scale = Math.floor(((nb << 8) - 1) / old);
          this.buf = this.buf.map(c => {
            const ch = [(c >>> 16) & 255, (c >>> 8) & 255, c & 255].map(v => Math.min(255, (v * scale) >> 8));
            return ((ch[0] << 16) | (ch[1] << 8) | ch[2]) >>> 0;
          });
          this.bright = nb;
        }
      },
      getBrightness() { return (this.bright - 1) & 255; },
      scale(c) {
        if (!this.bright) return c >>> 0;
        const b = this.bright;
        return ((((((c >>> 16) & 255) * b) >> 8) << 16) | (((((c >>> 8) & 255) * b) >> 8) << 8) | (((c & 255) * b) >> 8)) >>> 0;
      },
      setPixelColor(i, c) { if (i < this.n) this.buf[i] = this.scale(c); },
      getPixelColor(i) {
        if (i >= this.n) return 0;
        const c = this.buf[i];
        if (!this.bright) return c;
        const b = this.bright;
        return (((Math.min(255, (((c >>> 16) & 255) << 8) / b | 0)) << 16) | ((Math.min(255, (((c >>> 8) & 255) << 8) / b | 0)) << 8) | Math.min(255, ((c & 255) << 8) / b | 0)) >>> 0;
      },
      fill(c, first, count) {
        if (first >= this.n) return;
        const end = count === 0 ? this.n : Math.min(this.n, first + count);
        const v = this.scale(c);
        for (let i = first; i < end; i++) this.buf[i] = v;
      },
    };
  }
  showPixels(pin, frame) {
    this.pixelOut[pin] = frame;
    const arr = this.trace.pixels[pin] || (this.trace.pixels[pin] = []);
    const last = arr.length ? arr[arr.length - 1][1] : null;
    if (!last || last.length !== frame.length || last.some((v, i) => v !== frame[i])) arr.push([this.t, frame]);
  }

  /* ------------------------------------------------------- 序列埠 */
  serialBegin(b) {
    this.serial.begun = true;
    this.serial.baud = b || 9600;
  }
  serialEnd() { this.serial.begun = false; }
  serialWrite(text) {
    const S = this.serial;
    if (!S.begun) { this.warn('nobegin', 'Serial 還沒有 begin()，所以序列埠不會有輸出。請在 setup() 加上 Serial.begin(9600);'); return 0; }
    const bytes = utf8len(text);
    const ct = 10e6 / S.baud;
    if (S.txFree < this.t) S.txFree = this.t;
    S.txFree += bytes * ct;
    const lag = S.txFree - this.t - 64 * ct;
    if (lag > 0) this.t += lag;
    S.out += text;
    S.lastTx = this.t;
    if (S.out.length > this.outLimit) throw new AJ.RunError('輸出太多了（可能在 loop 裡不停地印）', this.line, 'OLE');
    if (this.onSerial) this.onSerial(text);
    return bytes;
  }
  serialFeed(text) {
    for (const ch of text) {
      const code = ch.codePointAt(0);
      if (code < 128) this.serial.rx.push(code);
      else for (const b of unescape(encodeURIComponent(ch))) this.serial.rx.push(b.charCodeAt(0));
    }
  }
  serialAvailable() { return this.serial.rx.length; }
  serialRead() { return this.serial.rx.length ? this.serial.rx.shift() : -1; }
  serialPeek() { return this.serial.rx.length ? this.serial.rx[0] : -1; }
  *timedPeek() {
    const start = this.t, lim = this.serial.timeout * 1000;
    while (!this.serial.rx.length) {
      if (this.t - start >= lim) return -1;
      const step = this.until > this.t ? Math.min(1000, this.until - this.t) : 1000;
      this.t += step;
      if (this.t >= this.until) yield 0;
    }
    return this.serial.rx[0];
  }
  *timedRead() {
    const c = yield* this.timedPeek();
    if (c >= 0) this.serial.rx.shift();
    return c;
  }
  *serialParseInt() {
    let c;
    for (;;) {
      c = yield* this.timedPeek();
      if (c < 0) return 0;
      if (c === 45 || (c >= 48 && c <= 57)) break;
      this.serial.rx.shift();
    }
    let neg = false, v = 0;
    do {
      if (c === 45) neg = true;
      else v = (v * 10 + c - 48) | 0;
      this.serial.rx.shift();
      c = yield* this.timedPeek();
    } while (c >= 48 && c <= 57);
    return neg ? -v | 0 : v;
  }
  *serialParseFloat() {
    let c;
    for (;;) {
      c = yield* this.timedPeek();
      if (c < 0) return 0;
      if (c === 45 || c === 46 || (c >= 48 && c <= 57)) break;
      this.serial.rx.shift();
    }
    let s = '';
    do {
      s += String.fromCharCode(c);
      this.serial.rx.shift();
      c = yield* this.timedPeek();
    } while ((c >= 48 && c <= 57) || c === 46);
    const v = parseFloat(s);
    return isNaN(v) ? 0 : fround(v);
  }
  *serialReadString() {
    const bytes = [];
    for (;;) { const c = yield* this.timedRead(); if (c < 0) break; bytes.push(c); }
    return decodeBytes(bytes);
  }
  *serialReadUntil(term) {
    const bytes = [];
    for (;;) { const c = yield* this.timedRead(); if (c < 0 || c === (term & 255)) break; bytes.push(c); }
    return decodeBytes(bytes);
  }

  /* ------------------------------------------------------- 格式化 */
  carrToStr(a) {
    let s = '';
    for (let i = 0; i < a.length && a[i] !== 0; i++) s += String.fromCharCode(a[i] & 255);
    return s;
  }
  toStr(v, t) {
    if (t === 'String' || t === 'cstr') return v;
    if (t === 'char') return String.fromCharCode(v & 255);
    if (t === 'float') return printFloat(v, 2);
    return String(v);
  }
  toStrFmt(v, t, b) {
    if (t === 'float') return printFloat(v, b);
    if (t === 'char') return String.fromCharCode(v & 255);
    return this.fmtInt(v, t, b);
  }
  fmtInt(v, t, base) {
    if (base === undefined || base === 10) return String(v);
    if (base === 0) return String.fromCharCode(v & 255);
    if (base < 2 || base > 36) base = 10;
    return (v >>> 0).toString(base).toUpperCase();
  }
  fmt(v, t, base) {
    if (t === 'String' || t === 'cstr') return v;
    if (t === 'float') return printFloat(v, base === undefined ? 2 : base);
    if (t === 'char' && base === undefined) return String.fromCharCode(v & 255);
    return this.fmtInt(v, t, base);
  }
  arrBytes(a, es) {
    let n = 1, x = a;
    while (Array.isArray(x)) { n *= x.length; x = x[0]; }
    return n * es;
  }
  mkArr(dims, def, init, depth) {
    const n = dims[depth];
    if (!(n >= 0 && n <= 20000 && n === Math.floor(n))) this.err(`陣列大小不合理：${n}`);
    if (init && init.length > n) this.err(`陣列初始值有 ${init.length} 個，超過陣列大小 ${n}`);
    const a = new Array(n);
    const last = depth + 1 >= dims.length;
    for (let i = 0; i < n; i++) {
      if (!last) a[i] = this.mkArr(dims, def, init && init[i], depth + 1);
      else if (init && i < init.length) a[i] = init[i];
      else a[i] = typeof def === 'function' ? def() : def;
    }
    return a;
  }

  /* ------------------------------------------------------- 給畫面使用的狀態 */
  snapshot() {
    const pins = this.pins.map((P, i) => ({
      mode: P.mode, pull: P.pull, level: this.level(i), out: P.out, pwm: P.pwm,
    }));
    const tones = {};
    for (const k in this.tones) tones[k] = this.toneNow(+k);
    const servos = {};
    for (const k in this.servos) servos[k] = this.servos[k].att ? this.servos[k].angle() : null;
    return { pins, tones, servos, pixels: this.pixelOut, t: this.t, txAt: this.serial.lastTx };
  }
}

function decodeBytes(bytes) {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  try { return decodeURIComponent(escape(s)); } catch (e) { return s; }
}

AJ.Machine = Machine;
AJ.PWM_PINS = PWM_PINS;
})(typeof window !== 'undefined' ? window : globalThis);
