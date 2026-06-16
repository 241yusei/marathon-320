/* =========================================================================
 *  marathon_plan / site — 単一データソース (Single Source of Truth)
 *  --------------------------------------------------------------------------
 *  このファイルがサイト全体の中身を決める。新しいデータが来たら
 *  ここを 1 行追記・更新するだけで index.html が自動で再描画される。
 *  （DASHBOARD.md と同じ「最新状態の単一情報源」の Web 版）
 *
 *  更新手順:
 *   1. meta.lastUpdated を更新
 *   2. 該当セクション（metrics / dailyLog / weekPriorities など）を編集
 *   3. ブラウザで index.html を再読み込み → 反映を確認
 * ========================================================================= */

window.MARATHON_DATA = {

  /* ---------------------------------------------------------------- meta */
  meta: {
    lastUpdated: "2026-06-16",
    athlete: { name: "藤井勇成", birth: "1995-10-07", age: 30, sex: "男性", height: 174 },
    phase: "Phase 0: 再点火",
    phaseWeek: "Week 3 / 4",
    phaseGoal: "当面は週16〜18km・イージーのみ・心拍150以下・隔日配置（ACWR管理）",
  },

  /* --------------------------------------------------------------- hero */
  hero: {
    eyebrow: "藤井勇成 × マラソン大改造計画",
    titleLines: ["限界は、", "睡眠の向こうに。"],
    sub: "PB 3:26〜3:30 から、3:19:59 へ。体重 74 → 65kg へ。\nデータに従って、壊さずに積み上げる半年間。",
    bigStats: [
      { value: "3:19:59", label: "目標タイム", note: "現 PB 3:26〜3:30" },
      { value: "−9", unit: "kg", label: "目標までの減量", note: "開始 74.0 → 65.0kg" },
      { value: "4:44", unit: "/km", label: "目標レースペース", note: "サブ3:20 換算" },
    ],
  },

  /* ----------------------------------------------------------- 目標レース */
  race: {
    name: "横浜マラソン",
    date: "2026-10-25",
    type: "A-race（本命）",
    goal: "3:22〜3:26（最大限: sub-3:20）",
    candidate: { name: "神戸マラソン", date: "2026-11-15", note: "7月当選発表後に判断" },
  },

  /* ------------------------------------------------------ ハイライト（6枚）*/
  /* Apple の Highlights カルーセル相当。最重要指標を 6 枚で見せる。       */
  highlights: [
    { icon: "weight",   value: "74.2", unit: "kg",  label: "体重",          state: "warn", note: "目標 65kg（減量は未開始＝正解）", anchor: "status" },
    { icon: "hrv",      value: "45.2", unit: "ms",  label: "HRV 月平均",    state: "bad",  note: "目標 55ms 以上・6ヶ月最低",       anchor: "trend"  },
    { icon: "heart",    value: "62.8", unit: "bpm", label: "安静時心拍",    state: "bad",  note: "目標 55bpm 以下・+10bpm",         anchor: "trend"  },
    { icon: "sleep",    value: "5.5",  unit: "h",   label: "睡眠",          state: "bad",  note: "目標 7〜9h・全問題の根本原因",    anchor: "week"   },
    { icon: "run",      value: "約24", unit: "km",  label: "週間走行距離",  state: "warn", note: "当面 16〜18km/週（ACWR管理）",     anchor: "plan"   },
    { icon: "trophy",   value: "3:30", unit: "",    label: "マラソン PB",   state: "none", note: "2025-10 実績（3:26〜3:30）/ 目標 3:19:59", anchor: "cta" },
  ],

  /* ------------------------------------------------ 現状サマリー（指標表）*/
  metrics: [
    { name: "体重",            value: "74.2 kg",   date: "6/15",     target: "65.0 kg（減量は未開始）",  state: "warn" },
    { name: "HRV（月平均）",    value: "45.2 ms",   date: "2026-06",  target: "55 ms 以上",               state: "bad"  },
    { name: "HRV（直近）",      value: "39.7 ms",   date: "6/9",      target: "—",                        state: "bad"  },
    { name: "安静時HR（月平均）",value: "62.8 bpm",  date: "2026-06",  target: "55 bpm 以下",              state: "bad"  },
    { name: "睡眠（計測月平均）",value: "5.5 h",     date: "2026-04",  target: "7〜9 h",                   state: "bad"  },
    { name: "週間走行距離",     value: "約24 km",   date: "6月累計",  target: "当面 16〜18 km/週",         state: "warn" },
    { name: "マラソン PB",      value: "3:26〜3:30",date: "2025-10",  target: "3:19:59",                  state: "none" },
  ],

  /* ------------------------------------------------------- 今週の優先事項 */
  week: {
    label: "今週の優先事項（6/15週）",
    judgment: { code: "EASY", reason: "ストレッチのみで正解。HRV・睡眠が未改善のため今週も強度ゼロ・量は控えめ＋睡眠改善を最優先。" },
    priorities: [
      { done: false, text: "23:30 スマホをリビングへ → 0:00 就寝", tag: "睡眠改革（最優先）", emphasis: true,
        detail: "全指標の root cause。7h×14日連続で減量開始ゲートが開く。HRV・RHR・走力すべての前提。" },
      { done: false, text: "今週はイージーのみ 約16km（火4.54実施→水休→木5→土6）＋ケイデンス+5%意識", tag: "今週の練習", emphasis: false,
        detail: "火に走ったため水を休養にして隔日配置を死守（ACWR 0.8〜1.3）。前週14kmからの微増。HR150上限。ケイデンス136→145目安で関節負荷を下げる。" },
      { done: false, text: "体重74.2kgは想定内 — 減量はまだ始めない", tag: "減量はまだ", emphasis: false,
        detail: "睡眠5h台での減量は筋肉損失+60%。睡眠ゲート通過まで食事制限しないのが正解。" },
      { done: false, text: "毎朝 HRV・睡眠・RHR・体重を測って報告", tag: "計測・ゲート判定", emphasis: false,
        detail: "HRV<45ms or 睡眠<5.5hの日は即休養。フレッシュな回復データが今は不足。" },
    ],
  },

  /* ------------------------------------------- 週間スケジュール（Phase 0）*/
  schedule: [
    { day: "月", menu: "ストレッチのみ（済）",  dist: "—",    zone: "リカバリー",            rest: true  },
    { day: "火", menu: "イージーラン（済）",   dist: "4.54km", zone: "Z1〜Z2 90.3%（◎）",    rest: false },
    { day: "水", menu: "完全休養",            dist: "—",      zone: "— (火に走った分・隔日)", rest: true  },
    { day: "木", menu: "イージーラン",        dist: "5km",    zone: "Z2 (HR<150)・ケイデンス+5%", rest: false },
    { day: "金", menu: "筋力トレ（軽め）",    dist: "—",      zone: "下肢中心 30〜40分",     rest: false },
    { day: "土", menu: "イージーロング",      dist: "6km",    zone: "Z1〜Z2（抑えめ）",      rest: false },
    { day: "日", menu: "完全休養",            dist: "—",      zone: "—",                    rest: true  },
  ],

  /* --------------------------------------------------------- 日次ログ */
  dailyLog: [
    { date: "6/4",  hrv: "—",  rhr: "—",  sleep: "—", weight: "—",   run: "5.0km @7'40\"/km", judge: "EASY", note: "Z1〜Z2 適切" },
    { date: "6/8",  hrv: "—",  rhr: "68", sleep: "—", weight: "—",   run: "2.0km @8'04\"/km", judge: "REST", note: "RHR 高い" },
    { date: "6/9",  hrv: "39.7",rhr:"—",  sleep: "—", weight: "74.0",run: "6.1km @9'02\"/km", judge: "REST", note: "HRV 6ヶ月最低。翌日休養指示" },
    { date: "6/10", hrv: "—",  rhr: "—",  sleep: "—", weight: "73.0",run: "—",                judge: "—",    note: "Notion 記録より" },
    { date: "6/12", hrv: "—",  rhr: "—",  sleep: "—", weight: "—",   run: "—",                judge: "—",    note: "総合分析・コーチング体制構築" },
    { date: "6/14", hrv: "—",  rhr: "—",  sleep: "—", weight: "—",   run: "5.92km 朝練",      judge: "EASY", note: "Z3-5 が 51% で強度オーバー" },
    { date: "6/15", hrv: "—",  rhr: "—",  sleep: "—", weight: "74.2",run: "ストレッチのみ",   judge: "休養", note: "月曜=完全休養で計画通り。体重は想定内（減量未開始）" },
    { date: "6/16", hrv: "—",  rhr: "—",  sleep: "—", weight: "—",   run: "4.54km @7'54\"/km", judge: "EASY", note: "Z1〜Z2が90.3%（Z2単独67%）・強度管理◎。6/14の51%→9.7%へ大改善。HR139/164。Lap3,5でペース乱れ" },
  ],

  /* --------------------------------------------- 直近の走り（フォーム評価）*/
  recentRuns: [
    { date: "5/26", dist: "3.0km", pace: "6'08\"/km", note: "Z2〜Z3（少し速い）",        good: false },
    { date: "5/30", dist: "4.0km", pace: "5'40\"/km", note: "Z3（HRV低い日→速すぎ）",    good: false },
    { date: "6/4",  dist: "5.0km", pace: "7'40\"/km", note: "Z1〜Z2",                     good: true  },
    { date: "6/8",  dist: "2.0km", pace: "8'04\"/km", note: "Z1",                         good: true  },
    { date: "6/9",  dist: "6.1km", pace: "9'02\"/km", note: "Z1（体が正直・これで正解）", good: true  },
    { date: "6/16", dist: "4.54km", pace: "7'54\"/km", note: "Z2中心90.3%・強度管理◎（ケイデンス136は要改善）", good: true  },
  ],

  /* ------------------------------------------------ 6ヶ月トレンド（チャート）*/
  trends: {
    months:   ["12月", "1月", "2月", "3月", "4月", "5月", "6月"],
    fullMonths:["2025-12","2026-01","2026-02","2026-03","2026-04","2026-05","2026-06"],
    series: {
      hrv:      { label: "HRV (ms)",   color: "var(--accent)",  data: [61.5, 58.6, 56.6, 52.3, 55.8, 48.6, 45.2], target: 55, targetLabel: "目標 55ms" },
      rhr:      { label: "安静時HR (bpm)", color: "#ff453a",    data: [52.1, 52.7, 51.2, 57.4, 58.3, 64.0, 62.8], target: 55, targetLabel: "目標 55bpm", invert: true },
      distance: { label: "月間距離 (km)",  color: "#0a84ff",    data: [145.3, 173.3, 125.2, 44.1, 11.0, 19.0, 23.5] },
    },
    note: "練習をほぼやめた 4〜6 月も HRV は下がり続けた → 原因は練習疲労ではなく睡眠・生活ストレス。",
  },

  /* ---------------------------------------------------- ゲート（未開放）*/
  gates: [
    { name: "減量開始ゲート", locked: true, progress: 0, total: 14, unit: "日",
      conditions: ["睡眠 7h 以上が 14 日連続", "HRV 7日平均が 50ms 以上に回復"],
      why: "睡眠 5.5h 下のカロリー制限は脂肪減少 −55%・筋肉損失 +60%（Nedeltcheva RCT）。通過まで減量禁止。" },
    { name: "Phase 1 移行ゲート", locked: true, progress: null, total: null, unit: "",
      conditions: ["週4回 × 2週連続", "週 30km 到達", "🔴判定が週1回以下"],
      why: "「急増→燃え尽き→停止」の再演防止。基盤が固まる前に量を増やさない。" },
  ],

  /* ------------------------------------------------ フェーズ・ロードマップ */
  phases: [
    { id: "Phase 0", name: "再点火",       weeks: "Week 1〜4",   dist: "20〜35 km", goal: "2ヶ月ブランクからの安全な再起動", active: true  },
    { id: "Phase 1", name: "基盤構築",     weeks: "Week 5〜10",  dist: "35〜55 km", goal: "走力回復・筋トレ習慣化",           active: false },
    { id: "Phase 2", name: "有酸素強化",   weeks: "Week 11〜18", dist: "55〜75 km", goal: "ロング走・有酸素能力の向上",       active: false },
    { id: "Phase 3", name: "マラソン特化", weeks: "Week 19〜24", dist: "65〜75 km", goal: "MPペース走・レース準備",           active: false },
    { id: "テーパー", name: "調整",         weeks: "レース前2〜3週", dist: "40→20 km", goal: "疲労を抜いてコンディション最適化", active: false },
  ],

  /* -------------------------------------------- 3:20切りに必要なもの */
  requirements: [
    { metric: "BMI",            now: "24.4",        need: "≈21.5（65kg）",       basis: "回帰モデル（BMI係数 +2.498分/単位）" },
    { metric: "VO2max",         now: "推定40〜43",   need: "52〜55 ml/kg/min",    basis: "予測モデル＋3:20相当値" },
    { metric: "週間走行距離",    now: "5〜13 km",     need: "50〜70 km",           basis: "週間距離＋ペースで分散の77%を説明" },
    { metric: "durability",     now: "未測定",       need: "90分走後のLT速度維持", basis: "durability研究（2025）" },
  ],

  /* ----------------------------------------------- タイム短縮の積み上げ */
  timeSavings: [
    { item: "減量 −9kg", cond: "睡眠改善後・筋肉維持", effect: "約5分" },
    { item: "カーボンシューズ", cond: "レース投入", effect: "約1〜2分" },
    { item: "走力回復＋durability強化", cond: "Phase 2〜3", effect: "数分" },
    { item: "合計", cond: "3:20切りは生理学的に射程内", effect: "6〜10分", total: true },
  ],

  /* ---------------------------------------------------------- 栄養 */
  nutrition: {
    calories: { bmr: 1751, tdee: 2889, target: "2,300〜2,500" },
    macros: [
      { name: "タンパク質", amount: "133〜148g", per: "1.8〜2.0g/kg", note: "筋肉維持・回復に最重要", pct: 23 },
      { name: "糖質",       amount: "296〜370g", per: "4〜5g/kg",     note: "練習強度に応じて調整",   pct: 52 },
      { name: "脂質",       amount: "65〜75g",   per: "—",           note: "必須脂肪酸を確保",       pct: 25 },
    ],
    supplements: [
      { name: "クレアチン",   dose: "3〜5g/日",      evidence: "強" },
      { name: "ビタミンD",    dose: "1,000〜2,000 IU/日", evidence: "強" },
      { name: "鉄分",         dose: "食事から",      evidence: "強" },
      { name: "カフェイン",   dose: "レース当日 3〜5mg/kg", evidence: "中" },
    ],
  },

  /* ------------------------------------------------- 心拍ゾーン */
  zones: [
    { z: "Z1", name: "回復",       hr: "112〜131", pace: "7:00/km〜",     purpose: "回復・脂肪代謝" },
    { z: "Z2", name: "有酸素基盤", hr: "131〜150", pace: "6:00〜7:00/km", purpose: "練習の中心", core: true },
    { z: "Z3", name: "閾値",       hr: "150〜159", pace: "5:10〜6:00/km", purpose: "テンポ・乳酸閾値" },
    { z: "Z4", name: "インターバル",hr: "159〜172", pace: "4:30〜5:10/km", purpose: "VO2max刺激" },
    { z: "Z5", name: "最大",       hr: "172〜",    pace: "〜4:30/km",     purpose: "VO2maxインターバル" },
  ],

  /* ----------------------------------------------- 最新研究ハイライト */
  research: [
    { title: "市民ランナーにポーラライズド優位なし", body: "前半VO2max刺激→後半ピラミッダルへ。4〜6週ごとに反応を実測（非応答者17.9%）。", date: "2026-06-12" },
    { title: "睡眠5h台の減量は筋肉損失 +60%", body: "脂肪減少は逆に −55%。睡眠7h×14日ゲート通過まで減量禁止（Nedeltcheva RCT）。", date: "2026-06-12" },
    { title: "durability が第4のマラソン決定因子", body: "疲労後にどれだけペースを保てるか。Phase 2以降に後半ビルドアップロング走を追加（Jones 2024）。", date: "2026-06-12" },
    { title: "ACWR 0.8〜1.3 で負荷管理", body: "週10%ルール単独より精緻。量と頻度を同時に上げない＋ラン日は隔日配置（Qin 2025）。", date: "2026-06-12" },
    { title: "HRVゲート法で悪化回避", body: "lnRMSSD 7日平均が下限を割った日は高強度禁止。本人の「急増→燃え尽き」への最適策。", date: "2026-06-12" },
    { title: "カーボンシューズ −2.75%", body: "ランニングエコノミー改善。レース投入で約1〜2分短縮。", date: "2026-06-12" },
  ],

  /* ------------------------------------------------ 強み・リスク（総括）*/
  review: {
    strengths: [
      "走力の土台は本物 — 月232km×3ヶ月・4:27/kmハーフ相当。筋メモリーで再獲得も速い。",
      "再開の仕方が正しい — 「短く・遅く」は研究的に満点。体の声に従えている。",
      "故障ゼロ — 腱・骨が無傷なのは大きな資産。",
      "目標は生理学的に現実的 — 積み上げ試算で必要短縮を充足。",
    ],
    risks: [
      "睡眠が全てのボトルネック — 必要なのはトレーニング計画ではなく睡眠計画。",
      "「急増→燃え尽き→停止」の再演リスク — 2回繰り返し済み。3回目を防ぐのが核心。",
      "テーパーとレース戦略が未習得 — 「鍛える能力」はあるが「仕上げる能力」が未開発。",
      "目標レースは横浜に確定 — 次の具体的目標がメンタル回復の最重要施策。",
    ],
  },

  /* ----------------------------------------- 履歴ハイライト（タイムライン）*/
  history: [
    { date: "2025-10", text: "マラソン PB 3:26〜3:30" },
    { date: "2025-12", text: "月間最高 232km" },
    { date: "2026-02-15", text: "京都マラソン 4:22〜4:27（テーパー失敗）→ 燃え尽き" },
    { date: "2026-05下旬", text: "自然に再開" },
    { date: "2026-06-12", text: "総合分析・コーチング体制構築" },
  ],
};
