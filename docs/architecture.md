# ヘルス/パフォーマンスOS — アーキテクチャ設計書

> 対象: `241yusei/marathon-320`（GitHub Pages、`main` 直配信、ビルドステップなし）
> 作成: 2026-07-29 ／ 起点: 全ファイル精読（`js/data.js` 353行・`js/main.js` 767行・`index.html` 352行・`css/style.css` 878行・`sw.js` 69行・`docs/` 4本・`git log` 40件）
> 方針: 「マラソン専用ダッシュボード」を6本柱＋目標管理の**ヘルス/パフォーマンスOS**へ作り替える。既存構造への遠慮はしないが、**ビルド無しで `main` から Pages 配信できる**という制約は一切崩さない。

---

## 0. 現状の正確な把握（検証済み）

### 0-1. データ層
`js/data.js` は 353 行、`window.MARATHON_DATA` に **23 個のトップレベルキー**。

```
meta / hero / race / highlights / metrics / week / schedule / nextWorkout /
runReview / dailyLog / recentRuns / trends / zoneCompliance / gates / phases /
requirements / timeSavings / projection / nutrition / zones / research / review / history
```

- `dailyLog` **41 エントリ**、`recentRuns` **23 エントリ**（実測確認済み）
- すべての数値が**文字列**（`hrv: "37"`, 欠測は `"—"`）。集計・平均・回帰が不可能で、`trends.series.*.data` は**人間が手で書き写した別配列**として二重管理
- 二重管理の破綻が data.js 内に残っている: `trends.note` の「HRVは7/24以降、RHRは7/23以降が完全欠測のため直近実測値で横ばい補完」
- `gates[].progress: 14` も `projection.factors[].score` も手入力。**唯一 JS が計算しているのは総合準備度だけ**（`main.js` に「データと描画のズレを防ぐためJS側で算出」と明記）。この直観を全体に拡張するのが本設計の核

### 0-2. 描画層
`js/main.js` は単一 IIFE に **19 個の render 関数**。`boot()` が**try/catch なし**で逐次呼ぶ（実測確認済み）。1つの例外で以降が全部止まりページが白紙になる。柱が6つになれば確実に事故る。

### 0-3. 配信・キャッシュ
`.nojekyll` あり、`.github/` **なし**。`sw.js` の `CACHE = "m320-v3"` と `CORE[]`（9ファイル）がハードコード。**JSを増やしたら `CORE` 追記と `CACHE` バージョン上げが必須**。

### 0-4. 決定的制約: ES Modules は使えない
README が「`index.html` をブラウザで開くだけ」を運用として明示。`file://` では `<script type="module">` が CORS でブロックされる。したがって分割しても **classic script + `window` 名前空間**でなければならない。

---

## A. アーキテクチャ

### A-1. 3層分離（設計の心臓部）

```
取込4系統 ─▶ js/data/     記録＝事実（append-only、人が書く）
              js/core/     派生＝計算（人は書かない）
              js/judgment/ 解釈＝コーチの所見（basis[] 必須）
              js/render/   柱ごと・レジストリ登録制
```

現行は記録・解釈・派生が同じ階層に同居し、その結果:
- `gates[].progress`（派生）を手で書き実データと乖離
- `highlights[].note`（解釈）の更新漏れで事実と矛盾
- `dailyLog[].note` に事実と所見が混在し、事実だけの再集計が不可能

3層に分ければ**事実は書き換えられず、派生は常に再計算され、解釈だけがバージョンを重ねる**。「7/18に祝った −0.6kg に実体がなかった」事故は構造的に起きなくなる。

### A-2. データモデル（6本柱＋横断＋目標）

すべて `window.HEALTH_OS` 名前空間下。classic script で読み込み順に依存しない自己登録パターン:

```js
/* js/data/_boot.js — 最初に読む */
window.HEALTH_OS = window.HEALTH_OS || { config:{}, data:{}, compute:{}, judgment:{}, render:{} };

/* 各データファイル共通 */
Object.assign(window.HEALTH_OS.data, { body: { /* ... */ } });
```

#### config（公開フラグ＝単一の切替点）

```js
Object.assign(HEALTH_OS.config, {
  schemaVersion: "2.0.0",
  publish: {
    level: "full",       // "full" | "redacted" | "private"（初期は全掲載＝オーナー決定）
    redactPillars: [],   // 例: ["labs"] で血液柱を丸ごと非表示
    redactFields: [],
  },
  athlete: { name:"藤井勇成", birth:"1995-10-07", sex:"男性", heightCm:174 },
});
```

`compute.visible(path)` を**全 render が必ず通す**。`redactPillars:["labs"]` の1行で血液柱がサイトから消える。

> ⚠️ リポジトリは public。git 履歴に入った健診数値は `publish.level` を変えても**履歴からは消えない**。将来非公開にしても「以後の新規データを出さない」ことしかできない。オーナー承知の上での決定だが明記する。

#### 柱① 体組成 `body`

```js
body: {
  protocol: {   // ★教訓(c): プロトコルを定義しないと記録を始められない
    timeOfDay: "起床直後",
    conditions: ["排尿後","飲食前","同一体重計","同一着衣"],
    device: { name:null, type:"BIA 8電極", resolutionKg:0.1 },
    smoothing: { method:"rolling-mean", windowDays:7, minPoints:4 },
    noiseBand: { weightKg:1.0, bodyFatPct:2.0 },   // この幅未満は「変化」と呼ばない
    noiseBandBasis: "本人の6/9〜7/29ログ実測レンジ73.0〜76.0kgから暫定。体組成計導入後14日連続測定の実測SDで再算出",
    calibratedAt: null,
  },
  entries: [ { date, source, quality, weightKg, bodyFatPct, leanMassKg,
               bodyWaterPct, visceralFatLevel, bmrKcal, conditionsMet, note } ],
  targets: { weightKg:{ by:"2026-10-25", realistic:71.5, stretch:65.0,
                        paceKgPerWeek:[0.3,0.4] },
             leanMassKg:{ rule:"除脂肪量の低下を許容しない" } },
  intervention: {   // ★教訓(b): 目標だけ言って介入量を決めないを禁止
    kcalTarget:[2150,2300], kcalFloor:2000, proteinG:[135,150],
    eaFloorKcalPerKgFFM:30, verificationWindowDays:21,
    startedAt:null,   // null のままゲート開放を宣言できない（validate が拒否）
  },
}
```

#### 柱② 筋トレ `strength`

```js
strength: {
  program: { blockName, daysPerWeek:2, focus:"≥80%1RM・低レップ",
             progression:"double-progression" },
  lifts: [ { id:"backsquat", name, pattern:"squat", primary:true, e1rmKg, testedAt } ],
  sessions: [ { date, source, durationMin, sRPE,   // ★横断負荷の入力
                exercises:[ { liftId, sets:[ { reps, weightKg, rpe, rir } ] } ] } ],
}
```

`e1RM` は data に持たず `compute.strength.e1rm()` が `sets[]` から推定。推定式の選定は要調査。

#### 柱③ モビリティ `mobility`

```js
mobility: {
  rationale: {   // ★この柱は「何のためにやるか」を正直に書く。傷害予防を謳わない
    claim: "静的ストレッチに傷害予防効果は確認されていない（Lauersen 2014, PMID 24100287）。" +
           "運動直前の静的は筋力を約5.4%低下（Simic 2013）。本柱の目的は" +
           "①動的W-upによるパワー準備（Behm & Chaouachi 2011: +7.3%）②可動域と左右差の検知" +
           "③運動後の主観的コンディション、に限定する。",
    source: "docs/sub3-research.md#3-6",
  },
  routines: [ { id, name, timing:"pre|post", durationMin, items[] } ],
  sessions: [ { date, routineId, durationMin, completed, sRPE } ],
  screens:  [ { date, test:"足関節背屈 knee-to-wall", leftCm, rightCm, asymmetryPct } ],
  painFlags:[ { date, site, nrs, context, followUpDates[], resolvedAt, action } ],
}
```

#### 柱④ 健診・血液 `labs`

```js
labs: {
  markerCatalog: [   // 値ではなく「読み方」を持つ
    { key:"ferritin", label:"フェリチン", unit:"ng/mL", group:"鉄",
      athleteThreshold:{ supplementBelow:30, basis:"docs/sub3-research.md#3-8" },
      athleteCaveat:"炎症・激運動後の急性期反応で偽高値になりうる【要調査: CRP併読の要否】",
      retestMonths:6, priority:"high" },
    { key:"hb", label:"ヘモグロビン",
      athleteCaveat:"持久系では血漿量増加による『スポーツ貧血（偽性貧血）』。フェリチン・網赤血球と併読しないと真の鉄欠乏と区別不能【要調査】" },
    { key:"ck", label:"CK",
      athleteCaveat:"マラソン後は約8日高値が持続（docs/training-protocol.md#5）。採血前72時間の運動歴が無いと解釈不能",
      requiresContext:["採血前72時間の運動内容"] },
    { key:"creatinine", athleteCaveat:"筋量が多いと基準上限を超えやすく腎機能低下と誤読されうる【要調査】" },
    { key:"testosterone", athleteCaveat:"睡眠5h制限で10〜15%低下（Leproult & Van Cauter 2011）。RED-Sでも低下",
      linkedTo:["body.intervention.eaFloorKcalPerKgFFM"] },
    /* 以下同形式: vitd25oh / 脂質 / HbA1c / 肝機能 / TSH / CRP / 尿検査 */
  ],
  panels: [ { date, kind, provider,
              sourceDoc:{ channel:"google-drive", fileId, fileName, type:"pdf" },
              extraction:{ method, confidence, verifiedByHuman:false, verifiedAt },
              context:{ trainingLast72h, fastingHours, timeOfDay },
              results:[ { key, value, unit, refLow, refHigh, flag } ] } ],
}
```

**`verifiedByHuman:false` の panel は compute が判断材料から除外し、サイトには「未検証」バッジ付きで表示する。** OCRは誤読しうるので、数値を根拠に何か言う前に本人の確認が要る。

#### 柱⑤ ランニング `running`

```js
running: {
  sessions: [ { date, startTime, source, type,
                planned:{ distanceKm, type },   // 計画vs実績の乖離を機械算出
                distanceKm, durationMin, avgPaceSecPerKm,
                hr:{ avg, max, source, recovery1min },   // ★null が data-health の検知対象
                zones:{ method:"hr-measured|pace-estimate", z1..z5 },
                sRPE, laps:[], quality:{ hr, gps, zones } } ],
  plan: [ { date, weekday, type, distanceKm, constraint, isPillarSession, rest } ],
  zones: [ /* 既存を移送 */ ], pb: { marathon, asOf },
}
```

#### 柱⑥ 回復・疲労 `recovery`（横断）

```js
recovery: {
  daily: [ { date,
    hrv:{ ms, lnRmssd, samples,
          window:"waking-rest|daytime-multi|post-exercise|null",   // ★測定窓を必ず記録
          device, rangeMs },
    rhr:{ bpm, source, window },
    sleep:{ hours, source, quality, bedtime, waketime },
    subjective:{ overall:"green|yellow|red", legs, motivation, soreness, stress } } ],
  /* ベースラインは持たない。compute.baseline() が直近60日から都度算出する。
     固定閾値（45ms等）を data に書けないようにするのが意図 */
}
```

**現行データからの発見**: `dailyLog` の HRV は `"~50"`（日中8回平均）と `"71"`（窓不明）が同じフィールドに混在。7/22 の「RHR 71bpm と HRV 70.9ms が同時」という矛盾は、まさに測定窓が記録されていないことが原因。

#### 目標管理 `goals`

```js
goals: {
  race: { name, date, goal:{ realistic, stretch }, ultimate },
  phases: [ /* 既存を移送 */ ],
  gates: [   // ★条件をオブジェクト化し compute が評価する（最大の変更点）
    { id:"weightloss", name:"減量開始ゲート", pillar:"body",
      conditions:[
        { metric:"recovery.sleep.hours", op:">=", value:7,
          window:{ type:"consecutive-days", n:14 },
          basis:"docs/sub3-research.md#3-8（Nedeltcheva 2010）" },
        { metric:"recovery.hrv.ms", op:">=", value:50,
          window:{ type:"rolling-mean-days", n:7 } },
      ],
      requiresIntervention:"body.intervention" },  // ★介入設計が無ければ開放を宣言できない
    { id:"phase1", conditions:[ /* 週4回×2週連続 / 週30km / 🔴週1回以下 */ ] },
    { id:"labs-baseline", name:"血液ベースライン取得ゲート",
      conditions:[ { metric:"labs.panels.verified.count", op:">=", value:1 } ],
      blocks:["nutrition.supplements.iron","nutrition.supplements.vitaminD"] },
  ],
  projection: { /* 5ファクター加重を維持、score を手入力から compute 算出へ */ },
}
```

現行の `gates[].conditions` は日本語文字列で ✅ を人が手で書き、`progress: 14` も手入力。この構造では「達成したことにする」が可能で、実際に減量ゲートは開放されたが介入は11日間ゼロだった。

#### データ在庫台帳 `streams`（欠測検知の土台）

```js
streams: [
  { id:"running.hr", label:"ランの心拍", pillar:"running",
    cadence:"per-session", graceSessions:1, required:true,
    path:"running.sessions[].hr.avg",
    blocks:["running.zones.compliance","judgment.intensity","recovery.hrRecovery"],
    ask:"ウォッチの心拍計測がOFFになっていないか確認してください" },
  /* 同形式: body.weight / recovery.hrv / subjective / sRPE /
     strength.session / body.composition / labs.panel / mobility.screen */
]
```

**これが「GPXの心拍が3週間欠測しても放置された」失敗への構造的回答**（詳細は C-3）。

### A-3. データ層の構造 — 決定と却下理由

| 案 | 判定 |
|---|---|
| ① 単一ファイル継続 | 却下 |
| **② ドメイン別分割（静的JS）** | **★採用** |
| ③ JSON + fetch() | 却下 |
| ④ Notion由来のビルド生成 | 却下（部分採用） |

```
js/
  data/   _boot.js config.js body.js strength.js mobility.js labs.js
          running.js recovery.js goals.js streams.js nutrition.js
  judgment/ current.js archive.js
  core/   util.js compute-baseline.js compute-load.js compute-gates.js
          compute-datahealth.js compute-adherence.js compute-visible.js validate.js
  render/ _registry.js today.js recovery.js running.js strength.js mobility.js
          body.js labs.js goals.js evidence.js datahealth.js chart.js spec.js
  app.js
```

**採用理由**
1. **ビルド不要・`file://` で動く。** classic script + `window` なので README の運用が完全維持される
2. **日次 diff が小さい。** 朝のHRV1つで353行のファイルが差分に載る現状 → `recovery.js` の1行だけに
3. **並行 PR が衝突しない。** 複数の実装エージェントが別の柱を同時に触る前提と整合
4. **3層分離をファイルシステムで強制できる**
5. **SW キャッシュ制御が柱単位でできる**
6. **将来ビルドを入れる余地を潰さない**（`Object.assign` の機械的パターンなのでJSON変換可能）

**代償と対処**: `index.html` の `<script>` が 9→約30本。`sw.js` の `CORE[]` 追記と `CACHE` バージョン上げが毎回必要 → **チェックリスト化した手順書＋PRテンプレートのチェック項目**で担保（ビルド無しを守るため、あえて自動化しない）。読み込み順の事故 → `_boot.js` を最初に、他は `Object.assign` で順不同。`validate.js` が boot 時にスキーマ検証。

**却下理由**
- **① 単一継続**: 6柱を載せると 1,200〜1,800行規模。「1行追記するだけ」という最大の美点を実際には壊す。ただしその本質的美点は②が完全に継承するので失うものはない
- **③ JSON + fetch**: `file://` で `fetch()` が CORS ブロックされ、README の運用が壊れる。ビルドが無いのに JSON にする消費者もいない
- **④ Notion起点ビルド**: ビルド失敗＝サイトが古いまま。API トークンを public リポジトリの Secrets に置く必要。**コーチの解釈は出典必須のPRレビュー関門を通したい**が Notion 起点だとこの関門が消える。**部分採用**: 方向を逆にし、リポジトリが真実源・Notion は片方向ミラー

#### 移行パス（Strangler Fig）— どの時点でもサイトが正常に見えること

| Step | 内容 | 検証 |
|---|---|---|
| **M0** | `_boot.js` + `config.js` + `core/util.js` 追加。`data.js` 無変更。`sw.js` を `m320-v4` へ | 見た目が1pxも変わらない |
| **M1** | `_legacy-adapter.js` 追加。`MARATHON_DATA` を `HEALTH_OS.data.*` に読み取り専用射影 | `recovery.daily.length===41` / `running.sessions.length===24` <sup>※</sup> / 元データ非破壊 / スクショmd5一致 |
| **M2** | `main.js` を `render/*.js` + `app.js` に機械的分解。**ロジック無変更**。レジストリ＋try/catch 導入 | 全セクションが従来通り（スクショ比較） |
| **M3** | 柱ごとに正方向移行（running→recovery→body）。移行済みはアダプタを**逆方向**に切替 | 移行柱が新データで描画 |
| **M4** | 新柱（strength/mobility/labs）を追加。既存に触れない | 新セクションが出る |
| **M5** | アダプタと `js/data.js` を削除 | `grep -r MARATHON_DATA` が0件 |

<sup>※</sup> 設計時は `recentRuns` の件数から 23 と見積もっていたが、実装時に数え直して **24** が正しいと判明した。
`dailyLog` の `run` 欄が「—」以外なのは 26 件、うち 4 件（6/15「ストレッチのみ」・6/22「休養（コンディション計測）」・
7/18「記録なし(週最長6km予定は未実施とみられる)」・7/29「（本日・イージー4〜5km予定）」）は走行実績ではないため
実施ランは 22 件。`recentRuns` 23 件との和集合は、`recentRuns` にのみある 5/26・5/30 が加わって 24 件になる
（`dailyLog` にのみあるのは 6/14）。

### A-4. 描画層の再編 — レジストリパターン

```js
/* js/render/_registry.js */
HEALTH_OS.render = { register(spec){ R.push(spec); }, all(){ return R.sort(byOrder); } };

/* js/app.js */
HEALTH_OS.render.all().forEach(spec => {
  if (!C.visible(spec.pillar)) return;            // ★公開フラグをここで一括適用
  const root = document.querySelector(spec.mount);
  if (!root) return;
  try { spec.fn(root, D, C); }
  catch (e) {                                      // ★1柱の失敗が全体を殺さない
    console.error(`[render:${spec.id}]`, e);
    root.innerHTML = `<div class="render-error">描画に失敗（${spec.id}）</div>`;
  }
});
```

**分割理由**: ①障害の局所化（現行は1例外でページ白紙）②公開フラグの適用点が1箇所になる ③柱ごとの独立PRが可能 ④`<section id="pillar-strength">` を置くだけで描画される宣言的な骨格に

**意図的に共有する部分**: `core/util.js`（`$`/`el`/`esc`/`dotClass`/`stateColor`/`animateCountUp`）、`render/chart.js`（現行 `drawChart` を汎用化。`chartKey` のモジュールスコープ依存を解消し複数インスタンス対応へ）、`core/icons.js`

### A-5. 新IA（3階層）

```
【L1: 今すぐ見る】
  #today   今日の統合判定（6柱を1判定に集約）
  #data    データ状態 ★新設（欠測・督促・信頼度）
  #week    今週の設計と根拠

【L2: 柱ごと】
  #load     負荷と回復（横断）  #running  ラン      #strength 筋力
  #mobility 可動性              #body     身体組成  #labs     血液・健診

【L3: 長期と根拠】
  #goals    目標（レース/ゲート/フェーズ/達成可能性）
  #evidence 根拠 ★新設（全判断→出典の逆引き表）
  #story    なぜこの計画なのか    #spec 全仕様
```

現行17アンカーは「時間軸／テーマ軸／メタ軸」が一列に混ざっており6柱で破綻する。

#### `#data`セクション — 新IAの要

```
┌────────────────────────────────────────────────┐
│  データ状態                信頼度 62% ▼前週 71% │
│  🔴 ランの心拍   22日欠測  最終 7/6             │
│     → ゾーン遵守率・強度判定・心拍回復が判断保留 │
│     → お願い: ウォッチのHR計測設定を確認         │
│  🔴 起床時HRV    6日欠測（測定窓不明）           │
│  🟡 体重         自己申告・条件不明              │
│  ⚪ 血液・健診    未取得                         │
│  🟢 睡眠         当日                            │
└────────────────────────────────────────────────┘
```

**サイトの上から2番目**に置く。欠測を「後で書く注記」ではなく「毎日目に入る一等地」に置くのが設計意図。

### A-6. 横断指標 — セッションRPE法

```
sessionLoad [AU] = sRPE (0–10) × durationMin
```

**採用理由**: ①種目非依存でラン・筋トレ・バイク・モビリティを同一スケールで合算できる。心拍ベースのTRIMPは筋トレに使えず、**そもそも本人のランHRが3週間欠測しているため心拍依存の指標は今この瞬間に機能しない** ②`docs/training-protocol.md` §7 が Magness の3色主観システムを支持しており、sRPE はその定量版 ③「同じ4kmでも疲れている日はきつい」を数値化でき、7/12 の逸脱のような距離では捉えられない事象を捉える

```js
compute.load = { session, weekly, acwr, monotony, strain, sessionCap };
```

**ACWR の扱いは既存の結論を厳守**: `docs/training-protocol.md` §3 は Impellizzeri 2020/2021 の数学的結合批判と Garmin-Runsafe 2025（n=5,205）の「週次増加率とACWRは傷害と有意に関連せず」を記録。よって **ACWRは「参考値」としてのみ表示し、閾値超過で自動的に休養判定しない**。

**一次判断基準は「1回のランは直近30日の自己最長の +30% 以内」**（Garmin-Runsafe: 110-130%でHR1.64、130-200%で1.52、200%超で2.28）。`compute.load.sessionCap()` が計画作成時に自動チェック。

**筋トレ特有の指標**: 部位別週間セット数／トップセットの%1RM（`sub3-research.md` §3-1: >80%1RMでないとRE改善なし — Llanos-Lagos 2024, PMID 38165636）／トン数

**コンカレント干渉**: `treadmill-hiit-research.md` は Wilson 2012（肥大 g=1.23→0.85、筋力 g=1.76→1.44）を引きつつ「最低3時間空ける」は**独立検証で矛盾情報があり確立した閾値と断定できない（確信度 低〜中）**と明記。よって同日ラン＋筋トレの間隔は**記録・表示するが自動警告しない**。

**HRV の運用式（固定閾値を排除）**:
```js
compute.baseline.hrv(date, windowDays=60)
  // window:"waking-rest" のサンプルのみ使用。窓が混在したら比較しない
  // lnRMSSD に変換し mean ± 0.5SD を SWC として返す
```
`intensitySignal()` は「**2日以上連続でSWC下限を割った** かつ（RHR上昇 or 睡眠悪化 or 主観が赤）」でのみシグナルを立てる。7/7 の 14ms 事件の再発を構造的に防ぐ。

---

## B. エビデンス基盤

### B-1. 調査方法の制約
WebFetch はこの環境で恒常的に403（プロキシ障害）。WebSearch は動作する。既存4文書はすべてこの制約下で書かれ、冒頭に「方法論上の注記」を持つ。**新規文書もこのフォーマットを必ず踏襲する。**

既存文書が確立した誠実さの水準（絶対に下げない）:
- 裏付けが弱い主張は「弱い」と正直に書く
- 孫引き・単一ソース依存が疑われる数値は明記
- 確信度を **高／中〜高／中／低〜中／低** の5段階で各主張に付す
- 敵対的検証を経て棄却された主張は棄却の経緯ごと残す（例: `bike-cross-training-research.md` の「Mutton 1993 の85〜95%維持は孫引きの誤伝播が濃厚」）

### B-2. 新規エビデンス文書（5本）

| 文書 | 主な調査スコープ | 根拠づける判断 |
|---|---|---|
| `strength-training-research.md` | 最大筋力トレの処方・進行則／1RM推定式の妥当性【要調査】／部位別週間セット数の用量反応【要調査】／回復時間とラン日との配置／コンカレント干渉／プライオ併用／Phase 0での導入 | `strength.program`／週内配置／e1RM式／projection の durability |
| `load-recovery-research.md` | **sRPE法の原法・妥当性**【要調査】／monotony・strain の閾値【要調査】／ACWR再訪／HRV実装式（lnRMSSD・7日平均・SWC±0.5SD・必要サンプル数・測定窓統一）／主観スケール選定【要調査】／睡眠トラッキング精度【要調査】／心拍回復 | 横断負荷の計算式／HRV閾値運用／介入シグナル条件／`#load` の全指標 |
| `body-composition-research.md` | 減量速度と除脂肪保護／EA・RED-S の計算手順／**家庭用BIAの測定誤差・再現性**【要調査・本柱の中核】／体重日内変動と必要な平滑化窓【要調査・教訓(c)への直接回答】／DXA vs BIA／減量期タンパク質 | `noiseBand`／`smoothing.windowDays`／`intervention` の摂取目標／体組成計の選定要件 |
| `blood-markers-reference.md` | 鉄・フェリチン／**スポーツ貧血（偽性貧血）**【要調査】／ビタミンD／脂質【要調査】／HbA1c【要調査】／肝機能・CK／**腎機能と筋量の誤読**【要調査】／内分泌とRED-S／炎症【要調査】／再検査間隔【要調査】 | `markerCatalog` の全内容／サプリ推奨（現行は血液データ無しで鉄・VDを掲載中→`labs-baseline` ゲートでブロック）／PDFからの値のフラグ判定 |
| `mobility-research.md` | ストレッチの効果境界の正確な整理／可動域制限と傷害の関連の証拠レベル【要調査・弱い可能性が高い】／knee-to-wall の測定手順【要調査】／フォームローラー／左右差の閾値【要調査】 | `mobility.rationale`（何を主張し何を主張しないか）／スクリーニング項目／W-up内容 |

**血液文書の必須事項**: 参照範囲は検査機関ごとに異なる。この文書は「一般参照範囲の代替」ではなく「**アスリート文脈での読み替え方**」であり、**診断ではなく異常値は医師の判断を仰ぐ**ことを冒頭に明記する。

### B-3. トレーサビリティ — 全判断に `basis[]` を必須化

```js
HEALTH_OS.judgment.week = {
  code:"GO", reason:"…",
  basis:[
    { doc:"docs/training-protocol.md", anchor:"#8-1",
      claim:"1回のランは直近30日の自己最長の+30%を超えない",
      source:"Garmin-Runsafe 2025, Br J Sports Med (n=5,205)" },
  ],
};
```

`core/validate.js` が boot 時に検査し、`basis` が空または存在しない doc を指す判断は**サイト上に赤字で「根拠未記載」と表示**。隠せない構造にすることが要点。`#evidence` は `basis[]` を全判断から収集して**逆引き表**を作る。根拠を持たない判断は表に載らないので存在が浮き上がる。

---

## C. 「能動的・厳格なコーチング」の仕様

### C-0. 主客の逆転
現行 CLAUDE.md は「データを受け取ったときの標準手順」を中心にした**受動的**文書。要求は**能動的にデータを要求するエージェント**であり、これを逆転させる。

```
CLAUDE.md
  1. ★セッション開始時の必須手順（能動チェック）   ← 新設・最上位
  2. データ要求カレンダー                          ← 新設
  3. 欠測の検知と督促（エスカレーション）           ← 新設
  4. データ受領時の標準手順（現行を継承・拡張）
  5. 厳しさの定義と実行規範                        ← 新設
  6. 全判断への出典明記ルール                      ← 新設
  7. コーチ自身の自己監査（両側チェックリスト）
docs/coaching-protocol.md  ← 詳細な判断基準を分離（CLAUDE.mdは索引に）
```

### C-1. セッション開始時の必須手順

現行の最大の欠陥は「ユーザーがデータを送ってきたとき」しか動作を定義していないこと。その結果、心拍が3週間欠測しても誰も何も言わなかった。

> **ユーザーが何を言ってきたかに関わらず、返答の前に必ず実行する。**
> 1. `streams.js` の全ストリームの最終受領日と経過を確認
> 2. `graceDays`/`graceSessions` 超過のストリームを列挙
> 3. 超過ストリームの `blocks[]` の結論を確認し、**今回のセッションで述べてはいけない**ものとして自分に課す
> 4. 「今日は何を要求すべきか」をデータ要求カレンダーから確定
> 5. **返答の冒頭で、要求と判断保留を先に述べる。** 雑談・励まし・分析より前に置く
>
> この手順を飛ばした返答は、内容が正しくても不合格とする。

### C-2. データ要求カレンダー

| 頻度 | 要求するデータ | タイミング |
|---|---|---|
| **毎日** | 起床時HRV（測定時刻つき）／安静時HR／睡眠／体重（プロトコル遵守可否）／主観3色 | 朝の最初 |
| **練習ごと** | 距離・時間・心拍・ゾーン・**sRPE（終了30分後）**／計画との乖離と理由 | 練習報告時。sRPEが無ければ必ず追加で聞く |
| **週2回** | 筋トレ（種目・重量・レップ・RPE） | 筋トレ予定日の翌朝 |
| **週1回(月)** | 週次サマリ／週最長ランの成立可否／曜日別の実行可能性の変化／体重7日平均 | 月曜の最初 |
| **月1回** | 可動域スクリーニング／体組成／VO2max | 月初 |
| **半年** | 健康診断・血液検査 | 5ヶ月で予告、6ヶ月で要求 |
| **随時** | 疼痛・違和感（NRS・部位）／体調不良・薬剤／生活の変化（勤務・シフト） | 兆候が見えたら即座に |

**実装**: 文書ではなく `compute.dataHealth()` が「今日要求すべきもの」を配列で返す。人間の記憶に依存しない。

### C-3. 欠測のエスカレーション

「心拍が3週間欠測しても放置された」の原因は3つ:
1. 欠測は**認識されていた**（優先事項に「3週間ずっと欠測」と記載あり）
2. しかし**優先度が低いまま固定**（4件中唯一の `emphasis:false`）
3. そして**欠測しているのに心拍依存の結論を出し続けた**（`zoneCompliance: { pct:88 }` — 心拍が無いのにゾーン遵守率88%を表示）

| Lv | 条件 | コーチの義務行動 | サイト |
|---|---|---|---|
| **L0** | grace内 | なし | 🟢 |
| **L1** | 〜2周期 | 次回に**具体的に依頼**（何を・どう測って・いつまでに） | 🟡 `#data` |
| **L2** | 2〜4周期 | 週の優先事項の**1件目に固定**（`emphasis:true`強制）。原因の仮説を本人に確認 | 🟠 `#today` にバッジ |
| **L3** | 4周期超 | **`blocks[]` の結論を一切述べない。** 代わりに「このデータが無いため◯◯は判断できない」と明示。関連数値をサイトから消すか「推定」ラベル強制 | 🔴 最上部バナー＋「判断保留」オーバーレイ |

**現在の心拍欠測に適用すると L3**。よって `zoneCompliance` の `pct:88` という確定的な数字は**出せなくなる**。強度判定も保留。**コーチの善意や記憶に頼らず、データ構造が結論を封じる。**

**L2 到達時に必ず原因の仮説を立てる**（テンプレート化）:
```
(a)機器の設定 (b)手順が煩雑 (c)タイミングが生活に合わない
(d)重要性が伝わっていない (e)その他
```
教訓(a)の一般化 —**未達が続いたら、まず本人ではなく設計を疑う。**

### C-4. 厳しさの定義（7つの規範）

「厳しい」を**否定的・悲観的**と取り違えない。`training-protocol.md` §8-6 は「過剰な慎重さへの歯止め」を既に定めており、反対側に振り切るのも失敗。厳しさとは**エビデンスに対して妥協しないこと**。

> **規範1: 未達を未達と言う。** 数値で示す。「惜しかった」等の緩衝表現を使わない。ただし原因の帰属は慎重に（規範5）
>
> **規範2: データが無いなら判断しない、と言う。** 推測で埋めない。L3のストリームに依存する結論は**述べないことが正しい**。「分からない」は敗北ではなく最も正確な報告
>
> **規範3: ノイズを成果と呼ばない。** `noiseBand` 未満なら「変化なし」。祝わない。実例: 7/18の「−0.6kg」はノイズ帯の内側だった
>
> **規範4: 目標は「測定プロトコル＋介入量＋検証窓」の3点セットで出す。** 「週0.5kg減らしましょう」だけは禁止。`intervention.startedAt` が null のままゲート開放を宣言することは `validate.js` が拒否する
>
> **規範5: 未達が続いたら、まず自分の設計を疑う。** 2回連続で同種の未達なら、本人の遵守を問う前に `compute.adherence.byWeekday()` で曜日別実施率を機械算出したか、実施率0の曜日に計画を置いていないかを検査。実例: 週最長ランを土曜に3週連続で置き、土曜の実施率が全期間0/7だったことに4週間気づかなかった
>
> **規範6: 自分の誤りを訂正として明示的に記録する。** 静かに書き換えない。`judgment/archive.js` に「いつ・何を・なぜ誤ったか・何が判明して訂正したか」を残しサイトにも表示。訂正履歴が見えることがコーチの信頼性の担保
>
> **規範7: 楽観と悲観のどちらにも寄らない。** 自己監査を毎回通す（C-5）

### C-5. 自己監査（両側チェックリスト）

**7-A 過剰な慎重さ（現行を継承）**: 単発1点で「即休養」と言おうとしていないか／+30%以内なのに「急増」と表現していないか／本人が「普通」と言っているのに悲観判定を続けていないか／固定値を個別ベースライン比較なしに機械適用していないか／燃え尽きパターンを過度に一般化していないか

**7-B 過剰な楽観・迎合（新設）**: 未達があるのに良かった点を先に長く書いて印象を薄めていないか／ノイズ帯内の変化を「改善」と呼んでいないか／欠測データに依存する結論を推定で埋めていないか／目標を提示したのに測定方法と介入量を決めていないか／同じ未達が2回続いているのに自分の設計を検査していないか／「頑張りましょう」で終わり次の1手が具体的でないか

**7-C 出典（新設）**: 数値主張すべてに docs の該当箇所を示せるか／示せない主張を「要調査」と明示したか／**存在しない論文・数値を書いていないか（捏造は最も重大な違反）**

---

## D. 担当割り当ての原則

| 担当 | 役割 | 判断基準 |
|---|---|---|
| **fable** | アーキ設計・エビデンス文書・コーチング判断の仕様・全PRレビュー | 「何が正しいか」を決める作業、誤りが下流に伝播する作業 |
| **opus** | 複雑な実装（データ移行・計算ロジック・横断機能・パーサ） | 既存挙動を壊さず構造を変える、非自明なアルゴリズム |
| **sonnet** | 定型実装（データ移送・CSS・繰り返しの多いrender・手順書） | 仕様が確定し判断の余地が小さい |
| **human** | 物理作業・認証・意思決定・本人しか持たない情報 | オーナー本人でなければ実行不可能 |

ラベル体系: `agent:fable|opus|sonnet|human` ／ `pillar:body|strength|mobility|labs|running|recovery|goals|cross` ／ `phase:0`〜`phase:4`

**実行方式**: Issue → ブランチ → PR → fable レビュー → main マージ。ただし**日次データ更新は現行どおり main へ直接 push**（CLAUDE.md の公開方針を維持）。スキーマ変更は必ず PR を通す。

### 着手順序の根拠
- **欠測検知（#12）を柱の実装より先に置く。** 柱を先に作るとデータが無い柱について推測で語る余地が生まれ、まさに直したい失敗を新しい柱で再生産する。「データが無い」ことを表現できる器を先に作る
- **#30(曜日確定)と#35(心拍設定)は依存ゼロで効果最大。** 現在進行形で判断を歪めているので設計と並行して今すぐ本人に投げる
- **CLAUDE.md改訂（#11）はエビデンス5本の後。** 順序を逆にすると後から根拠を探して辻褄を合わせることになる
- **旧data.js削除（#29）は最後。** どの時点でもサイトが動く保証を維持

---

## E. API / MCP / 外部サービス

### E-1. 既存接続で足りるもの
| 用途 | 接続 |
|---|---|
| Issue/PR/コード | **GitHub MCP** |
| ミラー・蓄積 | **Notion MCP**（真実源ではなく片方向ミラー） |
| 振り返りの配信 | **Google Calendar MCP** |
| **データ受信箱** ★ | **Google Drive MCP** — CSV/PDFを1フォルダに置くだけで取得。**4系統の取込のうち①③④がこの1経路に集約できる**（設計上の最大の発見） |

### E-2. 新規に必要なもの — **なし**
**この設計の実現に、新しいAPI接続や外部サービス契約は必要ない。** ビルド無しなのでCI/CD不要、静的JSなのでDB不要、取込はDrive経由で足りる。iOSのHealthKitはサーバから直接読めないため、Apple Health API との直接連携はそもそも実現不可能。

### E-3. オーナー本人の作業
認証（未認証MCPサーバの承認）／体組成計の購入／Apple Healthエクスポート設定／筋トレアプリ選定／**ウォッチの心拍設定確認 ★即実行**／**走れない曜日の確定 ★即実行**／健診結果の提供／Drive受信箱フォルダの準備／血液データ公開範囲の最終確認

### E-4. 調査環境の制約（設計に織り込み済み）
WebFetch恒常403のため、エビデンス調査は**WebSearchのみ**が前提。一次論文フルテキストへの直接アクセスは期待できず、「研究の実在・書誌情報・結果の方向性」は高確信度で取れるが「具体的な効果量」は二次情報源に収斂しがち。`bike-cross-training-research.md` が Mutton 1993 の孫引き誤伝播を検出した実例がある。**同じ厳しさを新規5文書にも適用する。数値の捏造は最も重大な違反。**

---

## 付録: 設計判断の要約

| 論点 | 決定 | 主な理由 |
|---|---|---|
| データ層 | ドメイン別の静的JS分割 | ビルド不要と `file://` 動作を守りつつ diff縮小・並行PR・3層分離を得る |
| モジュール形式 | classic script + `window`（ES Modules不採用） | `file://` で `type="module"` がCORSブロックされREADMEの運用が壊れる |
| 描画層 | 柱ごと分割＋レジストリ＋try/catch | 現行は1例外でページ白紙。公開フラグの適用点も1箇所に集約できる |
| 横断負荷 | sRPE × 時間（AU） | 種目非依存で合算でき、心拍が欠測している現状でも機能する |
| 一次の距離ルール | 単回セッション上限（直近30日最長+30%） | Garmin-Runsafe 2025 が週次%より強い予測因子と示した |
| HRV | 個別ベースライン±0.5SD × 2日連続 × 複合判断 | 固定閾値運用は原法より厳格すぎる。7/7の14ms事件で実害が出ている |
| ゲート | 条件をオブジェクト化し compute が評価 | 現行は progress を手入力でき「達成したことにする」が可能だった |
| 欠測対策 | streams台帳 + `blocks[]` + L0-L3梯子 | 認識していても優先度が上がらず依存する結論を出し続けた。**データ構造が結論を封じる**のが唯一の確実な対策 |
| 公開制御 | `config.publish` 単一切替点 + registry一括適用 | 初期は全掲載（オーナー決定）。ただし git 履歴からは消えないことを明記 |
| 移行 | Strangler Fig（M0〜M5） | どの時点でも `main` から配信されサイトが正常に見えることを保証 |
