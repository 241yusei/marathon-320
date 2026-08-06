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

  /* アプリ内で入力されたデータ（localStorage）も在庫として数える。
   * store が未初期化でも壊れないよう、毎回 window から引き直す。 */
  const store = () => (window.HEALTH_OS && window.HEALTH_OS.store) || null;
  const merge = (a, b) => ({
    last: (!a.last || (b.last && b.last > a.last)) ? (b.last || a.last) : a.last,
    count: (a.count || 0) + (b.count || 0),
  });

  Object.assign(window.HEALTH_OS.data, {

    streams: [

      /* ---------------------------------------------------------- 毎日 */
      {
        id: "recovery.hrv", label: "起床時HRV", pillar: "recovery",
        cadence: "daily", graceDays: 2, required: true,
        blocks: ["judgment.intensity", "goals.gates.weightloss", "recovery.baseline"],
        ask: "起床直後の安静時HRVを、測定した時刻とあわせて教えてください",
        note: "6〜7月の実測168件を測定時刻で層別した結果: 睡眠中(00-08時)70.4ms／午前57.8／午後49.5／夕夜56.4。窓によって20ms以上違い、同じ日の中のレンジも中央値46.7msある。7月は84件すべてが日中測定で起床時の値がゼロ。測定窓を固定しない限り、単発値への閾値判定は成立しない",
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
        ask: "夜、ウォッチを着けたまま寝てください（充電は入浴時などに回す）。減量ゲートの前提である睡眠が、実測では7月ゼロ夜・6月3夜しか記録されていません",
        note: "自己申告の7〜8hと、ウォッチが記録した夜の数は別物。2026-07-16に開けた減量ゲート（7h×14日連続）は、客観的な裏付けが一度も無いまま判定していた。以後は実測で追跡する",
        resolve: (D) => lastDateOf(D.recovery && D.recovery.daily, (r) => r.sleep && r.sleep.hours),
      },
      {
        id: "recovery.subjective", label: "主観コンディション", pillar: "recovery",
        cadence: "daily", graceDays: 1, required: true,
        blocks: ["judgment.code", "judgment.intensity"],
        ask: "サイトの「今朝のコンディション」で 緑／黄／赤 を選んでください（30秒で終わります）",
        note: "docs/training-protocol.md §7 が支持する Magness の3色システム。客観データと同等以上に重視する",
        resolve: (D) => merge(
          lastDateOf(D.recovery && D.recovery.daily, (r) => r.subjective && r.subjective.overall),
          lastDateOf(store() ? store().checkins() : [], (c) => c.overall)
        ),
      },
      {
        id: "body.weight", label: "体重", pillar: "body",
        cadence: "daily", graceDays: 2, required: true,
        blocks: ["body.trend", "goals.projection.factors.body"],
        ask: "毎朝・排尿後・食前・同じ体重計と服装で測った体重を、サイトの「今朝のコンディション」に入れてください",
        note: "測定条件が揃っていないと、狙う変化（週0.3〜0.4kg）より測定ノイズの方が大きくなります",
        resolve: (D) => merge(
          lastDateOf(D.body && D.body.entries, (e) => e.weightKg),
          lastDateOf(store() ? store().bodyLogs() : [], (b) => b.weightKg)
        ),
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
        ask: "練習終了の30分後に「どれくらいきつかったか」を0〜10で入れてください（筋トレはセッション画面の下部、ランはこちらに連絡を）",
        note: "ランと筋トレを同じ物差しで足し合わせる唯一の入力（Foster 2001）。心拍が欠測していても機能する。docs/strength-research.md §8-1",
        resolve: (D) => merge(
          lastDateOf(D.running && D.running.sessions, (s) => s.sRPE),
          lastDateOf(store() ? store().sessions() : [], (s) => s.sRPE)
        ),
      },

      /* ---------------------------------------------------------- 週次 */
      {
        id: "strength.session", label: "筋トレの記録", pillar: "strength",
        cadence: "weekly", graceDays: 4, required: true,
        blocks: ["strength.e1rm", "strength.weeklySets", "goals.projection.factors.durability"],
        ask: "サイトの「筋トレ」画面で、その場で 重量・回数・RIR を入れてください。入力はこの端末に保存されます",
        note: "端末内保存なので、週に一度は「データ」画面からJSONを書き出してDriveの「320」に置いてください。書き出さないと端末を変えたときに失われます",
        resolve: (D) => merge(
          lastDateOf(D.strength && D.strength.sessions, (s) => s.date),
          lastDateOf(store() ? store().sessions().filter((s) => (s.entries || []).length) : [], (s) => s.date)
        ),
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
