/* 題庫與成績的儲存：Claude 雲端資料庫 / Google 試算表（Apps Script）/ 本機 */
(function (G) {
'use strict';
const AJ = G.AJ = G.AJ || {};
const VRANK = { AC: 5, WA: 3, OLE: 2, TLE: 2, RE: 1, CE: 0 };

const LS = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* 無法儲存時忽略 */ } },
};
AJ.LS = LS;

function better(a, b) {
  if (!a) return true;
  if (b.score !== a.score) return b.score > a.score;
  return (VRANK[b.verdict] || 0) > (VRANK[a.verdict] || 0);
}
function mergeResult(results, pid, rec) {
  const cur = results[pid] || { tries: 0 };
  const out = Object.assign({}, cur);
  out.tries = (cur.tries || 0) + 1;
  out.last = rec;
  if (better(cur.best, rec)) out.best = { verdict: rec.verdict, score: rec.score, at: rec.at };
  results[pid] = out;
  return results;
}
AJ.mergeResult = mergeResult;

class Emitter {
  constructor() { this.subs = {}; }
  on(ev, fn) { (this.subs[ev] = this.subs[ev] || []).push(fn); return () => { this.subs[ev] = this.subs[ev].filter(f => f !== fn); }; }
  emit(ev, data) { (this.subs[ev] || []).forEach(f => { try { f(data); } catch (e) { console.error(e); } }); }
}

/* ---------------------------------------------------------- 本機 */
class LocalStore extends Emitter {
  constructor() {
    super();
    this.mode = 'local'; this.label = '本機模式'; this.detail = '題目與成績只存在這台電腦的瀏覽器裡';
    this.isTeacher = true; this.needsLogin = false; this.canSubmit = true;
  }
  async init() {
    this.problems = LS.get('aj.problems', []);
    this.profile = LS.get('aj.profile', null);
    this.results = LS.get('aj.results', {});
    this.emit('problems', this.problems);
    this.emit('mine', this.results);
  }
  async setProfile(p) { this.profile = p; LS.set('aj.profile', p); this.emit('all', this.allRows()); }
  async submit(pid, rec) {
    mergeResult(this.results, pid, rec);
    LS.set('aj.results', this.results);
    this.emit('mine', this.results);
    this.emit('all', this.allRows());
  }
  allRows() {
    return [{ key: 'me', cls: (this.profile || {}).cls || '', seat: (this.profile || {}).seat || '', name: (this.profile || {}).name || '（本機使用者）', results: this.results }];
  }
  watchAll() { setTimeout(() => this.emit('all', this.allRows()), 0); return () => {}; }
  async saveProblem(p, solution) {
    const i = this.problems.findIndex(x => x.id === p.id);
    if (i >= 0) this.problems[i] = p; else this.problems.push(p);
    LS.set('aj.problems', this.problems);
    const sol = LS.get('aj.solutions', {}); sol[p.id] = solution; LS.set('aj.solutions', sol);
    this.emit('problems', this.problems);
  }
  async deleteProblem(id) {
    this.problems = this.problems.filter(x => x.id !== id);
    LS.set('aj.problems', this.problems);
    this.emit('problems', this.problems);
  }
  async getSolution(id) { return (LS.get('aj.solutions', {}))[id] || null; }
}

/* ---------------------------------------------------------- Claude 雲端 */
class ClaudeStore extends Emitter {
  constructor(db, user) {
    super();
    this.db = db; this.user = user;
    this.mode = 'claude'; this.label = 'Claude 雲端';
    this.detail = '這是 Claude Artifact 版：題目與成績存在 Claude 的資料庫，不會寫入 Google 試算表。要寫入試算表請使用網站版（index.html）';
    this.needsLogin = false;
    this.writeChain = Promise.resolve();
  }
  async init() {
    const u = this.user;
    this.uid = u ? await u.id() : null;
    this.isTeacher = u ? !!(await u.canEdit()) : false;
    this.canSubmit = !!this.uid;
    if (!this.uid) this.detail = '目前沒有登入身分，判題結果不會被記錄';
    this.me = { cls: '', seat: '', name: '', results: {} };
    if (this.uid) {
      try {
        const snap = await this.db.doc('subs/' + this.uid).get();
        if (snap.exists) this.me = Object.assign(this.me, JSON.parse(JSON.stringify(snap.data())));
      } catch (e) { console.warn(e); }
    }
    const local = LS.get('aj.profile', null);
    this.profile = this.me.name || this.me.seat ? { cls: this.me.cls, seat: this.me.seat, name: this.me.name } : local;
    if (!this.me.name && this.user) {
      const me = await this.user.me();
      this.defaultName = me.name || '';
    }
    this.results = this.me.results || {};
    this.emit('mine', this.results);
    this.db.collection('problems').onSnapshot(s => {
      this.problems = s.docs.map(d => d.data()).filter(Boolean);
      this.emit('problems', this.problems);
    }, e => { console.warn('problems', e); this.emit('problems', []); });
  }
  write(fn) {
    this.writeChain = this.writeChain.then(fn, fn);
    return this.writeChain;
  }
  saveMe() {
    if (!this.uid) return Promise.resolve();
    const body = { cls: this.profile ? this.profile.cls : '', seat: this.profile ? this.profile.seat : '', name: this.profile ? this.profile.name : '', results: this.results, updated: Date.now() };
    return this.write(() => this.db.doc('subs/' + this.uid).set(body));
  }
  async setProfile(p) { this.profile = p; LS.set('aj.profile', p); await this.saveMe(); }
  async submit(pid, rec) {
    mergeResult(this.results, pid, rec);
    this.emit('mine', this.results);
    await this.saveMe();
  }
  watchAll() {
    if (!this.isTeacher) return () => {};
    return this.db.collection('subs').onSnapshot(s => {
      const rows = s.docs.filter(d => d.exists).map(d => Object.assign({ key: d.id }, d.data()));
      this.emit('all', rows);
    }, e => console.warn('subs', e));
  }
  async saveProblem(p, solution) {
    await this.write(() => this.db.doc('problems/' + p.id).set(p));
    await this.write(() => this.db.doc('solutions/' + p.id).set({ code: solution, updated: Date.now() }));
  }
  async deleteProblem(id) {
    await this.write(() => this.db.doc('problems/' + id).delete());
    await this.write(() => this.db.doc('solutions/' + id).delete());
  }
  async getSolution(id) {
    const s = await this.db.doc('solutions/' + id).get();
    return s.exists ? s.data().code : null;
  }
}

/* ---------------------------------------------------------- Google 試算表 */
class SheetStore extends Emitter {
  constructor(url) {
    super();
    this.url = url;
    this.mode = 'sheet'; this.label = 'Google 試算表';
    this.detail = '題目與成績存在老師的 Google 試算表';
    this.needsLogin = true; this.canSubmit = true;
    this.key = (() => { try { return sessionStorage.getItem('aj.tkey') || ''; } catch (e) { return ''; } })();
    this.isTeacher = !!this.key;
  }
  async get(params) {
    const q = new URLSearchParams(params).toString();
    const r = await fetch(this.url + (this.url.includes('?') ? '&' : '?') + q, { redirect: 'follow' });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || '伺服器錯誤');
    return j;
  }
  async post(body) {
    const r = await fetch(this.url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error || '伺服器錯誤');
    return j;
  }
  async init() {
    this.profile = LS.get('aj.profile', null);
    this.results = LS.get('aj.results.sheet', {});
    this.emit('mine', this.results);
    try {
      const j = await this.get({ action: 'problems' });
      this.problems = j.problems || [];
    } catch (e) {
      console.warn(e);
      this.problems = [];
      this.error = '無法連到 Google 試算表：' + e.message;
    }
    this.emit('problems', this.problems);
    if (this.key) {
      try { await this.get({ action: 'check', key: this.key }); }
      catch (e) { this.key = ''; this.isTeacher = false; }
    }
  }
  async teacherLogin(key) {
    await this.get({ action: 'check', key });
    this.key = key; this.isTeacher = true;
    try { sessionStorage.setItem('aj.tkey', key); } catch (e) { /* 忽略 */ }
  }
  teacherLogout() { this.key = ''; this.isTeacher = false; try { sessionStorage.removeItem('aj.tkey'); } catch (e) { /* 忽略 */ } }
  async setProfile(p) { this.profile = p; LS.set('aj.profile', p); }
  async submit(pid, rec, problemTitle) {
    mergeResult(this.results, pid, rec);
    LS.set('aj.results.sheet', this.results);
    this.emit('mine', this.results);
    const p = this.profile || {};
    await this.post({ action: 'submit', cls: p.cls || '', seat: p.seat || '', name: p.name || '', pid, title: problemTitle || '', verdict: rec.verdict, score: rec.score, code: rec.code || '' });
  }
  watchAll() {
    const load = async () => {
      try {
        const j = await this.get({ action: 'subs', key: this.key });
        const rows = {};
        for (const s of j.subs) {
          const key = `${s.cls}-${s.seat}`;
          const row = rows[key] || (rows[key] = { key, cls: s.cls, seat: s.seat, name: s.name, results: {} });
          if (s.name) row.name = s.name;
          mergeResult(row.results, s.pid, { verdict: s.verdict, score: +s.score, at: s.time, code: s.code });
        }
        this.emit('all', Object.values(rows));
      } catch (e) { this.emit('allError', e.message); }
    };
    load();
    this.reloadAll = load;
    return () => {};
  }
  async saveProblem(p, solution) {
    await this.post({ action: 'saveProblem', key: this.key, problem: p, solution });
    const i = this.problems.findIndex(x => x.id === p.id);
    if (i >= 0) this.problems[i] = p; else this.problems.push(p);
    this.emit('problems', this.problems);
  }
  async deleteProblem(id) {
    await this.post({ action: 'deleteProblem', key: this.key, id });
    this.problems = this.problems.filter(x => x.id !== id);
    this.emit('problems', this.problems);
  }
  async getSolution(id) {
    const j = await this.get({ action: 'solution', key: this.key, id });
    return j.code || null;
  }
}

AJ.createStore = async function () {
  const cfg = G.AJ_CONFIG || {};
  if (cfg.appsScriptUrl) return new SheetStore(cfg.appsScriptUrl);
  if (G.claude && typeof G.claude.use === 'function') {
    try {
      const [db, user] = await Promise.all([G.claude.use('db'), G.claude.use('user')]);
      if (db) return new ClaudeStore(db, user);
    } catch (e) { console.warn(e); }
  }
  return new LocalStore();
};
})(typeof window !== 'undefined' ? window : globalThis);
