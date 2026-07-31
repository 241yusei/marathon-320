/* =========================================================================
 *  health-os / core — compute-datahealth.js（欠測の検知と結論の封鎖）
 *  --------------------------------------------------------------------------
 *  streams.js の台帳を実データに突き合わせ、各ストリームの遅延レベルを出す。
 *  そして「いま述べてはいけない結論」の集合を返す。
 *
 *  エスカレーション（docs/architecture.md C-3）:
 *    L0 ok    … grace 内。何もしない
 *    L1 注意  … grace 超過〜2周期。次のやり取りで具体的に依頼する
 *    L2 督促  … 2〜4周期。週の優先事項の1件目に固定する
 *    L3 保留  … 4周期超。**blocks[] の結論を一切述べない**
 *    never    … 一度も受領していない。L3と同じく封鎖するが表示を分ける
 *
 *  ★ここが設計の要点:
 *    コーチの善意や記憶に頼らず、isBlocked() が false を返さない限り
 *    その結論は表示もされないし述べてもいけない、という構造にする。
 *    「気をつける」で再発を防げなかったから、この仕組みを作っている。
 * ========================================================================= */

(function () {
  "use strict";

  const HOS = window.HEALTH_OS;
  const DAY = 86400000;

  /* cadence ごとの「1周期」の日数 */
  const PERIOD_DAYS = { daily: 1, weekly: 7, monthly: 30, semiannual: 182 };

  const LEVEL_META = {
    ok:    { rank: 0, icon: "🟢", label: "最新",   blocking: false },
    l1:    { rank: 1, icon: "🟡", label: "注意",   blocking: false },
    l2:    { rank: 2, icon: "🟠", label: "督促",   blocking: false },
    l3:    { rank: 3, icon: "🔴", label: "判断保留", blocking: true  },
    never: { rank: 3, icon: "⚪", label: "未取得", blocking: true  },
  };

  /* 信頼度の重み。L2までは部分的に信用する */
  const CONFIDENCE_WEIGHT = { ok: 1, l1: 0.75, l2: 0.4, l3: 0, never: 0 };

  function parseDate(s) {
    if (!s) return null;
    const d = new Date(s + "T00:00:00");
    return isNaN(d.getTime()) ? null : d;
  }

  /* per-session は「最後に値が入ったセッション以降、何回走ったか」で数える */
  function sessionsSince(D, lastDate) {
    const ss = (D.running && D.running.sessions) || [];
    if (!lastDate) return ss.length;
    return ss.filter((s) => s.date > lastDate).length;
  }

  function evaluate(stream, D, today) {
    const got = typeof stream.resolve === "function" ? stream.resolve(D) : { last: null, count: 0 };
    const last = got.last || null;
    const count = got.count || 0;

    if (!last) {
      return { level: "never", last: null, count: 0, overdue: null, unit: null };
    }

    if (stream.cadence === "per-session") {
      const n = sessionsSince(D, last);
      const grace = stream.graceSessions != null ? stream.graceSessions : 1;
      const over = n - grace;
      const level = over <= 0 ? "ok" : over <= 2 ? "l1" : over <= 4 ? "l2" : "l3";
      return { level, last, count, overdue: n, unit: "回" };
    }

    const ld = parseDate(last);
    if (!ld) return { level: "never", last, count, overdue: null, unit: null };
    const days = Math.floor((today - ld) / DAY);
    const grace = stream.graceDays != null ? stream.graceDays : 2;
    const period = PERIOD_DAYS[stream.cadence] || 1;
    const overPeriods = (days - grace) / period;
    const level = overPeriods <= 0 ? "ok" : overPeriods <= 2 ? "l1" : overPeriods <= 4 ? "l2" : "l3";
    return { level, last, count, overdue: days, unit: "日" };
  }

  function report(opts) {
    const D = HOS.data;
    const streams = (D && D.streams) || [];
    const today = (opts && opts.today) ? new Date(opts.today + "T00:00:00") : new Date();
    today.setHours(0, 0, 0, 0);

    const items = streams.map((s) => {
      const ev = evaluate(s, D, today);
      const meta = LEVEL_META[ev.level];
      return Object.assign({}, ev, {
        id: s.id, label: s.label, pillar: s.pillar, cadence: s.cadence,
        required: !!s.required, blocks: s.blocks || [], ask: s.ask, note: s.note || null,
        icon: meta.icon, levelLabel: meta.label, blocking: meta.blocking && !!s.required,
      });
    });

    /* 述べてはいけない結論 */
    const blocked = {};
    items.forEach((it) => {
      if (it.blocking) it.blocks.forEach((k) => {
        (blocked[k] = blocked[k] || []).push(it.id);
      });
    });

    /* 信頼度 = required ストリームの加重平均 */
    const req = items.filter((it) => it.required);
    const confidence = req.length
      ? Math.round(req.reduce((a, it) => a + CONFIDENCE_WEIGHT[it.level], 0) / req.length * 100)
      : 100;

    /* 深刻な順に並べる。同レベルなら遅れの大きい順 */
    const order = { l3: 0, never: 1, l2: 2, l1: 3, ok: 4 };
    items.sort((a, b) => (order[a.level] - order[b.level]) || ((b.overdue || 0) - (a.overdue || 0)));

    return {
      today: today.toISOString().slice(0, 10),
      items,
      blocked,
      confidence,
      /* L2以上。週の優先事項の先頭に固定すべきもの */
      escalated: items.filter((it) => LEVEL_META[it.level].rank >= 2 && it.required),
      /* 今日要求すべきもの（L1以上のrequired） */
      todaysAsks: items.filter((it) => LEVEL_META[it.level].rank >= 1 && it.required)
                       .map((it) => ({ id: it.id, label: it.label, ask: it.ask, level: it.level })),
    };
  }

  /* キャッシュ（同一レンダー内で何度も呼ばれるため） */
  let _cache = null;
  function get(opts) {
    if (opts && opts.today) return report(opts);   // テスト用は都度計算
    if (!_cache) _cache = report();
    return _cache;
  }

  Object.assign(HOS.compute, {

    dataHealth: get,

    /* ★この関数が結論を封じる。
     * 「このキーの結論を述べてよいか」を全ての render / judgment が通す。 */
    isBlocked(key) {
      const r = get();
      return Object.prototype.hasOwnProperty.call(r.blocked, key);
    },

    /* 封じている原因のストリームを返す（表示用） */
    blockedBy(key) {
      const r = get();
      const ids = r.blocked[key] || [];
      return ids.map((id) => r.items.find((it) => it.id === id)).filter(Boolean);
    },

    /* テスト・デバッグ用にキャッシュを捨てる */
    _resetDataHealth() { _cache = null; },

  });

})();
