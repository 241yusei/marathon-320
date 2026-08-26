/* =========================================================================
 *  health-os / data — _legacy-adapter.js（移行 M1・読み取り専用の射影）
 *  --------------------------------------------------------------------------
 *  役割
 *    window.MARATHON_DATA（js/data.js・現行の単一データソース）を読み、
 *    docs/architecture.md A-2 のスキーマへ **読み取り専用で射影** する。
 *    描画は依然 js/main.js が MARATHON_DATA を直接読むので、このファイルを
 *    足しても見た目は 1px も変わらない（A-3 の移行パス M1）。
 *
 *  設計上の約束（この3つは絶対に破らない）
 *    1. MARATHON_DATA を **書き換えない**。読むだけ。射影は全て新規オブジェクトで
 *       組み立て（defensive copy）、最後に deepFreeze して書き込み不能にする。
 *       ※ MARATHON_DATA 自体は freeze しない。main.js の実行時セマンティクスを
 *         変えないため（＝「既存の描画を一切変えない」を優先）。
 *    2. **元データに無い情報を推測で埋めない**。構造化データとして存在しない値は
 *       必ず null にする。null は欠測検知（#9 / A-2 streams）の検出対象になるので、
 *       ここで埋めてしまうと「3週間 心拍が欠測しても放置された」失敗を再生産する。
 *    3. ES Modules を使わない。classic script + window 名前空間（A / 0-4）。
 *
 *  文字列 → 数値 について
 *    現行データは HRV も体重も睡眠も全て文字列（"37" / "74.0" / "7.5"）。ここで
 *    数値化する。欠測マーカー "—" は null。"~50" のようなチルダ付きは
 *    「その日の複数回測定のおおよその平均」を人が手で丸めた値なので、数値 50 に
 *    しつつ `approx: true` を立てる。丸めた値と実測値を同じ精度として平均や
 *    SD の計算に混ぜると、compute.baseline() のベースラインが静かに歪むため、
 *    精度が落ちていることをデータ側に残す（判断は compute 層に委ねる）。
 *
 *  note の扱い
 *    dailyLog の note は「事実」と「コーチの所見」が混在している。分解すると
 *    所見を事実に格上げしてしまうので **原文のまま note として保持** する。
 *    例外は A-2 が明示的に要求する測定窓メタデータ（hrv.window / samples /
 *    rangeMs）と、出典マーカー（本人申告）だけ。いずれも note 内の
 *    **リテラルな表記**にのみ反応する正規表現で抽出し、書かれていないものは
 *    null にする（下記 readHrvMeta / readSelfReport のコメント参照）。
 * ========================================================================= */

(function () {
  "use strict";

  var HOS = window.HEALTH_OS;
  if (!HOS) { console.error("[legacy-adapter] HEALTH_OS missing — js/data/_boot.js を先に読むこと"); return; }

  var SRC = window.MARATHON_DATA;
  if (!SRC) { console.error("[legacy-adapter] MARATHON_DATA missing — js/data.js を先に読むこと"); return; }

  var warnings = [];

  /* ===================================================== 小さなパーサ群 ==== */

  var MISSING = "—";                                  // 現行データの欠測マーカー

  function isBlank(v) {
    if (v === null || v === undefined) return true;
    if (typeof v === "number") return false;
    var s = String(v).trim();
    return s === "" || s === MISSING || s === "-" || s === "―";
  }

  /* 文字列 → { value:number|null, approx:boolean }
   * "74.0" → 74 / "—" → null / "~50" → 50(approx) / "約57 ms" → 57(approx) */
  function parseNum(raw) {
    if (isBlank(raw)) return { value: null, approx: false };
    if (typeof raw === "number") return { value: isFinite(raw) ? raw : null, approx: false };
    var s = String(raw).trim();
    var approx = /[~〜]\s*\d/.test(s) || /約/.test(s) || /推定/.test(s);
    var m = s.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    if (!m) return { value: null, approx: false };
    return { value: parseFloat(m[0]), approx: approx };
  }
  function num(raw) { return parseNum(raw).value; }

  /* "133〜148g" → [133,148] / "172〜" → [172,null] / "2,300〜2,500" → [2300,2500]
   * 範囲表記でなければ null（単一値は呼び出し側で num() を使う） */
  function parseRange(raw) {
    if (isBlank(raw)) return null;
    var s = String(raw).replace(/,/g, "");
    var m = s.match(/(-?\d+(?:\.\d+)?)\s*[〜~–]\s*(-?\d+(?:\.\d+)?)?/);
    if (!m) return null;
    return [parseFloat(m[1]), m[2] != null ? parseFloat(m[2]) : null];
  }

  /* 日付ラベル "6/4" → ISO "2026-06-04"
   * 現行データに年が無い。meta.lastUpdated（"2026-07-29"）を基準に決定的に補う:
   *   dir="past"   … ログ（過去向き）: 基準より後の月なら前年
   *   dir="future" … スケジュール（未来向き）: 基準より前の月なら翌年
   * 実データは 5〜8月・基準 7月なので全て 2026 年になる（下の検証で確認済み）。 */
  var baseYear = null, baseMonth = null;
  (function () {
    var lu = SRC.meta && SRC.meta.lastUpdated;
    var m = lu && String(lu).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) { baseYear = +m[1]; baseMonth = +m[2]; }
    else warnings.push("meta.lastUpdated が ISO 形式でないため日付の年を補完できない");
  })();

  function toISO(label, dir) {
    if (isBlank(label) || baseYear == null) return null;
    var m = String(label).match(/(\d{1,2})\/(\d{1,2})/);
    if (!m) return null;
    var mo = +m[1], d = +m[2], y = baseYear;
    if (dir === "future") { if (mo < baseMonth) y = baseYear + 1; }
    else { if (mo > baseMonth) y = baseYear - 1; }
    return y + "-" + (mo < 10 ? "0" : "") + mo + "-" + (d < 10 ? "0" : "") + d;
  }

  /* run テキスト先頭の距離 "5.92km 朝練" → 5.92
   * 最初の「数値+km」だけを採る。後続の "(計画5kmに対し未達)" のような
   * 計画値を実績に混ぜないため（合計しない）。 */
  function firstDistanceKm(text) {
    if (isBlank(text)) return null;
    var m = String(text).match(/(\d+(?:\.\d+)?)\s*km/);
    return m ? parseFloat(m[1]) : null;
  }

  /* ペース "7'40\"/km" → 460 秒/km
   * トークンが 2 つ以上ある文字列（7/14 の「朝6'47"/km・夜9'05"/km」＝同日2回走）は
   * どちらが代表値か決められないので **null**（原文は paceRaw に残す）。 */
  function parsePaceSecPerKm(text) {
    if (isBlank(text)) return null;
    var all = String(text).match(/(\d+)\s*'\s*(\d+)\s*"\s*\/\s*km/g);
    if (!all || all.length !== 1) return null;
    var m = all[0].match(/(\d+)\s*'\s*(\d+)/);
    return (+m[1]) * 60 + (+m[2]);
  }

  /* 所要時間。"約1時間49分" → 109 分。
   * 「N分」単独形は採らない（7/14 の "1kmは56分停止" のような、走行時間ではない
   *  分数を拾ってしまうため）。書かれていなければ null。 */
  function parseDurationMin(text) {
    if (isBlank(text)) return null;
    var m = String(text).match(/(\d+)\s*時間\s*(\d+)?\s*分?/);
    if (!m) return null;
    return (+m[1]) * 60 + (m[2] ? +m[2] : 0);
  }

  /* ---- 実施されなかった「run」欄の判定 --------------------------------
   * run 欄は「—」以外でも走行実績とは限らない。実データ 26 件のうち 4 件が
   * 非実施:
   *   6/15 "ストレッチのみ" / 6/22 "休養（コンディション計測）"
   *   7/18 "記録なし(週最長6km予定は未実施とみられる)"  ← 6km は未実施の計画値
   *   7/29 "（本日・イージー4〜5km予定）"                ← 当日の予定
   * これらを距離だけ正規表現で拾うと、走っていない距離を running.sessions に
   * 混入させる。非実施を示すリテラル表記でのみ除外する。
   * 「未達」「計画外」は実施済み（7/15・7/16）なので除外語に入れない。 */
  var NOT_EXECUTED = /記録なし|未実施|予定|ストレッチのみ|休養/;
  function isExecutedRun(runText) {
    if (isBlank(runText)) return false;
    if (NOT_EXECUTED.test(String(runText))) return false;
    return firstDistanceKm(runText) != null;
  }

  /* ---- HRV 測定窓メタデータの抽出 --------------------------------------
   * A-2 が「測定窓を必ず記録」と要求する唯一の項目。note に
   * 「日中4回測定」「日中平均」「日次平均」「測定6回分」「n=2のみで日平均」
   * のような **複数回測定であることが明記された表記** がある場合のみ
   * window="daytime-multi" を立てる。
   * 「HRV35ms」「同日のHRVは70.9ms」のように窓が書かれていないものは必ず null。
   * 7/22 の note 自身が「起床時安静か活動後か確認したい」と書いているとおり、
   * 窓不明を "waking-rest" と決めつけると 7/22 の RHR71/HRV70.9 矛盾のような
   * 誤読を再生産する。post-exercise / waking-rest を示す表記は現行データに
   * 存在しないため、このアダプタが返す window は "daytime-multi" か null のみ。 */
  function readHrvMeta(note) {
    var out = { window: null, samples: null, rangeMs: null };
    if (isBlank(note)) return out;
    var s = String(note);

    var multi = /日中\s*\d+\s*回測定/.test(s)
      || /日中平均/.test(s)
      || /日次平均/.test(s)
      || /測定\s*\d+\s*回分/.test(s)
      || /n\s*=\s*\d+[^。]{0,6}日平均/.test(s);
    if (multi) out.window = "daytime-multi";

    var sm = s.match(/(\d+)\s*回測定/) || s.match(/(\d+)\s*回計測/)
      || s.match(/測定\s*(\d+)\s*回分/) || s.match(/n\s*=\s*(\d+)/);
    if (sm) out.samples = +sm[1];

    var rm = s.match(/範囲\s*(\d+(?:\.\d+)?)\s*〜\s*(\d+(?:\.\d+)?)/);
    if (rm) out.rangeMs = [parseFloat(rm[1]), parseFloat(rm[2])];

    // 窓が判別できないのに samples/range だけ拾えた場合も window は null のまま
    return out;
  }

  /* ---- 出典（本人申告）マーカー -----------------------------------------
   * 「（本人申告）」はコーチの所見ではなく出典そのものなので、source として
   * 構造化してよい（値は一切書き換えない）。書かれていなければ null。 */
  function readSleepSource(note) {
    if (isBlank(note)) return null;
    return /本人申告|自己申告/.test(String(note)) ? "self-report" : null;
  }
  function readWeightSource(note) {
    if (isBlank(note)) return null;
    var s = String(note);
    return /(本人申告|自己申告)[^。]{0,20}体重|体重[^。]{0,20}(本人申告|自己申告)/.test(s)
      ? "self-report" : null;
  }

  function deepFreeze(o) {
    if (o && (typeof o === "object") && !Object.isFrozen(o)) {
      Object.freeze(o);
      Object.keys(o).forEach(function (k) { deepFreeze(o[k]); });
    }
    return o;
  }

  /* ===================================================== 柱⑥ recovery ==== */
  /* dailyLog 41 件 → recovery.daily 41 件（欠測日も欠落させず null で残す）。 */

  var dailyLog = Array.isArray(SRC.dailyLog) ? SRC.dailyLog : [];

  var recoveryDaily = dailyLog.map(function (d) {
    var hrvN = parseNum(d.hrv);
    var hrvMeta = readHrvMeta(d.note);
    var sleepN = parseNum(d.sleep);
    return {
      date: toISO(d.date, "past"),
      dateLabel: isBlank(d.date) ? null : String(d.date),
      hrv: {
        ms: hrvN.value,
        approx: hrvN.value == null ? null : hrvN.approx,   // "~50" 由来なら true
        lnRmssd: null,          // 導出値。compute.baseline() の担当（A-2）
        samples: hrvMeta.samples,
        window: hrvMeta.window, // 判別できないものは null（推測で埋めない）
        device: null,           // 現行データに機種情報なし
        rangeMs: hrvMeta.rangeMs,
      },
      rhr: {
        bpm: num(d.rhr),
        source: null,
        window: null,           // 現行データに測定窓の記録なし
      },
      sleep: {
        hours: sleepN.value,
        source: readSleepSource(d.note),
        quality: null, bedtime: null, waketime: null,
      },
      subjective: {             // 主観スコアは構造化データとして存在しない
        overall: null, legs: null, motivation: null, soreness: null, stress: null,
      },
      judge: isBlank(d.judge) ? null : String(d.judge),   // コーチ判定（原文のまま）
      note: isBlank(d.note) ? null : String(d.note),      // ★分解しない
    };
  });

  /* ======================================================== 柱① body ===== */
  /* dailyLog の weight から body.entries を作る（"—" の日は行を作らない）。 */

  var bodyEntries = dailyLog.filter(function (d) { return !isBlank(d.weight); }).map(function (d) {
    return {
      date: toISO(d.date, "past"),
      dateLabel: String(d.date),
      source: "legacy:dailyLog",
      quality: null,
      weightKg: num(d.weight),
      weightSource: readWeightSource(d.note),
      bodyFatPct: null, leanMassKg: null, bodyWaterPct: null,
      visceralFatLevel: null, bmrKcal: null,
      conditionsMet: null,      // 測定条件（排尿後・同一体重計等）の記録がない
      note: isBlank(d.note) ? null : String(d.note),
    };
  });

  /* ==================================================== 柱⑤ running ===== */
  /* dailyLog.run（実施分 22 件）と recentRuns（23 件）を **日付で統合** する。
   * 5/26・5/30 は recentRuns にのみ、6/14 は dailyLog にのみ存在するので
   * 和集合は 24 件になる（22 + 2）。 */

  var byDate = {};   // dateLabel -> session
  var order = [];

  function session(label) {
    if (!byDate[label]) {
      byDate[label] = {
        date: toISO(label, "past"),
        dateLabel: label,
        sources: [],
        startTime: null,             // 時刻は note の文中にしかないので構造化しない
        type: null,                  // 現行データにセッション種別の構造化なし
        planned: null,               // 計画値は schedule 側にしかない（running.plan）
        distanceKm: null,
        durationMin: null,
        durationApprox: null,
        avgPaceSecPerKm: null,
        hr: { avg: null, max: null, source: null, recovery1min: null },  // ★常に null
        zones: null,                 // ゾーン%は note の文中のみ。構造化データ無し
        sRPE: null,                  // ★元データに存在しない
        laps: [],                    // 現行データにラップ配列なし
        quality: { hr: null, gps: null, zones: null },
        distRaw: null, paceRaw: null, runRaw: null,
        judge: null, note: null, formNote: null, good: null,
      };
      order.push(label);
    }
    return byDate[label];
  }

  dailyLog.forEach(function (d) {
    if (!isExecutedRun(d.run)) return;
    var s = session(String(d.date));
    s.sources.push("legacy:dailyLog");
    s.runRaw = String(d.run);
    s.distanceKm = firstDistanceKm(d.run);
    var dur = parseDurationMin(d.run);
    if (dur != null) { s.durationMin = dur; s.durationApprox = parseNum(d.run).approx; }
    s.avgPaceSecPerKm = parsePaceSecPerKm(d.run);
    s.judge = isBlank(d.judge) ? null : String(d.judge);
    s.note = isBlank(d.note) ? null : String(d.note);
  });

  (Array.isArray(SRC.recentRuns) ? SRC.recentRuns : []).forEach(function (r) {
    var s = session(String(r.date));
    s.sources.push("legacy:recentRuns");
    s.distRaw = isBlank(r.dist) ? null : String(r.dist);
    s.paceRaw = isBlank(r.pace) ? null : String(r.pace);
    // recentRuns.dist は人が確定させた距離（7/14 の同日2回は合算 "5.0km(2回)"）
    // なので dailyLog の先頭距離より優先する。
    var dk = firstDistanceKm(r.dist);
    if (dk != null) s.distanceKm = dk;
    var pc = parsePaceSecPerKm(r.pace);
    if (pc != null) s.avgPaceSecPerKm = pc;
    s.formNote = isBlank(r.note) ? null : String(r.note);
    s.good = (typeof r.good === "boolean") ? r.good : null;
    /* ★実測心拍（2026-07-31にApple Healthのexport.xmlから抽出して判明）。
     * それまで hr.avg は常に null で、欠測検知が strength/zones の判断を封じていた。
     * 値がある回だけ埋める。無い回は null のまま＝引き続き検知対象。 */
    if (typeof r.hrAvg === "number") {
      s.hr.avg = r.hrAvg;
      s.hr.source = "apple-health:WorkoutStatistics";
      if (typeof r.hrMax === "number") s.hr.max = r.hrMax;
      s.quality.hr = "measured";
    }
    if (typeof r.z12 === "number") {
      s.zones = { method: "hr-measured", z12pct: r.z12 };
      s.quality.zones = "measured";
    }
  });

  var runningSessions = order
    .map(function (k) { return byDate[k]; })
    .sort(function (a, b) { return (a.date || "") < (b.date || "") ? -1 : 1; });

  /* schedule（曜日別メニュー）→ running.plan */
  var runningPlan = (Array.isArray(SRC.schedule) ? SRC.schedule : []).map(function (p) {
    var wd = String(p.day || "").trim().charAt(0);
    var range = parseRange(p.dist);
    return {
      date: toISO(p.day, "future"),
      dayLabel: isBlank(p.day) ? null : String(p.day),
      weekday: wd || null,
      type: null,                                   // メニュー文からは種別を断定しない
      menu: isBlank(p.menu) ? null : String(p.menu),
      distanceKm: range ? null : num(p.dist),       // 範囲指定は単一値にしない
      distanceKmRange: range,
      distanceRaw: isBlank(p.dist) ? null : String(p.dist),
      constraint: isBlank(p.zone) ? null : String(p.zone),
      isPillarSession: /★/.test(String(p.menu || "")),  // ★＝週の主柱（リテラル表記）
      rest: (typeof p.rest === "boolean") ? p.rest : null,
    };
  });

  /* zones（心拍ゾーン） */
  var runningZones = (Array.isArray(SRC.zones) ? SRC.zones : []).map(function (z) {
    return {
      z: z.z, name: z.name,
      hrBpmRange: parseRange(z.hr),
      hrRaw: isBlank(z.hr) ? null : String(z.hr),
      paceRaw: isBlank(z.pace) ? null : String(z.pace),
      purpose: z.purpose,
      core: (typeof z.core === "boolean") ? z.core : null,
    };
  });

  var zc = SRC.zoneCompliance || {};
  var zoneCompliance = {
    pct: num(zc.pct),
    targetPct: num(zc.target),
    date: toISO(zc.date, "past"),
    dateLabel: isBlank(zc.date) ? null : String(zc.date),
  };

  /* ======================================================= goals ========= */

  var race = SRC.race || {};
  var cand = race.candidate || {};
  var goalsRace = {
    name: race.name || null,
    date: race.date || null,                        // 元から ISO
    type: race.type || null,
    goalRaw: race.goal || null,                     // "3:22〜3:26（最大限: sub-3:20）"
    candidate: {
      name: cand.name || null, date: cand.date || null,
      note: cand.note || null,
    },
  };

  var goalsPhases = (Array.isArray(SRC.phases) ? SRC.phases : []).map(function (p) {
    return {
      id: p.id, name: p.name, weeks: p.weeks, dist: p.dist, goal: p.goal,
      active: (typeof p.active === "boolean") ? p.active : null,
    };
  });

  /* gates: conditions は日本語文字列のまま射影する。A-2 の
   * 「条件をオブジェクト化して compute が評価する」形への変換は M3 の仕事で、
   * ここで機械変換すると閾値を推測で作り込むことになる。 */
  var goalsGates = (Array.isArray(SRC.gates) ? SRC.gates : []).map(function (g) {
    return {
      name: g.name,
      locked: (typeof g.locked === "boolean") ? g.locked : null,
      progress: num(g.progress),
      total: num(g.total),
      unit: isBlank(g.unit) ? null : String(g.unit),
      conditionsRaw: Array.isArray(g.conditions) ? g.conditions.slice() : [],
      why: g.why || null,
    };
  });

  var pj = SRC.projection || {};
  var goalsProjection = {
    updated: pj.updated || null,
    updatePolicy: pj.updatePolicy || null,
    readinessLabel: pj.readinessLabel || null,
    headline: pj.headline || null,
    scenarios: (Array.isArray(pj.scenarios) ? pj.scenarios : []).map(function (s) {
      return { goal: s.goal, when: s.when, prob: num(s.prob), note: s.note || null };
    }),
    factors: (Array.isArray(pj.factors) ? pj.factors : []).map(function (f) {
      return {
        name: f.name, weight: num(f.weight), score: num(f.score),
        now: f.now || null, need: f.need || null, note: f.note || null,
      };
    }),
    swing: Array.isArray(pj.swing) ? pj.swing.slice() : [],
    method: pj.method || null,
  };

  var meta = SRC.meta || {};
  var goalsCurrentPhase = {
    label: meta.phase || null,
    week: meta.phaseWeek || null,
    goal: meta.phaseGoal || null,
  };

  /* ==================================================== nutrition ======== */

  var nu = SRC.nutrition || {};
  var cal = nu.calories || {};
  var nutrition = {
    calories: {
      bmrKcal: num(cal.bmr),
      tdeeKcal: num(cal.tdee),
      targetKcalRange: parseRange(cal.target),
      targetRaw: isBlank(cal.target) ? null : String(cal.target),
    },
    macros: (Array.isArray(nu.macros) ? nu.macros : []).map(function (m) {
      return {
        name: m.name,
        amountGRange: parseRange(m.amount),
        amountRaw: isBlank(m.amount) ? null : String(m.amount),
        perRange: parseRange(m.per),
        perRaw: isBlank(m.per) ? null : String(m.per),
        note: m.note || null,
        pct: num(m.pct),
      };
    }),
    supplements: (Array.isArray(nu.supplements) ? nu.supplements : []).map(function (s) {
      return {
        name: s.name,
        doseRange: parseRange(s.dose),
        doseRaw: isBlank(s.dose) ? null : String(s.dose),
        evidence: s.evidence || null,
      };
    }),
  };

  /* ================================= config.athlete のキー名差異を吸収 ==== */
  /* data.js:  meta.athlete = { name, birth, age:30, sex, height:174 }
   * config.js: athlete     = { name, birth, sex, heightCm:174 }
   *   ・height → heightCm に正規化（数値）
   *   ・age は **移送しない**。config.js のコメント通り生年月日から都度計算する
   *     （二重管理を作らない）。
   *   ・config 側に欠けているキーだけ埋め、既存値は上書きしない。矛盾は警告に残す。 */
  var la = meta.athlete || {};
  var legacyAthlete = {
    name: la.name || null,
    birth: la.birth || null,
    sex: la.sex || null,
    heightCm: num(la.height != null ? la.height : la.heightCm),
  };
  (function () {
    HOS.config.athlete = HOS.config.athlete || {};
    Object.keys(legacyAthlete).forEach(function (k) {
      var v = legacyAthlete[k];
      if (v == null) return;
      if (HOS.config.athlete[k] == null) { HOS.config.athlete[k] = v; return; }
      if (HOS.config.athlete[k] !== v) {
        warnings.push("config.athlete." + k + " (" + HOS.config.athlete[k] +
          ") と data.js meta.athlete (" + v + ") が一致しない");
      }
    });
  })();

  /* ======================================================== 登録 ========= */

  var projection = {

    body: {
      entries: bodyEntries,
      targets: {
        // meta.targetWeight（構造化された唯一の目標体重）だけを採る。
        // 「10/25は71〜72kgが現実的」は metrics の文中の所見なので採らない。
        weightKg: { by: goalsRace.date, realisticKg: null, stretchKg: num(meta.targetWeight),
                    paceKgPerWeek: null },
      },
    },

    running: {
      sessions: runningSessions,
      plan: runningPlan,
      zones: runningZones,
      zoneCompliance: zoneCompliance,
    },

    recovery: { daily: recoveryDaily },

    goals: {
      race: goalsRace,
      phases: goalsPhases,
      gates: goalsGates,
      projection: goalsProjection,
      currentPhase: goalsCurrentPhase,
    },

    nutrition: nutrition,

    _adapter: {
      name: "_legacy-adapter",
      migrationStep: "M1",
      readOnly: true,
      source: "window.MARATHON_DATA (js/data.js)",
      sourceLastUpdated: meta.lastUpdated || null,
      counts: {
        recoveryDaily: recoveryDaily.length,
        bodyEntries: bodyEntries.length,
        runningSessions: runningSessions.length,
        runningPlan: runningPlan.length,
      },
      warnings: warnings,
    },
  };

  Object.assign(HOS.data, deepFreeze(projection));

})();
