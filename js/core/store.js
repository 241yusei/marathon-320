/* =========================================================================
 *  health-os / core — store.js（端末内の永続化）
 *  --------------------------------------------------------------------------
 *  静的サイトなのでサーバーが無い。入力データは localStorage に置く。
 *
 *  ★この選択の限界を、隠さず設計に織り込む:
 *    ・端末をまたいで同期しない（スマホで入れた記録はPCで見えない）
 *    ・ブラウザのデータを消すと失われる
 *    ・Safari のプライベートモードでは書けないことがある
 *  そこで「書き出し（export）」を一級市民として扱う。書き出したJSONを
 *  Driveの「320」に置けば、私が取り込んで js/data.js 側に恒久化できる。
 *  未書き出しの日数が溜まったら UI が催促する（stats().unexportedDays）。
 *
 *  スキーマは versioned。将来 migrate が要るときに壊れないようにしておく。
 * ========================================================================= */

(function () {
  "use strict";

  const HOS = window.HEALTH_OS;
  const KEY = "healthos.v1";
  const SCHEMA = 1;

  const EMPTY = () => ({
    schema: SCHEMA,
    createdAt: new Date().toISOString(),
    updatedAt: null,
    lastExportAt: null,
    sessions: [],     /* 筋トレセッション */
    checkins: [],     /* 朝の主観・体調 */
    bodyLogs: [],     /* 体重・体脂肪など、アプリから入れたぶん */
  });

  let _mem = null;         /* localStorage が使えない環境向けのフォールバック */
  let _available = null;

  function available() {
    if (_available !== null) return _available;
    try {
      const t = "__healthos_probe__";
      window.localStorage.setItem(t, "1");
      window.localStorage.removeItem(t);
      _available = true;
    } catch (e) {
      _available = false;
    }
    return _available;
  }

  function read() {
    if (!available()) return (_mem = _mem || EMPTY());
    try {
      const raw = window.localStorage.getItem(KEY);
      if (!raw) return EMPTY();
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return EMPTY();
      return migrate(obj);
    } catch (e) {
      /* 壊れたJSONで全機能を巻き添えにしない。退避して作り直す */
      try { window.localStorage.setItem(KEY + ".broken." + Date.now(), window.localStorage.getItem(KEY)); } catch (e2) {}
      return EMPTY();
    }
  }

  function write(db) {
    db.updatedAt = new Date().toISOString();
    if (!available()) { _mem = db; return { ok: true, memoryOnly: true }; }
    try {
      window.localStorage.setItem(KEY, JSON.stringify(db));
      return { ok: true };
    } catch (e) {
      _mem = db;
      return { ok: false, error: String(e && e.name || e), memoryOnly: true };
    }
  }

  function migrate(obj) {
    /* schema 1 が初版。将来ここに if (obj.schema < 2) {...} を足す */
    if (!obj.schema) obj.schema = SCHEMA;
    ["sessions", "checkins", "bodyLogs"].forEach((k) => {
      if (!Array.isArray(obj[k])) obj[k] = [];
    });
    return obj;
  }

  /* ちいさなID。crypto があれば使う */
  function uid() {
    if (window.crypto && window.crypto.getRandomValues) {
      const a = new Uint32Array(2);
      window.crypto.getRandomValues(a);
      return a[0].toString(36) + a[1].toString(36);
    }
    return Math.floor(Math.random() * 1e12).toString(36) + "x";
  }

  const todayISO = () => {
    const d = new Date();
    return [d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0")].join("-");
  };

  /* =====================================================================
   *  公開API
   * ===================================================================== */

  const listeners = [];
  function emit() { listeners.forEach((f) => { try { f(); } catch (e) {} }); }

  const Store = {

    available,
    todayISO,

    /* ---------------------------------------------------------- 読み出し */
    all() { return read(); },

    sessions() { return read().sessions.slice().sort((a, b) => (a.date < b.date ? 1 : -1)); },

    sessionsOn(date) { return read().sessions.filter((s) => s.date === date); },

    /* 直近 n 日ぶんのセッション（負荷計算用） */
    sessionsSince(days) {
      const cut = new Date();
      cut.setDate(cut.getDate() - days);
      const cutISO = cut.toISOString().slice(0, 10);
      return read().sessions.filter((s) => s.date >= cutISO);
    },

    /* 種目ごとの履歴（新しい順）。e1RM の推移に使う */
    historyFor(exerciseId) {
      const out = [];
      read().sessions.forEach((s) => {
        (s.entries || []).forEach((e) => {
          if (e.ex === exerciseId) out.push({ date: s.date, sessionId: s.id, ...e });
        });
      });
      return out.sort((a, b) => (a.date < b.date ? 1 : -1));
    },

    /* ---------------------------------------------------------- 書き込み */

    /* セッションを開始（または当日の既存セッションを返す） */
    startSession(splitKey, date) {
      const db = read();
      const d = date || todayISO();
      let s = db.sessions.find((x) => x.date === d && x.split === splitKey);
      if (!s) {
        s = {
          id: uid(), date: d, split: splitKey,
          startedAt: new Date().toISOString(),
          entries: [],       /* { id, ex, setNo, weightKg, reps, rir, at } */
          sRPE: null,        /* セッション全体のRPE 0-10 */
          durationMin: null,
          note: "",
        };
        db.sessions.push(s);
        write(db);
        emit();
      }
      return s;
    },

    /* 1セットを記録する。これが最も頻繁に呼ばれる */
    addSet(sessionId, { ex, weightKg, reps, rir }) {
      const db = read();
      const s = db.sessions.find((x) => x.id === sessionId);
      if (!s) return null;
      const setNo = s.entries.filter((e) => e.ex === ex).length + 1;
      const entry = {
        id: uid(), ex, setNo,
        weightKg: weightKg == null ? null : Number(weightKg),
        reps: reps == null ? null : Number(reps),
        rir: rir == null ? null : Number(rir),
        at: new Date().toISOString(),
      };
      s.entries.push(entry);
      write(db);
      emit();
      return entry;
    },

    updateSet(sessionId, entryId, patch) {
      const db = read();
      const s = db.sessions.find((x) => x.id === sessionId);
      if (!s) return null;
      const e = s.entries.find((x) => x.id === entryId);
      if (!e) return null;
      ["weightKg", "reps", "rir"].forEach((k) => {
        if (patch[k] !== undefined) e[k] = patch[k] == null ? null : Number(patch[k]);
      });
      write(db);
      emit();
      return e;
    },

    removeSet(sessionId, entryId) {
      const db = read();
      const s = db.sessions.find((x) => x.id === sessionId);
      if (!s) return false;
      const i = s.entries.findIndex((x) => x.id === entryId);
      if (i < 0) return false;
      s.entries.splice(i, 1);
      /* setNo を振り直す */
      const counts = {};
      s.entries.forEach((e) => { counts[e.ex] = (counts[e.ex] || 0) + 1; e.setNo = counts[e.ex]; });
      write(db);
      emit();
      return true;
    },

    /* セッションを締める。sRPE はここで入る（Foster 2001: 終了30分後） */
    finishSession(sessionId, { sRPE, durationMin, note }) {
      const db = read();
      const s = db.sessions.find((x) => x.id === sessionId);
      if (!s) return null;
      if (sRPE != null) s.sRPE = Number(sRPE);
      if (durationMin != null) s.durationMin = Number(durationMin);
      if (note != null) s.note = String(note);
      s.finishedAt = new Date().toISOString();
      write(db);
      emit();
      return s;
    },

    removeSession(sessionId) {
      const db = read();
      const i = db.sessions.findIndex((x) => x.id === sessionId);
      if (i < 0) return false;
      db.sessions.splice(i, 1);
      write(db);
      emit();
      return true;
    },

    /* ------------------------------------------------------ 朝のチェックイン */
    /* 主観コンディション。docs/training-protocol.md §7 の Magness 3色システム */
    saveCheckin({ date, overall, sleepH, soreness, motivation, weightKg, note }) {
      const db = read();
      const d = date || todayISO();
      let c = db.checkins.find((x) => x.date === d);
      if (!c) { c = { id: uid(), date: d }; db.checkins.push(c); }
      if (overall != null) c.overall = overall;               /* "green"|"yellow"|"red" */
      if (sleepH != null) c.sleepH = Number(sleepH);
      if (soreness != null) c.soreness = Number(soreness);    /* 0-10 */
      if (motivation != null) c.motivation = Number(motivation);
      if (note != null) c.note = String(note);
      c.at = new Date().toISOString();
      if (weightKg != null && weightKg !== "") {
        db.bodyLogs.push({ id: uid(), date: d, weightKg: Number(weightKg), at: c.at, source: "app" });
      }
      write(db);
      emit();
      return c;
    },

    checkins() { return read().checkins.slice().sort((a, b) => (a.date < b.date ? 1 : -1)); },
    checkinOn(date) { return read().checkins.find((c) => c.date === date) || null; },
    bodyLogs() { return read().bodyLogs.slice().sort((a, b) => (a.date < b.date ? 1 : -1)); },

    /* ------------------------------------------------------------ 書き出し */

    exportJSON() {
      const db = read();
      db.exportedAt = new Date().toISOString();
      return JSON.stringify(db, null, 2);
    },

    /* 筋トレのセットを1行1セットのCSVに。表計算で見たい・私が取り込む用 */
    exportCSV() {
      const db = read();
      const rows = [["date", "split", "exercise", "set", "weight_kg", "reps", "rir", "e1rm_kg", "volume_kg", "session_rpe", "duration_min", "note"]];
      const e1 = (w, r, rir) =>
        (w == null || r == null) ? "" : (w * (1 + (r + (rir == null ? 0 : rir)) / 30)).toFixed(1);
      db.sessions.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).forEach((s) => {
        (s.entries || []).forEach((e) => {
          rows.push([
            s.date, s.split, e.ex, e.setNo,
            e.weightKg == null ? "" : e.weightKg,
            e.reps == null ? "" : e.reps,
            e.rir == null ? "" : e.rir,
            e1(e.weightKg, e.reps, e.rir),
            (e.weightKg != null && e.reps != null) ? (e.weightKg * e.reps).toFixed(1) : "",
            s.sRPE == null ? "" : s.sRPE,
            s.durationMin == null ? "" : s.durationMin,
            (s.note || "").replace(/[\r\n,]/g, " "),
          ]);
        });
      });
      return rows.map((r) => r.join(",")).join("\n");
    },

    markExported() {
      const db = read();
      db.lastExportAt = new Date().toISOString();
      write(db);
      emit();
    },

    /* 書き出したファイルを読み戻す（機種変更・復元用） */
    importJSON(text, { merge } = { merge: true }) {
      let incoming;
      try { incoming = JSON.parse(text); } catch (e) { return { ok: false, error: "JSONとして読めません" }; }
      if (!incoming || !Array.isArray(incoming.sessions)) return { ok: false, error: "形式が違います（sessions がありません）" };
      if (!merge) { write(migrate(incoming)); emit(); return { ok: true, mode: "replace", sessions: incoming.sessions.length }; }

      const db = read();
      let added = 0;
      const seen = new Set(db.sessions.map((s) => s.id));
      (incoming.sessions || []).forEach((s) => { if (!seen.has(s.id)) { db.sessions.push(s); added++; } });
      const seenC = new Set(db.checkins.map((c) => c.date));
      (incoming.checkins || []).forEach((c) => { if (!seenC.has(c.date)) db.checkins.push(c); });
      const seenB = new Set(db.bodyLogs.map((b) => b.id));
      (incoming.bodyLogs || []).forEach((b) => { if (!seenB.has(b.id)) db.bodyLogs.push(b); });
      write(db);
      emit();
      return { ok: true, mode: "merge", added };
    },

    /* -------------------------------------------------------------- 状態 */
    stats() {
      const db = read();
      const withSets = db.sessions.filter((s) => (s.entries || []).length > 0);
      const last = withSets.map((s) => s.date).sort().pop() || null;
      let unexportedDays = null;
      if (db.lastExportAt && last) {
        unexportedDays = db.sessions.filter((s) => s.date > db.lastExportAt.slice(0, 10)).length;
      } else if (withSets.length) {
        unexportedDays = withSets.length;
      }
      return {
        sessions: withSets.length,
        sets: db.sessions.reduce((a, s) => a + (s.entries || []).length, 0),
        checkins: db.checkins.length,
        lastSession: last,
        lastExportAt: db.lastExportAt,
        unexportedSessions: unexportedDays,
        storage: available() ? "localStorage" : "memory-only",
      };
    },

    /* テスト・やり直し用 */
    reset() {
      if (available()) { try { window.localStorage.removeItem(KEY); } catch (e) {} }
      _mem = null;
      emit();
    },

    onChange(fn) { listeners.push(fn); return () => {
      const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1);
    }; },
  };

  HOS.store = Store;

})();
