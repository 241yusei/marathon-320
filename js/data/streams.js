/* =========================================================================
 *  health-os / data — streams.js（データ在庫台帳）
 *  --------------------------------------------------------------------------
 *  「どのデータが・どの頻度で来るべきで・来ないと何が言えなくなるか」を1箇所に持つ。
 *
 *  これは実在の失敗への構造的な回答である:
 *    ランの心拍が7/7以降ずっと欠測していたにもかかわらず、
 *    ①欠測は認識されていた（優先事項に書いてあった）
 *    ②しかし優先度が上がらなかった（4件中唯一の emphasis:false）
 *    ③そして心拍に依存する結論を出し続けた（zoneCompliance 88% を表示）
 *  対策は3つとも要る。①検知 ②督促の格上げ ③結論の封鎖。
 *  とりわけ③は「コーチが気をつける」では再発する。データ構造が封じる。
 *
 *  各ストリームの形:
 *    id            … 識別子
 *    label         … 表示名
 *    pillar        … 所属する柱
 *    cadence       … "daily" | "per-session" | "weekly" | "monthly" | "semiannual"
 *    graceDays     … 遅れを許容する日数（daily/weekly/monthly/semiannual）
 *    graceSessions … 遅れを許容するセッション数（per-session）
 *    required      … これが欠けたら判断を止めるべきか
 *    blocks[]      … このデータが無いと述べてはいけない結論のキー
 *    ask           … 本人に何をどう依頼するか（コーチの発話をここで規定する）
 *    resolve(data) … 実データから最終受領日と件数を取り出す関数
 *
 *  docs/architecture.md A-2「データ在庫台帳」/ C-3「欠測のエスカレーション」を参照。
 * ========================================================================= */

(function () {
  "use strict";

  const lastDateOf = (arr, pick) => {
    let last = null, count = 0;
    (arr || []).forEach((x) => {
      if (pick(x) != null) { count++; if (!last || x.date > last) last = x.date; }
    });
    return { last, count };
  };

  Object.assign(window.HEALTH_OS.data, {

    streams: [

      /* ---------------------------------------------------------- 毎日 */
      {
        id: "recovery.hrv", label: "起床時HRV", pillar: "recovery",
        cadence: "daily", graceDays: 2, required: true,
        blocks: ["judgment.intensity", "goals.gates.weightloss", "recovery.baseline"],
        ask: "起床直後の安静時HRVを、測定した時刻とあわせて教えてください",
        note: "測定窓（起床時か日中か）が記録されていない値は、同条件でないため比較に使えません",
        resolve: (D) => lastDateOf(D.recovery && D.recovery.daily, (r) => r.hrv && r.hrv.ms),
      },
      {
        id: "recovery.rhr", label: "安静時心拍", pillar: "recovery",
        cadence: "daily", graceDays: 2, required: true,
        blocks: ["judgment.intensity"],
        ask: "起床直後の安静時心拍を教えてください",
        resolve: (D) => lastDateOf(D.recovery && D.recovery.daily, (r) => r.rhr && r.rhr.bpm),
      },
      {
        id: "recovery.sleep", label: "睡眠時間", pillar: "recovery",
        cadence: "daily", graceDays: 2, required: true,
        blocks: ["goals.gates.weightloss"],
        ask: "昨夜の睡眠時間を教えてください",
        resolve: (D) => lastDateOf(D.recovery && D.recovery.daily, (r) => r.sleep && r.sleep.hours),
      },
      {
        id: "recovery.subjective", label: "主観コンディション", pillar: "recovery",
        cadence: "daily", graceDays: 1, required: true,
        blocks: ["judgment.code", "judgment.intensity"],
        ask: "今日の体感を 緑／黄／赤 の一言で教えてください（30秒で終わります）",
        note: "docs/training-protocol.md §7 が支持する Magness の3色システム。客観データと同等以上に重視する",
        resolve: (D) => lastDateOf(D.recovery && D.recovery.daily, (r) => r.subjective && r.subjective.overall),
      },
      {
        id: "body.weight", label: "体重", pillar: "body",
        cadence: "daily", graceDays: 2, required: true,
        blocks: ["body.trend", "goals.projection.factors.body"],
        ask: "毎朝・排尿後・食前・同じ体重計と服装で測った体重を教えてください",
        note: "測定条件が揃っていないと、狙う変化（週0.3〜0.4kg）より測定ノイズの方が大きくなります",
        resolve: (D) => lastDateOf(D.body && D.body.entries, (e) => e.weightKg),
      },

      /* ------------------------------------------------------ 練習ごと */
      {
        id: "running.hr", label: "ランの心拍", pillar: "running",
        cadence: "per-session", graceSessions: 1, required: true,
        blocks: ["running.zones.compliance", "judgment.intensity", "recovery.hrRecovery"],
        ask: "ランの心拍が取れていません。Apple Health の書き出しから抽出するスクリプト（gpx_laps_with_hr.py）を送付済みです",
        note: "ウォッチは正常。workout-routes/*.gpx は緯度経度と時刻のみで心拍を含まず、心拍は export.xml に別レコードで存在する",
        resolve: (D) => lastDateOf(D.running && D.running.sessions, (s) => s.hr && s.hr.avg),
      },
      {
        id: "session.sRPE", label: "セッションRPE", pillar: "cross",
        cadence: "per-session", graceSessions: 0, required: true,
        blocks: ["load.weekly", "load.acwr", "load.monotony"],
        ask: "練習終了の30分後に「どれくらいきつかったか」を0〜10で教えてください",
        note: "ランと筋トレを同じ物差しで足し合わせる唯一の入力。心拍が欠測していても機能する",
        resolve: (D) => lastDateOf(D.running && D.running.sessions, (s) => s.sRPE),
      },

      /* ---------------------------------------------------------- 週次 */
      {
        id: "strength.session", label: "筋トレの記録", pillar: "strength",
        cadence: "weekly", graceDays: 4, required: true,
        blocks: ["strength.e1rm", "strength.weeklySets", "goals.projection.factors.durability"],
        ask: "今週の筋トレ（種目・重量・レップ・所要時間）を教えてください。アプリのCSVでも口頭でも構いません",
        resolve: (D) => lastDateOf(D.strength && D.strength.sessions, (s) => s.date),
      },

      /* ---------------------------------------------------------- 月次 */
      {
        id: "body.composition", label: "体脂肪率・除脂肪量", pillar: "body",
        cadence: "monthly", graceDays: 10, required: false,
        blocks: ["body.targets.leanMass"],
        ask: "体組成計を導入したら、週1回は体脂肪率も記録してください",
        resolve: (D) => lastDateOf(D.body && D.body.entries, (e) => e.bodyFatPct),
      },
      {
        id: "mobility.screen", label: "可動域スクリーニング", pillar: "mobility",
        cadence: "monthly", graceDays: 10, required: false,
        blocks: ["mobility.asymmetryTrend"],
        ask: "足関節背屈テスト（knee-to-wall）の左右を測ってください",
        resolve: (D) => lastDateOf(D.mobility && D.mobility.screens, (s) => s.date),
      },

      /* -------------------------------------------------------- 半年次 */
      {
        id: "labs.panel", label: "血液・健診", pillar: "labs",
        cadence: "semiannual", graceDays: 30, required: true,
        blocks: ["nutrition.supplements.iron", "nutrition.supplements.vitaminD", "goals.gates.labs-baseline"],
        ask: "直近の健康診断結果（PDFまたは写真）をDriveの受信箱に置いてください。採血日・採血前72時間の運動内容・絶食時間もあわせて",
        note: "血液データが無いまま鉄・ビタミンDのサプリを推奨するのは docs/sub3-research.md §3-8 に反する",
        resolve: (D) => lastDateOf(D.labs && D.labs.panels, (p) => p.date),
      },

    ],

  });

})();
