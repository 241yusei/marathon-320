/* =========================================================================
 *  health-os / core — compute-strength.js（筋トレの導出値）
 *  --------------------------------------------------------------------------
 *  入力された 重量 × 回数 × RIR から、判断に使える量を導く。
 *
 *  根拠: docs/strength-research.md
 *    §8-4  RIR ベースの自動調整（Zourdos 2016）と e1RM 換算
 *    §2-3  週間セット数（Schoenfeld 2017）— ただし肥大は本目的ではない
 *    §5    傷害予防種目の実施状況を独立に追う
 *
 *  ★1RM テストはしない。理由は3つ:
 *    ① 1RM は睡眠・疲労・ストレスで日々±10%動く。固定%だと不調の日に潰れる
 *    ② テスト自体が高リスク・高疲労で、ランの回復を削る
 *    ③ RIR から推定すれば、毎セットが自動的に測定を兼ねる
 * ========================================================================= */

(function () {
  "use strict";

  const HOS = window.HEALTH_OS;

  /* ------------------------------------------------------------- e1RM */
  /* Epley 式に RIR を組み込む。「あと rir 回上げられた」＝実質 reps+rir 回のセット。
   *   e1RM = w × (1 + (reps + rir) / 30)
   * 10回相当を超えると誤差が急に増えるので、その旨のフラグを返す。 */
  function e1rm(weightKg, reps, rir) {
    if (weightKg == null || reps == null) return null;
    const w = Number(weightKg), r = Number(reps), x = rir == null ? 0 : Number(rir);
    if (!(w > 0) || !(r > 0)) return null;
    const eff = r + x;
    return {
      value: w * (1 + eff / 30),
      effReps: eff,
      /* 実効10回を超えると Epley の外挿誤差が大きい */
      reliable: eff <= 10,
    };
  }

  /* %1RM → 目標重量。ブロックの処方から「今日いくつ持つか」を出す */
  function loadFor(e1rmKg, targetReps, targetRir) {
    if (!(e1rmKg > 0)) return null;
    const eff = Number(targetReps) + (targetRir == null ? 0 : Number(targetRir));
    const w = e1rmKg / (1 + eff / 30);
    /* ジムのプレート刻み（2.5kg）に丸める */
    return Math.round(w / 2.5) * 2.5;
  }

  /* --------------------------------------------------- 種目ごとのベスト */
  function bestFor(exerciseId) {
    const hist = HOS.store.historyFor(exerciseId);
    let best = null, latest = null;
    hist.forEach((h) => {
      const e = e1rm(h.weightKg, h.reps, h.rir);
      if (!e) return;
      if (!latest) latest = { ...h, e1rm: e.value };
      if (!best || e.value > best.e1rm) best = { ...h, e1rm: e.value };
    });
    return { best, latest, sets: hist.length };
  }

  /* e1RM の時系列（日ごとの最大値）。グラフ用 */
  function e1rmSeries(exerciseId) {
    const byDate = {};
    HOS.store.historyFor(exerciseId).forEach((h) => {
      const e = e1rm(h.weightKg, h.reps, h.rir);
      if (!e) return;
      if (!byDate[h.date] || e.value > byDate[h.date]) byDate[h.date] = e.value;
    });
    return Object.keys(byDate).sort().map((d) => ({ date: d, e1rm: byDate[d] }));
  }

  /* --------------------------------------------------------- ボリューム */
  /* volume load = Σ(重量 × 回数)。セッション/週の総仕事量 */
  function sessionVolume(session) {
    return (session.entries || []).reduce(
      (a, e) => a + ((e.weightKg || 0) * (e.reps || 0)), 0);
  }

  /* 筋群ごとの週間セット数。Schoenfeld 2017 の用量反応を見るため。
   * 主働筋は1.0、協働筋は0.5セットとして数える（慣行的な数え方）。 */
  function weeklySetsByMuscle(days) {
    const D = HOS.data;
    const out = {};
    HOS.store.sessionsSince(days || 7).forEach((s) => {
      (s.entries || []).forEach((en) => {
        const ex = D.exerciseById && D.exerciseById(en.ex);
        if (!ex) return;
        (ex.muscles.primary || []).forEach((m) => { out[m] = (out[m] || 0) + 1; });
        (ex.muscles.secondary || []).forEach((m) => { out[m] = (out[m] || 0) + 0.5; });
      });
    });
    return Object.keys(out)
      .map((m) => ({ muscle: m, sets: Math.round(out[m] * 10) / 10 }))
      .sort((a, b) => b.sets - a.sets);
  }

  /* -------------------------------------------------- 傷害予防の実施状況 */
  /* §5 の種目が実際に入っているかを独立に見る。
   * これらは「やった気になって抜ける」ことが最も多い部分。 */
  function injuryPreventionStatus(days) {
    const D = HOS.data;
    const win = days || 14;
    const done = {};
    HOS.store.sessionsSince(win).forEach((s) => {
      (s.entries || []).forEach((en) => {
        if (!done[en.ex] || s.date > done[en.ex]) done[en.ex] = s.date;
      });
    });
    return (D.exercises || [])
      .filter((e) => e.injuryPrevention && !e.home)
      .map((e) => ({
        id: e.id, name: e.name, short: e.short,
        last: done[e.id] || null,
        ok: !!done[e.id],
        why: e.runner,
      }));
  }

  /* ------------------------------------------------- 次回の推奨重量 */
  /* 前回の実績と、今のブロックの目標RIRから次のセットの重量を出す。
   * 「前回 RIR が目標より余っていたら上げる／足りなければ下げる」だけの
   * 素直な自動調整。複雑なアルゴリズムより、本人が納得できる規則性を優先する。 */
  function suggestLoad(exerciseId, targetReps, targetRir) {
    const { latest } = bestFor(exerciseId);
    if (!latest) return { kg: null, reason: "初回。10回できる重さで様子を見る（RIR 3〜4）", first: true };

    const e = e1rm(latest.weightKg, latest.reps, latest.rir);
    if (!e) return { kg: null, reason: "前回の記録が不完全", first: true };

    /* 「4〜6回」のような範囲は中央値で処方する。
     * 下限（4回）を採ると最も重い側になり、範囲の上限まで続けられない重量が出る。
     * 上限を採ると軽すぎる。中央を採ると、前回がRIR目標どおりだったときに
     * ちょうど同じ重量が返る（＝納得できる挙動になる）。 */
    const nums = String(targetReps).match(/\d+/g);
    const reps = nums && nums.length
      ? (nums.length > 1 ? (Number(nums[0]) + Number(nums[1])) / 2 : Number(nums[0]))
      : 5;
    const kg = loadFor(e.value, reps, targetRir);

    let reason;
    if (latest.rir == null) {
      reason = `前回 ${latest.weightKg}kg×${latest.reps}回 から推定`;
    } else if (latest.rir > targetRir + 0.5) {
      reason = `前回は RIR${latest.rir}（目標 ${targetRir}）で余裕があった。上げてよい`;
    } else if (latest.rir < targetRir - 0.5) {
      reason = `前回は RIR${latest.rir}（目標 ${targetRir}）で追い込みすぎ。据え置くか落とす`;
    } else {
      reason = `前回 RIR${latest.rir} は目標どおり。推定1RM ${e.value.toFixed(0)}kg から算出`;
    }
    return { kg, reason, e1rm: e.value, reliable: e.reliable, last: latest };
  }

  /* --------------------------------------------------------- サマリー */
  function summary() {
    const st = HOS.store.stats();
    const sessions7 = HOS.store.sessionsSince(7).filter((s) => (s.entries || []).length);
    const sessions28 = HOS.store.sessionsSince(28).filter((s) => (s.entries || []).length);
    return {
      totalSessions: st.sessions,
      totalSets: st.sets,
      lastSession: st.lastSession,
      week: {
        sessions: sessions7.length,
        sets: sessions7.reduce((a, s) => a + s.entries.length, 0),
        volumeKg: Math.round(sessions7.reduce((a, s) => a + sessionVolume(s), 0)),
      },
      month: {
        sessions: sessions28.length,
        volumeKg: Math.round(sessions28.reduce((a, s) => a + sessionVolume(s), 0)),
      },
      byMuscle: weeklySetsByMuscle(7),
      injuryPrevention: injuryPreventionStatus(14),
      storage: st.storage,
      unexportedSessions: st.unexportedSessions,
      lastExportAt: st.lastExportAt,
    };
  }

  Object.assign(HOS.compute, {
    e1rm, loadFor, bestFor, e1rmSeries,
    sessionVolume, weeklySetsByMuscle, injuryPreventionStatus,
    suggestLoad, strengthSummary: summary,
  });

})();
