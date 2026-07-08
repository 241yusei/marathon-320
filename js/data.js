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
    lastUpdated: "2026-07-08",
    athlete: { name: "藤井勇成", birth: "1995-10-07", age: 30, sex: "男性", height: 174 },
    phase: "Phase 0: 再点火",
    phaseWeek: "Week 4 / 4（延長中）",
    phaseGoal: "当面は週16〜18km・イージーのみ・心拍150以下・隔日配置（ACWR管理）",
    targetWeight: 65.0,
  },

  /* --------------------------------------------------------------- hero */
  hero: {
    eyebrow: "藤井勇成 × マラソン大改造計画",
    titleLines: ["限界は、", "睡眠の向こうに。"],
    sub: "PB 3:26〜3:30 から、3:19:59 へ。体重 74 → 65kg へ。\nデータに従って、壊さずに積み上げる半年間。",
    bigStats: [
      { value: "3:19:59", label: "目標タイム", note: "現 PB 3:26〜3:30" },
      { value: "−9", unit: "kg", label: "目標までの減量", note: "開始 74.0 → 65.0kg", dynamic: "weightGap" },
      { value: "4:44", unit: "/km", label: "目標レースペース", note: "サブ3:20 換算" },
      { value: "0", unit: "", label: "睡眠 7h 連続", note: "目標 14日（減量ゲート）", dynamic: "sleepStreak" },
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
    { icon: "weight",   value: "76.0", unit: "kg",  label: "体重",          state: "none", note: "6/30時点・変動範囲内（減量は未開始）", anchor: "status" },
    { icon: "hrv",      value: "39",   unit: "ms",  label: "HRV 直近",      state: "warn", note: "7/8朝・14msから回復（運動時の一時値と確認）", anchor: "trend"  },
    { icon: "heart",    value: "57",   unit: "bpm", label: "安静時心拍",    state: "warn", note: "7/5・目標55以下にやや未達",         anchor: "trend"  },
    { icon: "sleep",    value: "7+",   unit: "h",   label: "睡眠",          state: "good", note: "7/8・6日連続で7h以上を達成中",       anchor: "week"   },
    { icon: "run",      value: "約6",  unit: "km",  label: "月間走行距離",  state: "none", note: "7月累計・参考値（週前半は完全休養）", anchor: "plan"   },
    { icon: "trophy",   value: "3:26〜3:30", unit: "", label: "マラソン PB", state: "none", note: "2025-10 実績 / 目標 3:19:59",     anchor: "cta" },
  ],

  /* ------------------------------------------------ 現状サマリー（指標表）*/
  metrics: [
    { name: "体重",            value: "76.0 kg",   date: "6/30",     target: "65.0 kg（減量は未開始）",  state: "none", delta: "▲ +1.8kg", deltaState: "none" },
    { name: "VO2max（Watch）",  value: "45.6",      date: "6/21",     target: "52〜55（3:20相当）",       state: "warn" },
    { name: "HRV（直近）",      value: "39 ms",     date: "7/8",      target: "55 ms 以上（朝の安静時）", state: "warn", delta: "▲ +25ms", deltaState: "good" },
    { name: "HRV（7日平均）",   value: "約44 ms",   date: "7/8",      target: "50 ms 以上（減量ゲート）", state: "warn", delta: "▲ +2ms", deltaState: "none" },
    { name: "安静時HR（直近）",  value: "57 bpm",    date: "7/5",      target: "55 bpm 以下",              state: "warn", delta: "▲ +1bpm", deltaState: "none" },
    { name: "睡眠（直近）",      value: "7.0 h+",    date: "7/8",      target: "7〜9 h（最重要）",          state: "good", delta: "▲ +0.5h", deltaState: "good" },
    { name: "月間走行距離",     value: "約6 km",    date: "7月累計",  target: "参考値（月間累計）",        state: "none" },
    { name: "マラソン PB",      value: "3:26〜3:30",date: "2025-10",  target: "3:19:59",                  state: "none" },
  ],

  /* ------------------------------------------------------- 今週の優先事項 */
  week: {
    label: "今週の優先事項（7/8〜・睡眠6日連続達成、慎重に再開）",
    judgment: { code: "EASY", reason: "睡眠が7/3から6日連続で7h以上を達成（7/2の6hが唯一の例外）。HRVも7/8朝に39msまで回復し、7日平均約44msに。睡眠の安定がHRVの安定に効いている可能性が高い。45msの目標にわずかに届いていないため通常メニューには戻さず、計画通り超イージー2〜3km（HR135以下）から慎重に再開する。" },
    priorities: [
      { done: false, text: "睡眠7h以上の連続記録を継続する（現在6日目・目標14日）", tag: "睡眠改革（最優先・好調）", emphasis: true,
        detail: "7/2に6hで一度途切れたが7/3から6日連続を達成中。あと8日続けば減量ゲートの睡眠条件が開く。これまでで一番良い流れなので、就寝時間を崩さないことを最優先に。" },
      { done: false, text: "超イージー2〜3km・HR135以下で慎重に再開する", tag: "再開", emphasis: true,
        detail: "45msにはわずかに届いていないため、通常のイージーではなく最も抑えた強度から。違和感があれば即中止。" },
      { done: true, text: "7/7のラン中に何があったか確認 → 体調は正常、店に立ち寄りながらの気楽なジョグと判明", tag: "事実確認（完了）", emphasis: false,
        detail: "Lap4,5の異常な長さは休憩・中断ではなく寄り道によるもの。体調不良のサインではなかった。ラン自体の判断は問題なし。" },
      { done: true, text: "朝の安静時HRVを再測定・睡眠データの報告を再開 → いずれも良好", tag: "計測の空白を解消（完了）", emphasis: false,
        detail: "HRV14ms→39msへ回復。睡眠は7/3から6日連続で7h以上（7/2のみ6h）。両方とも好転を確認できた。" },
    ],
  },

  /* ------------------------------------------- 週間スケジュール（Phase 0）*/
  schedule: [
    { day: "火", menu: "完全休養（済・HRV14→39確認）", dist: "—", zone: "体調正常・回復基調を確認",     rest: true  },
    { day: "水", menu: "超イージーGO（HRV39ms確認済み）", dist: "2〜3km", zone: "HR<135・会話ペース",  rest: false },
    { day: "木", menu: "イージー（回復基調なら）",   dist: "3〜4km", zone: "HR<145・会話ペース",       rest: false },
    { day: "金", menu: "筋トレ軽め（下肢）",         dist: "—",  zone: "30分・自重〜軽負荷",          rest: false },
    { day: "土", menu: "回復していれば超イージー",   dist: "2〜3km", zone: "HR<135・完全に会話できる強度", rest: false },
    { day: "日", menu: "完全休養",                    dist: "—",  zone: "—",                       rest: true  },
    { day: "月", menu: "体調・HRV次第で判断",         dist: "—",  zone: "無理せず様子見",           rest: true  },
  ],

  /* ------------------------------------------------- 次回メニューの根拠 */
  /* データを受け取るたびに更新。「次にやる練習」のポイントとエビデンスを表示。 */
  nextWorkout: {
    day: "水 7/8",
    menu: "超イージー 2〜3km",
    points: [
      { title: "HR135以下・完全に会話できる強度で", detail: "HRVは回復基調(39ms)だが45msの目標にはまだ届いていない。通常のイージーより一段抑えた強度で身体の反応を見る。" },
      { title: "違和感や疲労感が出たら即中止", detail: "1週間ほぼ運動していない状態からの再開。距離より「異常なく終えられたか」を優先する。" },
      { title: "1回で判断せず、次のHRVも継続して確認する", detail: "39msは単発の値。数日かけて7日平均が45ms以上に安定するかを見ながら、通常メニューへ戻すペースを決める。" },
    ],
    evidence: [
      { tag: "測定タイミング", text: "HRVは運動中・直後は交感神経優位で一時的に大きく低下するのが正常な生理反応。安静時（起床後）の値が基準比較に使える（HRV測定の標準プロトコル）" },
      { tag: "HRVゲート法", text: "朝の安静時HRVが個人のベースラインに近づいたら軽い活動から再開するのが基本的な考え方（Plews et al. 2013, Sports Med）" },
      { tag: "80/20", text: "低強度中心の原則は変わらず。再開後も焦らず超イージーから積み上げる（Seiler 2010, Int J Sports Physiol Perform）" },
    ],
  },

  /* ------------------------------------------------- 直近ランの振り返り */
  /* 日次データを受け取るたびに更新。その回の「良かった点／改善点」を構造化して表示。 */
  runReview: {
    date: "7/7",
    summary: "約1週間ぶりのラン・6.01km・約1時間49分。店に立ち寄りながらの気楽なジョグ（本人確認済み）。体調は正常。",
    good: [
      "本人に確認したところ体調は「めっちゃ普通」。Lap4,5の異常な長さは中断ではなく寄り道で、ラン自体の判断は問題なし",
      "1週間の完全休養明けでも距離自体（約6km）はこなせている＝走力の土台は落ちていない",
      "気楽なペースで無理をしなかった＝結果的に良い判断",
    ],
    bad: [
      "同日のHRVが14msと6ヶ月で最低圏を大幅更新。運動中/直後の測定なら一時的な変化の可能性が高いが、朝の安静時での再確認が必要",
      "7/1〜7/5は完全休養だったにもかかわらずHRVが改善しなかった＝念のため睡眠・生活面も確認したい",
      "心拍・ゾーンデータが未取得で、実際の運動強度を検証できない",
    ],
  },

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
    { date: "6/25", hrv: "36", rhr: "56", sleep: "—", weight: "—",   run: "—",                judge: "⚠注意", note: "HRV日次約36と再低下（6/22は75）。変動大。強度は上げず様子見。RHR56" },
    { date: "6/28", hrv: "25", rhr: "—",  sleep: "—", weight: "—",   run: "6.01km @7'50\"/km", judge: "EASY", note: "夜21:39ラン。序盤4ラップ6'17〜6'38とやや速い。HRV約25と低い日。HR/ゾーン未取得(CSVのみ)。夜ラン＋低HRVに注意" },
    { date: "6/29", hrv: "—",  rhr: "—",  sleep: "—", weight: "—",   run: "4.0km @8'58\"/km",  judge: "EASY", note: "夕方18:09ラン。歩き混じりで抑えめ。HR/ゾーン未取得。HRV変動大のため当面イージー厳守＋朝ランへ移行推奨" },
    { date: "6/30", hrv: "47", rhr: "—",  sleep: "6.5",weight: "76.0",run: "4.46km @7'54\"/km", judge: "EASY", note: "夜19:15ラン（予定は休養日だった）。Z1-2 78.8%・HR回復119→110良好。HRV47msに改善(前回25から)。Lap3,5でZ3域(146/152bpm)。体重76.0は変動範囲。3回連続の夜ラン・隔日崩れに注意" },
    { date: "7/1",  hrv: "47", rhr: "59", sleep: "7.0",weight: "—",   run: "—",                judge: "REST", note: "HRV日次平均約47（5回計測）・RHR59。予定通り完全休養。睡眠7h+（本人申告）" },
    { date: "7/2",  hrv: "49", rhr: "58", sleep: "6.0",weight: "—",   run: "—",                judge: "未実施", note: "HRV日次平均約49・RHR58。予定していたイージー5kmは未実施（休養継続）。睡眠6h（本人申告）" },
    { date: "7/3",  hrv: "—",  rhr: "—",  sleep: "7.0",weight: "—",   run: "—",                judge: "REST", note: "睡眠7h+（本人申告）で連続1日目" },
    { date: "7/4",  hrv: "62", rhr: "60", sleep: "7.0",weight: "—",   run: "—",                judge: "未実施", note: "HRV日次平均約62（一見好転）・RHR60はやや高め。予定のロング6kmは未実施。走らずHRVだけ動いている点は要観察。睡眠7h+（本人申告）" },
    { date: "7/5",  hrv: "48", rhr: "57", sleep: "7.0",weight: "—",   run: "—",                judge: "REST", note: "HRV日次平均約48・RHR57。1週間近く完全休養が継続中。睡眠7h+（本人申告）" },
    { date: "7/6",  hrv: "—",  rhr: "—",  sleep: "7.0",weight: "—",   run: "—",                judge: "REST", note: "睡眠7h+（本人申告）で連続4日目" },
    { date: "7/7",  hrv: "14", rhr: "—",  sleep: "7.0",weight: "—",   run: "6.01km 約1時間49分", judge: "REST", note: "本人確認：体調は正常、店に立ち寄りながらの気楽なジョグ（Lap4,5の長さは寄り道）。HRV14msは測定タイミング次第の可能性あり。睡眠7h+（本人申告）で連続5日目" },
    { date: "7/8",  hrv: "39", rhr: "—",  sleep: "7.0",weight: "—",   run: "—",                judge: "EASY", note: "朝の安静時HRV39ms（前日14msから+25改善）。7日平均も約44msまで回復。睡眠7h+（本人申告）で連続6日目。超イージー2-3km・HR135以下でなら再開可" },
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
    { date: "6/30", dist: "4.46km", pace: "7'54\"/km", note: "Z1-2 78.8%で概ね良好だがLap3,5がZ3域・予定外の休養日実施", good: true  },
    { date: "7/7",  dist: "6.01km", pace: "推定18分/km(店に寄りながら)", note: "1週間ぶり。体調正常・気楽なジョグで店に立ち寄る。同日HRV14msは朝の再測定で確認予定", good: true },
  ],

  /* ------------------------------------------------ 7日間トレンド（チャート）*/
  /* 直近7回の日次ログを表示。HRV・RHRは未計測日を直近の実測値で補完（横ばい表示）、距離は実走行距離（休養日は0）。 */
  trends: {
    days: ["7/2", "7/3", "7/4", "7/5", "7/6", "7/7", "7/8"],
    series: {
      hrv:      { label: "HRV (ms)",     color: "var(--accent)", data: [49, 49, 62, 48, 48, 14, 39], target: 55, targetLabel: "目標 55ms" },
      rhr:      { label: "安静時HR (bpm)", color: "#ff453a",      data: [58, 58, 60, 57, 57, 57, 57], target: 55, targetLabel: "目標 55bpm", invert: true },
      sleep:    { label: "睡眠 (h)",      color: "var(--good)",  data: [6.0, 7.0, 7.0, 7.0, 7.0, 7.0, 7.0], target: 7, targetLabel: "目標 7h" },
      distance: { label: "日別距離 (km)",  color: "#0a84ff",      data: [0, 0, 0, 0, 0, 6.01, 0] },
    },
    note: "7/2に6hで一度途切れたが、7/3から6日連続で睡眠7h以上を達成中。HRVも7/7の一時的な14msから7/8に39msへ回復し、睡眠の安定と連動している可能性が高い。未計測日は直近の実測値を横ばい表示。",
  },

  /* ------------------------------------------------- 直近ランのゾーン遵守率 */
  zoneCompliance: { pct: 78.8, target: 80, date: "6/30" },

  /* ---------------------------------------------------- ゲート（未開放）*/
  gates: [
    { name: "減量開始ゲート", locked: true, progress: 6, total: 14, unit: "日",
      conditions: ["睡眠 7h 以上が 14 日連続（7/3〜7/8で6日連続！好調）", "HRV 7日平均が 50ms 以上（約44msまで回復・僅かに未達）"],
      why: "7/2に6hで一度途切れたが、7/3から6日連続で7h以上を達成中。あと8日続けば減量ゲートの睡眠条件が満たされる。HRVも7/8朝の39msで7/7の一時的な低下から回復基調（7日平均約44ms）。この2つは連動している可能性が高く、睡眠の安定がHRVの安定にもつながっている。睡眠5.5h下の減量は筋肉損失+60%（Nedeltcheva RCT）。" },
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
