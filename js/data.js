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
    lastUpdated: "2026-06-29",
    athlete: { name: "藤井勇成", birth: "1995-10-07", age: 30, sex: "男性", height: 174 },
    phase: "Phase 0: 再点火",
    phaseWeek: "Week 4 / 4",
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
    { icon: "hrv",      value: "約54", unit: "ms",  label: "HRV 7日平均",   state: "warn", note: "変動大・直近25(6/28)で再低下",     anchor: "trend"  },
    { icon: "heart",    value: "56",   unit: "bpm", label: "安静時心拍",    state: "warn", note: "6/25・やや上昇（目標55以下）",     anchor: "trend"  },
    { icon: "sleep",    value: "6.5",  unit: "h",   label: "睡眠",          state: "warn", note: "就寝0:06に改善も計測途切れ",       anchor: "week"   },
    { icon: "run",      value: "約51", unit: "km",  label: "月間走行距離",  state: "warn", note: "6月累計・回復基調で漸増中",        anchor: "plan"   },
    { icon: "trophy",   value: "3:30", unit: "",    label: "マラソン PB",   state: "none", note: "2025-10 実績（3:26〜3:30）/ 目標 3:19:59", anchor: "cta" },
  ],

  /* ------------------------------------------------ 現状サマリー（指標表）*/
  metrics: [
    { name: "体重",            value: "74.2 kg",   date: "6/23",     target: "65.0 kg（減量は未開始）",  state: "warn" },
    { name: "VO2max（Watch）",  value: "45.6",      date: "6/21",     target: "52〜55（3:20相当）",       state: "warn" },
    { name: "HRV（直近）",      value: "約25 ms",   date: "6/28",     target: "55 ms 以上",               state: "warn" },
    { name: "HRV（7日平均）",   value: "約54 ms",   date: "6/29",     target: "50 ms 以上（減量ゲート）", state: "warn" },
    { name: "安静時HR（直近）",  value: "56 bpm",    date: "6/25",     target: "55 bpm 以下",              state: "warn" },
    { name: "睡眠（直近）",      value: "6.5 h",     date: "6/23",     target: "7〜9 h（最重要）",          state: "warn" },
    { name: "月間走行距離",     value: "約51 km",   date: "6月累計",  target: "Phase0は週16〜18km",        state: "warn" },
    { name: "マラソン PB",      value: "3:26〜3:30",date: "2025-10",  target: "3:19:59",                  state: "none" },
  ],

  /* ------------------------------------------------------- 今週の優先事項 */
  week: {
    label: "今週の優先事項（6/29週・HRV変動に注意）",
    judgment: { code: "EASY", reason: "HRVが乱高下（6/23約88→6/25約36→6/28約25）。7日平均は約54でゲートの上だが直近が低い。走り自体は継続OKだが、強度はZ2上限・量は控えめ・HRVが低い日は休む。夜ランが睡眠/HRVに響いている可能性があり朝ランへ移行を推奨。" },
    priorities: [
      { done: false, text: "イージーのみ継続。HRVが低い朝（目安35ms以下）は迷わず休養か超軽め", tag: "今週の練習", emphasis: true,
        detail: "HRVが乱高下中。6/28は序盤6'17〜6'38とまた速くなりかけ＝会話ペース厳守。低HRV日に無理をしない。" },
      { done: false, text: "ランを夜→朝に移す（6/28夜21:39・6/29夕18:09）", tag: "夜ラン是正", emphasis: true,
        detail: "就寝前の運動は交感神経を高め睡眠・HRVを下げやすい。朝〜日中に走るとHRVの戻りが安定しやすい。" },
      { done: false, text: "就寝0:00前倒しを継続し、7h睡眠の連続を積む", tag: "睡眠改革（最優先）", emphasis: true,
        detail: "6/26は就寝0:06と前進。7h×14日連続＋HRV7日平均50以上で減量ゲートが開く。睡眠の連続性が唯一の鍵。" },
      { done: false, text: "毎朝 HRV・睡眠・RHR・体重を測って報告", tag: "計測・ゲート判定", emphasis: false,
        detail: "HRVは単発でなく7日平均で判断。7日平均が50を割る日が続くなら強度を下げる。" },
    ],
  },

  /* ------------------------------------------- 週間スケジュール（Phase 0）*/
  schedule: [
    { day: "月", menu: "イージー（済・夕方4km）", dist: "4.0km",  zone: "抑えめ・歩き混じり",    rest: false },
    { day: "火", menu: "完全休養（HRV確認）",  dist: "—",      zone: "低HRVなら継続休養",      rest: true  },
    { day: "水", menu: "イージーラン（朝）",   dist: "5km",    zone: "Z2 (HR<145)・会話ペース", rest: false },
    { day: "木", menu: "完全休養",            dist: "—",      zone: "—",                    rest: true  },
    { day: "金", menu: "筋トレ軽め（下肢）",   dist: "—",      zone: "30分・自重〜軽負荷",    rest: false },
    { day: "土", menu: "イージーロング（朝）", dist: "6km",    zone: "Z1〜Z2（抑えめ）",      rest: false },
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
    { date: "6/19", hrv: "—",  rhr: "—",  sleep: "—", weight: "74.6",run: "5.0km @8'24\"/km",  judge: "⚠強度過", note: "夜ラン。前半4ラップが6'15〜6'52でテンポ化→Z3-5=33%・イージー逸脱。後半は歩き。疲労時の強度オーバー注意。ケイデンス(走行ラップ143-152)" },
    { date: "6/20", hrv: "35", rhr: "59", sleep: "—", weight: "74.6",run: "—",                judge: "REST", note: "HRV35ms=ゲート割れ(<45)・6ヶ月最低圏→即休養。RHR週平均59は改善。回復最優先に切替" },
    { date: "6/21", hrv: "—",  rhr: "—",  sleep: "—", weight: "74.0",run: "6.33km 歩+ジョグ",  judge: "EASY", note: "Z1-2が73%の理想的リカバリー。VO2max45.6初計測・HR回復39bpm改善。体重74.0。HRV未測のため強度はまだ上げない" },
    { date: "6/22", hrv: "75", rhr: "52", sleep: "7.0",weight: "—",   run: "休養（コンディション計測）", judge: "復帰OK", note: "HRV日次約75・7日平均約55でゲート通過。RHR52は目標達成。睡眠約7h（就寝0:23）で改善。イージー再開判定。明日火から4-5km再開" },
    { date: "6/23", hrv: "—",  rhr: "—",  sleep: "6.5",weight: "74.2",run: "6.05km @8'21\"/km", judge: "EASY", note: "イージー再開◎。Z1-2が84.4%・平均HR133で強度管理良好。HR回復も103→100と優秀。max174は一瞬の surge。睡眠6.5hは7h未達で連続リセット。ケイデンス(走行ラップ135-143)" },
    { date: "6/25", hrv: "36", rhr: "56", sleep: "—", weight: "—",   run: "—",                judge: "⚠注意", note: "HRV日次約36と再低下（6/23は約88）。変動大。強度は上げず様子見。RHR56" },
    { date: "6/28", hrv: "25", rhr: "—",  sleep: "—", weight: "—",   run: "6.01km @7'50\"/km", judge: "EASY", note: "夜21:39ラン。序盤4ラップ6'17〜6'38とやや速い。HRV約25と低い日。HR/ゾーン未取得(CSVのみ)。夜ラン＋低HRVに注意" },
    { date: "6/29", hrv: "—",  rhr: "—",  sleep: "—", weight: "—",   run: "4.0km @8'58\"/km",  judge: "EASY", note: "夕方18:09ラン。歩き混じりで抑えめ。HR/ゾーン未取得。HRV変動大のため当面イージー厳守＋朝ランへ移行推奨" },
  ],

  /* --------------------------------------------- 直近の走り（フォーム評価）*/
  recentRuns: [
    { date: "5/26", dist: "3.0km", pace: "6'08\"/km", note: "Z2〜Z3（少し速い）",        good: false },
    { date: "5/30", dist: "4.0km", pace: "5'40\"/km", note: "Z3（HRV低い日→速すぎ）",    good: false },
    { date: "6/4",  dist: "5.0km", pace: "7'40\"/km", note: "Z1〜Z2",                     good: true  },
    { date: "6/8",  dist: "2.0km", pace: "8'04\"/km", note: "Z1",                         good: true  },
    { date: "6/9",  dist: "6.1km", pace: "9'02\"/km", note: "Z1（体が正直・これで正解）", good: true  },
    { date: "6/16", dist: "4.54km", pace: "7'54\"/km", note: "Z2中心90.3%・強度管理◎（ケイデンス136は要改善）", good: true  },
    { date: "6/19", dist: "5.0km", pace: "8'24\"/km", note: "前半テンポ化でZ3-5=33%・イージー逸脱。HRV低下中の強度過多", good: false },
    { date: "6/21", dist: "6.33km", pace: "9'18\"/km", note: "歩き＋ジョグの理想的リカバリー。Z1-2 73%・HR136。賢明な判断", good: true  },
    { date: "6/23", dist: "6.05km", pace: "8'21\"/km", note: "イージー再開◎。Z1-2 84.4%・HR133。回復後の理想的な再開", good: true  },
    { date: "6/28", dist: "6.01km", pace: "7'50\"/km", note: "夜ラン。序盤やや速い(6'17-6'38)・HRV低い日。HR未取得", good: false },
    { date: "6/29", dist: "4.0km", pace: "8'58\"/km", note: "夕方・歩き混じりで抑えめ。HR未取得", good: true  },
  ],

  /* ------------------------------------------------ 6ヶ月トレンド（チャート）*/
  trends: {
    months:   ["12月", "1月", "2月", "3月", "4月", "5月", "6月"],
    fullMonths:["2025-12","2026-01","2026-02","2026-03","2026-04","2026-05","2026-06"],
    series: {
      hrv:      { label: "HRV (ms)",   color: "var(--accent)",  data: [61.5, 58.6, 56.6, 52.3, 55.8, 48.6, 45.2], target: 55, targetLabel: "目標 55ms" },
      rhr:      { label: "安静時HR (bpm)", color: "#ff453a",    data: [52.1, 52.7, 51.2, 57.4, 58.3, 64.0, 62.8], target: 55, targetLabel: "目標 55bpm", invert: true },
      distance: { label: "月間距離 (km)",  color: "#0a84ff",    data: [145.3, 173.3, 125.2, 44.1, 11.0, 19.0, 50.9] },
    },
    note: "練習をほぼやめた 4〜6 月も HRV は下がり続けた → 原因は練習疲労ではなく睡眠・生活ストレス。",
  },

  /* ---------------------------------------------------- ゲート（未開放）*/
  gates: [
    { name: "減量開始ゲート", locked: true, progress: 0, total: 14, unit: "日",
      conditions: ["睡眠 7h 以上が 14 日連続（未達・リセット中）", "HRV 7日平均が 50ms 以上（約54だが変動大・直近25で低下）"],
      why: "HRV7日平均は50超だが乱高下しており安定せず。残る本丸は睡眠7h×14日連続。就寝0:00前倒し＋朝ラン化で連続日数を積むのが最優先。睡眠5.5h下の減量は筋肉損失+60%（Nedeltcheva RCT）。" },
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
    { metric: "VO2max",         now: "45.6（6/21計測）", need: "52〜55 ml/kg/min",    basis: "Watch実測。3:20相当まで+7〜9" },
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
