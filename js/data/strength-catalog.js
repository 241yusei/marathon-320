/* =========================================================================
 *  health-os / data — strength-catalog.js（種目カタログ）
 *  --------------------------------------------------------------------------
 *  「何を・どこに効かせ・なぜランナーに要るのか・どう見て学ぶか」を1箇所に持つ。
 *
 *  解説リンクの設計方針（2026-08-06 改訂）:
 *    1) 種目ごとに YouTube へ1タップで飛ぶ（videoUrl）。これが主線。
 *       videoId があれば動画へ直行、無ければその種目に絞った検索結果へ。
 *    2) 発信者を指定して探したいとき用に、チャンネル内検索も残す（links）。
 *
 *    個別動画IDを埋めると、その動画が非公開・削除された時点で404になる。
 *    そのため videoId は「確認できたものだけ」入れる方針にしてある。
 *
 *  発信者（ユーザー指定・2026-08-06 に実在を確認）:
 *    今古賀翔【トレーニング科学】 https://www.youtube.com/c/ShoFitnessch
 *      早稲田大学大学院スポーツ科学研究科修了・EVERLIFT代表。力学と関節構造に
 *      基づくフォーム解説。BIG3の解説が特に論理的。
 *    新・バズーカ岡田チャンネル【岡田隆】 https://www.youtube.com/@bazooka_okada
 *      日本体育大学教授・柔道全日本男子体力強化部門長。解剖学と運動生理学に基づく
 *      「どの筋がどう動くか」の解説。安全性重視。
 *    VALX 山本義徳 筋トレ大学 https://www.youtube.com/@yoshinori-yamamoto
 *      生化学・栄養学・サプリメンテーションに明るい。短時間・低頻度・高強度理論。
 *    庵野拓将 https://www.rehabilimemo.com/ ・ https://note.com/rehabilimemo
 *      理学療法士・博士。『科学的に正しい筋トレ』著者。
 *      ★YouTubeチャンネルは確認できなかったため、主媒体であるブログ「リハビリmemo」
 *        とnoteのサイト内検索に繋いでいる。動画ではなく文章である点に注意。
 *
 *  根拠: docs/strength-research.md（§2 用量 / §5 傷害予防 / §8-4 RIR）
 * ========================================================================= */

(function () {
  "use strict";

  /* ------------------------------------------------------------ 発信者 */
  const COACHES = [
    {
      id: "sho",
      name: "今古賀翔",
      full: "今古賀翔【トレーニング科学】",
      medium: "youtube",
      home: "https://www.youtube.com/c/ShoFitnessch",
      search: (q) => `https://www.youtube.com/c/ShoFitnessch/search?query=${encodeURIComponent(q)}`,
      note: "早稲田大院スポーツ科学修士・EVERLIFT代表。力学と関節構造からフォームを説明する。BIG3はまずここ",
      strength: "フォームの力学的な理屈",
    },
    {
      id: "okada",
      name: "岡田隆",
      full: "新・バズーカ岡田チャンネル【岡田隆】",
      medium: "youtube",
      home: "https://www.youtube.com/@bazooka_okada",
      search: (q) => `https://www.youtube.com/@bazooka_okada/search?query=${encodeURIComponent(q)}`,
      note: "日本体育大学教授・柔道全日本男子体力強化部門長。解剖学ベースで「どの筋にどう効くか」",
      strength: "解剖学と安全な効かせ方",
    },
    {
      id: "yamamoto",
      name: "山本義徳",
      full: "VALX 山本義徳 筋トレ大学",
      medium: "youtube",
      home: "https://www.youtube.com/@yoshinori-yamamoto",
      search: (q) => `https://www.youtube.com/@yoshinori-yamamoto/search?query=${encodeURIComponent(q)}`,
      note: "生化学・栄養学に明るい。短時間・低頻度・高強度理論。セット法やサプリの判断に強い",
      strength: "強度設定と栄養・サプリ",
    },
    {
      id: "anno",
      name: "庵野拓将",
      full: "庵野拓将（リハビリmemo）",
      medium: "blog",
      home: "https://www.rehabilimemo.com/",
      search: (q) =>
        `https://www.google.com/search?q=${encodeURIComponent(
          `site:rehabilimemo.com OR site:note.com/rehabilimemo ${q}`
        )}`,
      note: "理学療法士・博士。『科学的に正しい筋トレ』著者。海外論文の分析が主。※動画ではなく文章",
      strength: "セット数・頻度・インターバルの最適解",
    },
  ];

  /* 種目に解説リンクを生やす。検索語は種目ごとに最適化する */
  function links(queries) {
    return COACHES.map((c) => ({
      id: c.id,
      name: c.name,
      medium: c.medium,
      url: c.search(queries[c.id] || queries.default),
      hint: c.strength,
    }));
  }

  /* ------------------------------------------------- 種目ごとのYouTube */
  /* ★videoId を持たせられる構造にしてある。ただし現時点では全て null。
   *  理由: この実行環境から YouTube を取得できず（403）、検索結果からも
   *  「その動画が誰の投稿か」を確認できなかった。確認できない動画IDを
   *  「今古賀翔さんの解説」として埋めるのは、検索リンクより悪い。
   *  URL を教えてもらえれば videoId に入れるだけで直リンクに切り替わる。
   *
   *  videoId が無い間は、その種目に絞った YouTube 検索結果ページへ飛ぶ。
   *  チャンネルを経由しないので「種目ごとに1タップでYouTube」は成立する。 */
  const QUERY_SUFFIX = {
    squat: "フォーム 解説", hinge: "フォーム 解説", lunge: "やり方 フォーム",
    calf: "やり方 効かせ方", push: "フォーム 解説", pull: "フォーム 解説",
    core: "やり方 正しいフォーム", plyo: "やり方 ランニング",
    mobility: "やり方 ストレッチ",
  };

  /* 「懸垂（チンニング）」「足関節背屈モビリティ（膝壁タッチ）」のような
   * 括弧書きは検索語として邪魔になるので落とす */
  const cleanName = (n) => String(n).replace(/[（(].*?[）)]/g, "").trim();

  function videoQuery(ex) {
    return ex.videoQuery || `${cleanName(ex.name)} ${QUERY_SUFFIX[ex.pattern] || "やり方"}`;
  }

  function videoUrl(ex) {
    if (!ex) return null;
    if (ex.videoId) return `https://www.youtube.com/watch?v=${ex.videoId}`;
    /* 空白は + に。YouTube の検索URLの慣用形（%20 でも動くが + が正規） */
    const q = encodeURIComponent(videoQuery(ex)).replace(/%20/g, "+");
    return `https://www.youtube.com/results?search_query=${q}`;
  }

  /* --------------------------------------------------------------- 種目 */
  /*  pattern  … squat / hinge / lunge / push / pull / carry / calf / core / plyo
   *  tier     … "primary"（高重量の主種目） | "secondary" | "accessory"
   *  runner   … ランナーにとっての意味。これが無い種目は入れない
   *  scheme   … 既定の処方（プログラム側で上書きされうる）
   *  cues     … 現場で効く3〜4点だけ。読み切れない量にしない
   */
  const EXERCISES = [

    /* ============================================================ 下肢：スクワット系 */
    {
      id: "back-squat", name: "バーベルバックスクワット", short: "BKスクワット",
      pattern: "squat", tier: "primary", equipment: "barbell",
      muscles: { primary: ["大腿四頭筋", "大殿筋"], secondary: ["ハムストリングス", "脊柱起立筋", "内転筋"] },
      runner: "走効率改善の主エンジン。高重量の軸圧は骨密度への刺激としても最重要（strength-research §5-4）",
      scheme: { sets: 3, reps: "4〜6", rir: 2, restSec: 180, tempo: "下ろす2秒・切り返しは素早く" },
      cues: [
        "バーは僧帽筋の上に乗せる。手首で支えない",
        "しゃがむ深さは「腰が丸まらない直前」まで。無理に深くしない",
        "膝は爪先と同じ方向へ。内に入るなら重量を落とす",
        "切り返しで一瞬止まらない。反動ではなく張力を保ったまま返す",
      ],
      injuryPrevention: false,
      links: links({ default: "スクワット フォーム", sho: "スクワット フォーム 解説", okada: "スクワット 効かせ方", yamamoto: "スクワット やり方", anno: "スクワット 効果" }),
    },
    {
      id: "front-squat", name: "フロントスクワット", short: "Fスクワット",
      pattern: "squat", tier: "secondary", equipment: "barbell",
      muscles: { primary: ["大腿四頭筋"], secondary: ["体幹前面", "大殿筋"] },
      runner: "腰への剪断が小さく、体幹の直立保持を要求する。バックスクワットで腰が張る日の代替",
      scheme: { sets: 3, reps: "5〜6", rir: 2, restSec: 150, tempo: "コントロールして下ろす" },
      cues: ["肘を高く保つ。肘が落ちるとバーが落ちる", "上体は垂直に近く", "手首が痛ければクロスグリップで可"],
      injuryPrevention: false,
      links: links({ default: "フロントスクワット" }),
    },
    {
      id: "bulgarian-split-squat", name: "ブルガリアンスプリットスクワット", short: "ブルガリアン",
      pattern: "lunge", tier: "primary", equipment: "dumbbell",
      muscles: { primary: ["大殿筋", "大腿四頭筋"], secondary: ["中殿筋", "ハムストリングス"] },
      runner: "★ランナー最重要級。走行は片脚動作なので、左右差の是正は片脚種目でしか起きない。中殿筋の強化は腸脛靭帯炎・膝痛の予防に直結（§5-3）",
      scheme: { sets: 3, reps: "8〜10/脚", rir: 2, restSec: 90, tempo: "下ろす2秒" },
      cues: [
        "後脚は「乗せるだけ」。体重は前脚に8〜9割",
        "前脚の脛をやや前傾させると殿筋に、垂直に保つと四頭筋に寄る",
        "骨盤を水平に保ったまま真下に沈める。支持側に落ちるなら重量を下げる",
        "弱い側から始めて、強い側は弱い側の回数に合わせる",
      ],
      injuryPrevention: true,
      links: links({ default: "ブルガリアンスクワット", anno: "スプリットスクワット 片脚" }),
    },
    {
      id: "leg-press", name: "レッグプレス", short: "レッグプレス",
      pattern: "squat", tier: "secondary", equipment: "machine",
      muscles: { primary: ["大腿四頭筋", "大殿筋"], secondary: ["ハムストリングス"] },
      runner: "体幹の疲労を避けて下肢だけに高重量を入れたい日に。走行量が多い週の代替として有効",
      scheme: { sets: 3, reps: "8〜10", rir: 2, restSec: 120 },
      cues: ["腰がシートから浮く手前で止める", "膝を完全に伸ばし切らない", "足の裏全体で押す"],
      injuryPrevention: false,
      links: links({ default: "レッグプレス" }),
    },

    /* ============================================================ 下肢：ヒンジ系 */
    {
      id: "deadlift", name: "デッドリフト", short: "デッドリフト",
      pattern: "hinge", tier: "primary", equipment: "barbell",
      muscles: { primary: ["脊柱起立筋", "大殿筋", "ハムストリングス"], secondary: ["広背筋", "僧帽筋", "前腕"] },
      runner: "後鎖（殿筋・ハム・脊柱起立筋）の総合強化。ランニングの推進は後鎖が担う。骨密度への刺激も最大級",
      scheme: { sets: 3, reps: "3〜5", rir: 2, restSec: 210, tempo: "床から素早く・戻しはコントロール" },
      cues: [
        "バーは終始すねに触れるくらい近く",
        "背中は丸めない。引く前に「胸を張って脇を締める」",
        "膝ではなく股関節から動かす",
        "疲労が大きい種目。翌日に重要な走練習を置かない（§4-2）",
      ],
      injuryPrevention: false,
      links: links({ default: "デッドリフト フォーム", sho: "デッドリフト フォーム 解説", anno: "デッドリフト 効果" }),
    },
    {
      id: "romanian-deadlift", name: "ルーマニアンデッドリフト", short: "RDL",
      pattern: "hinge", tier: "primary", equipment: "barbell",
      muscles: { primary: ["ハムストリングス", "大殿筋"], secondary: ["脊柱起立筋"] },
      runner: "ハムストリングスの伸張位での強化。通常のデッドリフトより腰の負担が軽く、走行量が多い時期の主力ヒンジに向く",
      scheme: { sets: 3, reps: "6〜8", rir: 2, restSec: 150, tempo: "下ろす3秒" },
      cues: [
        "膝は軽く曲げたまま固定。曲げ伸ばししない",
        "尻を後ろへ引く。バーは太腿を擦るように",
        "ハムが伸びきったところで止める。床まで下ろさない",
      ],
      injuryPrevention: true,
      links: links({ default: "ルーマニアンデッドリフト" }),
    },
    {
      id: "hip-thrust", name: "ヒップスラスト", short: "ヒップスラスト",
      pattern: "hinge", tier: "secondary", equipment: "barbell",
      muscles: { primary: ["大殿筋"], secondary: ["ハムストリングス"] },
      runner: "大殿筋を最も高い活動レベルで鍛えられる種目。股関節伸展はランニング推進の主動作",
      scheme: { sets: 3, reps: "8〜10", rir: 2, restSec: 120, tempo: "トップで1秒静止" },
      cues: ["顎を引いて肋骨を締める。腰を反らせない", "トップで骨盤を後傾させて殿筋を締める", "脛が垂直になる位置に足を置く"],
      injuryPrevention: false,
      links: links({ default: "ヒップスラスト" }),
    },
    {
      id: "nordic-curl", name: "ノルディックハムストリングカール", short: "ノルディック",
      pattern: "hinge", tier: "accessory", equipment: "bodyweight",
      muscles: { primary: ["ハムストリングス"], secondary: [] },
      runner: "★傷害予防の最重要種目。メタ分析でハムストリング傷害を約51%減少（van Dyk 2019, §5-1）",
      scheme: { sets: 2, reps: "3〜5", rir: 0, restSec: 120, tempo: "耐えながらゆっくり倒れる" },
      cues: [
        "★導入は週1回・2セット×3回から。強烈な筋肉痛が出るので絶対に飛ばさない",
        "耐えられる範囲まで倒れ、手をついて戻る",
        "重要な走練習の48時間前には行わない",
      ],
      videoQuery: "ノルディックハムストリングス やり方 ハムストリング 肉離れ 予防",
      injuryPrevention: true,
      links: links({ default: "ノルディックハムストリングス", anno: "ノルディックハムストリングカール 肉離れ 予防" }),
    },
    {
      id: "leg-curl", name: "レッグカール", short: "レッグカール",
      pattern: "hinge", tier: "accessory", equipment: "machine",
      muscles: { primary: ["ハムストリングス"], secondary: ["腓腹筋"] },
      runner: "ノルディックが重すぎる時期のハムストリング刺激。膝関節屈曲側から入れる",
      scheme: { sets: 3, reps: "10〜12", rir: 2, restSec: 90 },
      cues: ["骨盤を浮かせない", "戻しをゆっくり（伸張性を使う）"],
      injuryPrevention: true,
      links: links({ default: "レッグカール" }),
    },

    /* ============================================================ 下腿（ランナー必須） */
    {
      id: "standing-calf-raise", name: "スタンディングカーフレイズ", short: "立位カーフ",
      pattern: "calf", tier: "secondary", equipment: "machine",
      muscles: { primary: ["腓腹筋"], secondary: ["ヒラメ筋"] },
      runner: "膝を伸ばした状態＝腓腹筋。アキレス腱の弾性エネルギー回収に関わる",
      scheme: { sets: 3, reps: "8〜12", rir: 2, restSec: 90, tempo: "トップで1秒・下ろす3秒" },
      cues: ["可動域を最大に使う。踵を限界まで下げる", "反動を使わない", "母趾球で押す"],
      injuryPrevention: true,
      links: links({ default: "カーフレイズ" }),
    },
    {
      id: "seated-calf-raise", name: "シーテッドカーフレイズ", short: "座位カーフ",
      pattern: "calf", tier: "secondary", equipment: "machine",
      muscles: { primary: ["ヒラメ筋"], secondary: [] },
      runner: "★軽視されがちだが最重要。膝を曲げるとヒラメ筋が主役になる。ランニング中に最大の力を発生するのはヒラメ筋で、接地時に体重の6〜8倍がかかる（Dorn 2012, §5-2）。シンスプリント・アキレス腱障害の予防に直結",
      scheme: { sets: 3, reps: "12〜15", rir: 2, restSec: 75, tempo: "下ろす3秒" },
      cues: ["膝を90度に曲げて座る（この角度でヒラメ筋が主役になる）", "立位カーフの「ついで」にしない。独立した種目として扱う", "高回数で効く数少ない部位"],
      videoQuery: "シーテッドカーフレイズ ヒラメ筋 やり方",
      injuryPrevention: true,
      links: links({ default: "シーテッドカーフレイズ ヒラメ筋", anno: "ヒラメ筋 ランニング" }),
    },

    /* ============================================================ 上肢：プッシュ */
    {
      id: "bench-press", name: "ベンチプレス", short: "ベンチ",
      pattern: "push", tier: "primary", equipment: "barbell",
      muscles: { primary: ["大胸筋"], secondary: ["三角筋前部", "上腕三頭筋"] },
      runner: "走行への干渉がほぼ無い枠。上半身の見た目を作る主種目でもある",
      scheme: { sets: 3, reps: "5〜8", rir: 2, restSec: 150 },
      cues: ["肩甲骨を寄せて下げる。この土台を最後まで崩さない", "バーは乳頭〜みぞおちの間に下ろす", "肘は真横に開かず45〜60度"],
      injuryPrevention: false,
      links: links({ default: "ベンチプレス フォーム", sho: "ベンチプレス フォーム 解説" }),
    },
    {
      id: "overhead-press", name: "オーバーヘッドプレス", short: "OHP",
      pattern: "push", tier: "secondary", equipment: "barbell",
      muscles: { primary: ["三角筋"], secondary: ["上腕三頭筋", "体幹"] },
      runner: "胸郭を開き、腕振りの土台になる肩の安定性を作る。長時間走での上半身の崩れを抑える",
      scheme: { sets: 3, reps: "6〜8", rir: 2, restSec: 120 },
      cues: ["肋骨を締めて腰を反らせない", "頭をわずかに引いてバーの通り道を作る", "耳の横までしっかり押し切る"],
      injuryPrevention: false,
      links: links({ default: "オーバーヘッドプレス ショルダープレス" }),
    },
    {
      id: "dip", name: "ディップス", short: "ディップス",
      pattern: "push", tier: "accessory", equipment: "bodyweight",
      muscles: { primary: ["大胸筋下部", "上腕三頭筋"], secondary: ["三角筋前部"] },
      runner: "自重で完結する押す種目。走行への干渉ゼロ",
      scheme: { sets: 3, reps: "8〜12", rir: 2, restSec: 90 },
      cues: ["肩が痛む深さまで下ろさない", "前傾させると胸、垂直だと三頭"],
      injuryPrevention: false,
      links: links({ default: "ディップス" }),
    },

    /* ============================================================ 上肢：プル */
    {
      id: "pull-up", name: "懸垂（チンニング）", short: "懸垂",
      pattern: "pull", tier: "primary", equipment: "bodyweight",
      muscles: { primary: ["広背筋"], secondary: ["上腕二頭筋", "僧帽筋下部"] },
      runner: "背中の引く力は姿勢保持に効く。体重比の種目なので減量が進むほど伸びる（モチベーション面でも良い指標）",
      scheme: { sets: 3, reps: "5〜10", rir: 2, restSec: 150 },
      cues: ["肩をすくめず、まず肩甲骨を下げてから引く", "顎ではなく鎖骨をバーに近づける意識", "できなければアシストマシンかラットプルダウンで代替"],
      videoQuery: "懸垂 チンニング フォーム 解説",
      injuryPrevention: false,
      links: links({ default: "懸垂 チンニング フォーム" }),
    },
    {
      id: "lat-pulldown", name: "ラットプルダウン", short: "ラットプル",
      pattern: "pull", tier: "secondary", equipment: "machine",
      muscles: { primary: ["広背筋"], secondary: ["上腕二頭筋"] },
      runner: "懸垂ができない・回数が足りない場合の主力。重量を細かく刻める",
      scheme: { sets: 3, reps: "8〜12", rir: 2, restSec: 90 },
      cues: ["反動で後ろに倒れない（倒すなら15度まで）", "鎖骨に向けて引く", "戻しで肩甲骨を完全に上げきる"],
      injuryPrevention: false,
      links: links({ default: "ラットプルダウン" }),
    },
    {
      id: "barbell-row", name: "ベントオーバーロウ", short: "ロウ",
      pattern: "pull", tier: "secondary", equipment: "barbell",
      muscles: { primary: ["広背筋", "僧帽筋中部"], secondary: ["脊柱起立筋", "上腕二頭筋"] },
      runner: "水平方向の引き。猫背姿勢の是正に効き、長時間走での上体の潰れを防ぐ",
      scheme: { sets: 3, reps: "8〜10", rir: 2, restSec: 120 },
      cues: ["上体は45度前後。立ってこない", "腹に向かって引く", "腰が丸まるなら重量を落とすかチェストサポートロウへ"],
      videoQuery: "ベントオーバーロー フォーム 解説",
      injuryPrevention: false,
      links: links({ default: "ベントオーバーロー" }),
    },
    {
      id: "face-pull", name: "フェイスプル", short: "フェイスプル",
      pattern: "pull", tier: "accessory", equipment: "cable",
      muscles: { primary: ["三角筋後部", "僧帽筋中下部"], secondary: ["回旋筋腱板"] },
      runner: "肩の後面と回旋筋腱板。ベンチプレスとのバランスを取り、肩の障害を防ぐ",
      scheme: { sets: 3, reps: "12〜15", rir: 3, restSec: 60 },
      cues: ["顔の高さで肘を高く保って引く", "重量を追わない。効かせる種目"],
      injuryPrevention: true,
      links: links({ default: "フェイスプル" }),
    },

    /* ============================================================ 体幹 */
    {
      id: "plank", name: "プランク", short: "プランク",
      pattern: "core", tier: "accessory", equipment: "bodyweight",
      muscles: { primary: ["腹横筋", "腹直筋"], secondary: ["殿筋"] },
      runner: "疲労時に骨盤が落ちるのを防ぐ。ランニングの体幹は「動かす力」より「動かさない力」",
      scheme: { sets: 3, reps: "40〜60秒", rir: 2, restSec: 60 },
      cues: ["腰を反らせない・上げすぎない", "肘で床を押して肩甲骨を広げる", "時間を伸ばすより、締めた質を上げる"],
      injuryPrevention: true,
      links: links({ default: "プランク やり方" }),
    },
    {
      id: "side-plank", name: "サイドプランク", short: "サイドプランク",
      pattern: "core", tier: "accessory", equipment: "bodyweight",
      muscles: { primary: ["腹斜筋", "中殿筋"], secondary: ["腰方形筋"] },
      runner: "★片脚支持時の骨盤の落ち込み（トレンデレンブルグ）を防ぐ。腸脛靭帯炎の予防に直結",
      scheme: { sets: 2, reps: "30〜45秒/側", rir: 2, restSec: 45 },
      cues: ["体を一直線に。腰が落ちない", "左右で秒数が違うなら弱い側に合わせる"],
      injuryPrevention: true,
      links: links({ default: "サイドプランク" }),
    },
    {
      id: "pallof-press", name: "パロフプレス", short: "パロフ",
      pattern: "core", tier: "accessory", equipment: "cable",
      muscles: { primary: ["腹斜筋", "腹横筋"], secondary: [] },
      runner: "回旋に抗する力（anti-rotation）。腕振りに対して骨盤がぶれないようにする",
      scheme: { sets: 3, reps: "10〜12/側", rir: 3, restSec: 60 },
      cues: ["ケーブルに引かれても体を回さない", "腕を伸ばすほど負荷が上がる"],
      injuryPrevention: true,
      links: links({ default: "パロフプレス" }),
    },
    {
      id: "dead-bug", name: "デッドバグ", short: "デッドバグ",
      pattern: "core", tier: "accessory", equipment: "bodyweight",
      muscles: { primary: ["腹横筋"], secondary: [] },
      runner: "腰を反らせずに四肢を動かす練習。腰痛予防と、走行中の骨盤中間位の保持",
      scheme: { sets: 3, reps: "8〜10/側", rir: 3, restSec: 45 },
      cues: ["腰と床の隙間をゼロに保ったまま動かす", "隙間ができたら可動域を狭める"],
      injuryPrevention: true,
      links: links({ default: "デッドバグ" }),
    },

    /* ============================================================ プライオメトリクス */
    {
      id: "pogo-hop", name: "ポゴホップ", short: "ポゴ",
      pattern: "plyo", tier: "accessory", equipment: "bodyweight",
      muscles: { primary: ["下腿三頭筋"], secondary: ["足底"] },
      runner: "足首の剛性と接地時間の短縮。RE改善のプライオ枠（§2-1）。接地回数で管理する",
      scheme: { sets: 3, reps: "20回", rir: null, restSec: 60 },
      cues: ["膝はほぼ固定して足首だけで弾む", "接地時間を最短に。音を立てない", "週の総接地回数は60〜100回に留める"],
      videoQuery: "ポゴジャンプ プライオメトリクス ランナー",
      injuryPrevention: false,
      links: links({ default: "ポゴジャンプ プライオメトリクス" }),
    },
    {
      id: "box-jump", name: "ボックスジャンプ", short: "BOXジャンプ",
      pattern: "plyo", tier: "accessory", equipment: "box",
      muscles: { primary: ["大殿筋", "大腿四頭筋"], secondary: ["下腿三頭筋"] },
      runner: "爆発的な股関節伸展。着地は台の上で受けるので下肢への衝撃が小さい",
      scheme: { sets: 3, reps: "5回", rir: null, restSec: 90 },
      cues: ["降りるときは飛び降りず、必ず歩いて降りる", "高さを追わない。速さを追う", "疲労時はやらない（着地の失敗が怪我に直結）"],
      injuryPrevention: false,
      links: links({ default: "ボックスジャンプ" }),
    },

    /* ============================================================ 自宅：可動域・ストレッチ */
    {
      id: "ankle-dorsiflexion", name: "足関節背屈モビリティ（膝壁タッチ）", short: "足首モビ",
      pattern: "mobility", tier: "accessory", equipment: "home",
      muscles: { primary: ["下腿三頭筋", "距腿関節"], secondary: [] },
      runner: "★可動域の最優先項目。背屈が足りないと接地衝撃と膝への負担が増える。目標は壁から10cm離して膝がタッチできること（§7-2）",
      scheme: { sets: 2, reps: "10回/側", rir: null, restSec: 0 },
      cues: ["踵を床から浮かせない", "膝は爪先の方向へまっすぐ", "月1回、壁からの距離をcmで記録する"],
      videoQuery: "足首 背屈 可動域 改善 ランニング",
      injuryPrevention: true, home: true,
      links: links({ default: "足首 背屈 モビリティ ランニング" }),
    },
    {
      id: "hip-flexor-stretch", name: "腸腰筋ストレッチ（couch stretch）", short: "腸腰筋",
      pattern: "mobility", tier: "accessory", equipment: "home",
      muscles: { primary: ["腸腰筋", "大腿直筋"], secondary: [] },
      runner: "股関節伸展の制限は骨盤前傾とストライド制限を招く。デスクワークで最も硬くなる部位",
      scheme: { sets: 2, reps: "60秒/側", rir: null, restSec: 0 },
      cues: ["★静的ストレッチは走る前にやらない。運動後か入浴後に（Behm 2016, §7-1）", "骨盤を後傾させないと腸腰筋に入らない", "腰を反らせて誤魔化さない"],
      videoQuery: "腸腰筋 ストレッチ やり方",
      injuryPrevention: true, home: true,
      links: links({ default: "腸腰筋 ストレッチ" }),
    },
    {
      id: "thoracic-rotation", name: "胸椎回旋モビリティ", short: "胸椎回旋",
      pattern: "mobility", tier: "accessory", equipment: "home",
      muscles: { primary: ["胸椎"], secondary: ["広背筋"] },
      runner: "胸椎が回らないと腰と骨盤が代償する。腕振りの効率と腰痛予防",
      scheme: { sets: 2, reps: "8回/側", rir: null, restSec: 0 },
      cues: ["腰ではなく肋骨から回す", "呼吸を止めない"],
      videoQuery: "胸椎 回旋 モビリティ やり方",
      injuryPrevention: true, home: true,
      links: links({ default: "胸椎 回旋 モビリティ" }),
    },
    {
      id: "dynamic-warmup", name: "動的ウォームアップ（ラン前）", short: "動的W-up",
      pattern: "mobility", tier: "accessory", equipment: "home",
      muscles: { primary: ["全身"], secondary: [] },
      runner: "★走る前はこれ。静的ストレッチは直後の筋力・パワーを落とす（Behm 2016）。レッグスイング・ヒップサークル・ウォーキングランジで5分",
      scheme: { sets: 1, reps: "5分", rir: null, restSec: 0 },
      cues: ["前後・左右のレッグスイング各10回", "ウォーキングランジ10歩", "ヒップサークル各10回", "止めない。動かし続ける"],
      videoQuery: "ランニング前 動的ストレッチ ウォームアップ",
      injuryPrevention: true, home: true,
      links: links({ default: "ランニング 前 動的ストレッチ ウォームアップ" }),
    },
  ];

  const byId = {};
  EXERCISES.forEach((e) => { byId[e.id] = e; });

  Object.assign(window.HEALTH_OS.data, {
    coaches: COACHES,
    exercises: EXERCISES,
    exerciseById: (id) => byId[id] || null,
    exercisesByPattern: (p) => EXERCISES.filter((e) => e.pattern === p),
    videoUrl, videoQuery,
    /* videoId が入っているか（表示の出し分け用） */
    hasPinnedVideo: (ex) => !!(ex && ex.videoId),
  });

})();
