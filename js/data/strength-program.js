/* =========================================================================
 *  health-os / data — strength-program.js（筋トレ処方）
 *  --------------------------------------------------------------------------
 *  「週4回・ジム（バーベル＋マシン）・自宅ストレッチ」という本人の条件に対する処方。
 *
 *  設計の核（docs/strength-research.md）:
 *    §2-2  下肢の高重量は週2回で頭打ち。それ以上は走りの回復を削るだけ
 *    §3    干渉は非対称。走り→筋力には効くが、筋力→走りには効かない
 *    §4-2  高重量下肢の残存疲労は6〜48時間。重要な走練習の前日に置かない
 *    §4-4  走行量が戻るにつれ 週4→3→2 と計画的に縮退させる
 *    §8-4  固定%1RMではなく RIR で処方する。不調の日は自動的に重量が下がる
 *
 *  ★週4回のうち下肢ヘビーは2回だけ。残り2回は上肢・体幹で走行への干渉がほぼ無い。
 *    「週4回やる」と「週4回下肢を潰す」は全く違う。
 * ========================================================================= */

(function () {
  "use strict";

  const D = window.HEALTH_OS.data;

  /* ------------------------------------------------------- 導入ブロック */
  /* 経験者だが直近のトレーニング歴が不明なため、最初の4週は結合組織と
   * フォームの再適応に充てる。ここを飛ばすと腱の障害が出やすい。 */
  const BLOCKS = [
    {
      id: "reacclimation", name: "再適応", weeks: "Week 1〜4",
      intensity: "65〜75% 1RM 相当（RIR 3〜4）", reps: "8〜10回",
      goal: "フォームの再確認と結合組織の適応。重量は意図的に抑える",
      why: "経験者でもブランク後は腱・靭帯の耐性が筋力より遅れて戻る。ここで飛ばすと " +
           "アキレス腱・膝蓋腱の障害が出る。4週かけて「軽い」と感じる重量で終える",
      rirTarget: 3.5,
    },
    {
      id: "strength", name: "筋力（主ブロック）", weeks: "Week 5〜14",
      intensity: "80〜90% 1RM 相当（RIR 1〜2）", reps: "3〜6回",
      goal: "ランニングエコノミー改善の本体。神経系と筋腱剛性の適応",
      why: "Blagrove 2018 / Denadai 2017 が示す、REを改善する用量そのもの。" +
           "高重量・低回数でなければ神経筋の適応が起きず、走りに転移しない",
      rirTarget: 1.5,
    },
    {
      id: "maintain", name: "維持（レース期）", weeks: "テーパー〜レース",
      intensity: "80〜85% 1RM 相当（RIR 2〜3）", reps: "3〜5回",
      goal: "量を半減、強度は維持。疲労だけ抜いて適応を残す",
      why: "★完全に止めると獲得したRE改善を失う。強度を保ったまま量を減らすのが正解（§4-4）",
      rirTarget: 2.5,
    },
  ];

  /* ------------------------------------------------------ 週4回スプリット */
  /* A と C は必ず72時間あける（例: 火・金）。B・D は走行日と重ねてよい。 */
  const SPLIT = [
    {
      key: "A", name: "下肢ヘビー① — スクワット主", focus: "lower",
      interference: "high",
      placement: "重要な走練習の前日を避ける。Cとは72時間あける",
      why: "走効率改善の主エンジン。膝関節優位の押す力と、骨への軸圧刺激",
      items: [
        { ex: "back-squat",             role: "main",      sets: 3, reps: "4〜6",     rir: 2 },
        { ex: "bulgarian-split-squat",  role: "main",      sets: 3, reps: "8〜10/脚", rir: 2 },
        { ex: "seated-calf-raise",      role: "runner",    sets: 3, reps: "12〜15",   rir: 2 },
        { ex: "pallof-press",           role: "core",      sets: 3, reps: "10〜12/側", rir: 3 },
      ],
      estMin: 55,
    },
    {
      key: "B", name: "上肢プッシュ＋体幹", focus: "upper",
      interference: "none",
      placement: "どこでもよい。走行日と重ねて構わない",
      why: "走行への干渉がほぼ無い枠。上半身の見た目づくりと、腕振り・姿勢保持の土台",
      items: [
        { ex: "bench-press",     role: "main",      sets: 3, reps: "5〜8",   rir: 2 },
        { ex: "overhead-press",  role: "secondary", sets: 3, reps: "6〜8",   rir: 2 },
        { ex: "dip",             role: "accessory", sets: 3, reps: "8〜12",  rir: 2 },
        { ex: "side-plank",      role: "core",      sets: 2, reps: "30〜45秒/側", rir: 2 },
      ],
      estMin: 45,
    },
    {
      key: "C", name: "下肢ヘビー② — ヒンジ主", focus: "lower",
      interference: "high",
      placement: "Aから72時間あける。翌日は走らないか超イージーのみ",
      why: "後鎖（殿筋・ハム・脊柱起立筋）。ランニングの推進を担う側と、ハム傷害の予防",
      items: [
        { ex: "romanian-deadlift",   role: "main",   sets: 3, reps: "6〜8",   rir: 2 },
        { ex: "hip-thrust",          role: "main",   sets: 3, reps: "8〜10",  rir: 2 },
        { ex: "nordic-curl",         role: "runner", sets: 2, reps: "3〜5",   rir: 0,
          caution: "導入は2セット×3回から。強い筋肉痛が出る。重要な走練習の48時間前は避ける" },
        { ex: "standing-calf-raise", role: "runner", sets: 3, reps: "8〜12",  rir: 2 },
      ],
      estMin: 55,
    },
    {
      key: "D", name: "上肢プル＋ランナー補助", focus: "mixed",
      interference: "low",
      placement: "走行日と重ねてよい。片脚・体幹の質を優先する日",
      why: "引く力で姿勢を立て直し、片脚安定性と左右差の是正を行う。傷害予防の集約日",
      items: [
        { ex: "pull-up",     role: "main",      sets: 3, reps: "5〜10",   rir: 2,
          alt: "lat-pulldown" },
        { ex: "barbell-row", role: "secondary", sets: 3, reps: "8〜10",   rir: 2 },
        { ex: "face-pull",   role: "accessory", sets: 3, reps: "12〜15",  rir: 3 },
        { ex: "dead-bug",    role: "core",      sets: 3, reps: "8〜10/側", rir: 3 },
      ],
      estMin: 45,
    },
  ];

  /* ------------------------------------------------------- 自宅（毎日） */
  const HOME = {
    label: "自宅・毎日",
    note: "★静的ストレッチは走る前にやらない（Behm 2016）。走前は動的、走後・入浴後は静的。",
    preRun:  [{ ex: "dynamic-warmup" }],
    postRun: [
      { ex: "hip-flexor-stretch" },
      { ex: "ankle-dorsiflexion" },
      { ex: "thoracic-rotation" },
    ],
    estMin: 12,
  };

  /* ---------------------------------------------------- フェーズ別の縮退 */
  /* 走行量が戻るほど筋トレの頻度を落とす。サボりではなく干渉効果への対応。 */
  const PERIODIZATION = [
    { phase: "Phase 0", weeklyKm: "6〜15km",  days: 4, split: ["A", "B", "C", "D"],
      note: "走行量が最も少ない今だからこそ週4回が成立する。上肢2回は走りに干渉しない", active: true },
    { phase: "Phase 1", weeklyKm: "30〜55km", days: 3, split: ["A", "C", "B"],
      note: "上肢を1回に集約。下肢ヘビー2回は死守する（ここがREの本体）", active: false },
    { phase: "Phase 2", weeklyKm: "55〜75km", days: 2, split: ["A", "C"],
      note: "下肢2回のみ。上肢種目は各日に1つずつ混ぜて全身化する", active: false },
    { phase: "Phase 3 / テーパー", weeklyKm: "75km→減", days: 2, split: ["A", "C"],
      note: "★量を半減・強度は維持。完全に止めるとRE改善分を失う（§4-4）", active: false },
  ];

  /* ------------------------------------------------ 走りとの配置ルール */
  const TIMING_RULES = [
    { rule: "重要な走練習の前24時間に、下肢の高重量（A・C）を置かない",
      why: "筋トレ後の残存疲労は6〜48時間、後続の持久パフォーマンスとREを落とす（Doma 2017）" },
    { rule: "同日に両方やるなら 走 → 筋トレ の順",
      why: "走りの質を先に確保する。ただし現在は全ラン超イージーのため順序の制約は緩い" },
    { rule: "同日別時間なら3時間以上あける",
      why: "急性の疲労が重ならないようにする" },
    { rule: "A と C は48〜72時間あける",
      why: "同じ下肢の高重量を近づけると回復が間に合わない" },
    { rule: "HRVが2日以上連続でベースラインを外れた日は、RIRを1つ上げる（＝重量を落とす）",
      why: "単発の逸脱では介入しない。連続逸脱で初めてシグナル（training-protocol.md §4）" },
  ];

  /* -------------------------------------------- RIR → RPE → %1RM の対応 */
  /* Zourdos 2016。アプリ内の入力補助と、e1RM 換算の根拠表。 */
  const RIR_SCALE = [
    { rir: 0, rpe: 10, label: "限界。もう1回も上がらない",     pct: "100%" },
    { rir: 1, rpe: 9,  label: "あと1回だけ上げられた",         pct: "約96%" },
    { rir: 2, rpe: 8,  label: "あと2回上げられた（主目標）",   pct: "約92%", target: true },
    { rir: 3, rpe: 7,  label: "あと3回上げられた",             pct: "約89%" },
    { rir: 4, rpe: 6,  label: "あと4回以上。明らかに余裕",     pct: "約86%" },
  ];

  /* ------------------------------------------------------- 初回の立ち上げ */
  const ONBOARDING = {
    headline: "最初の1週間でやること",
    steps: [
      { n: 1, text: "A・B・C・D を1回ずつ回す。重量は「10回できる重さ」で止める",
        why: "初回は測定を兼ねる。RIR 3〜4（余裕を3〜4回残す）で全種目を1周する" },
      { n: 2, text: "各セットで 重量・回数・RIR を入力する",
        why: "RIRから推定1RM（e1RM）が出るので、1RMテストをしなくても処方が確定する（§8-4）" },
      { n: 3, text: "セッション終了30分後に、その日全体のRPE（0〜10）を1つ入力する",
        why: "★これがランと筋トレを同じ物差しで足す唯一の入力。心拍が取れない筋トレでも機能する（Foster 2001）" },
      { n: 4, text: "1週間ぶん溜まったら「書き出し」ボタンでJSONを保存し、Driveの「320」に置く",
        why: "端末内保存なので、書き出さないと端末を変えたときに消える" },
    ],
  };

  Object.assign(D, {
    strengthProgram: {
      blocks: BLOCKS,
      split: SPLIT,
      home: HOME,
      periodization: PERIODIZATION,
      timingRules: TIMING_RULES,
      rirScale: RIR_SCALE,
      onboarding: ONBOARDING,
      currentBlock: "reacclimation",
      startedAt: null,   /* 初回セッション記録時に store が埋める */
    },
  });

})();
