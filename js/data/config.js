/* =========================================================================
 *  health-os / data — config.js（サイト全体の設定・公開フラグ）
 *  --------------------------------------------------------------------------
 *  docs/architecture.md A-2 の config スキーマ。schemaVersion / publish /
 *  athlete / units をここ1箇所に集約する。
 *
 *  更新手順:
 *   1. 該当キーを編集
 *   2. スキーマ自体を変える場合は schemaVersion を上げる
 *   3. ブラウザで index.html を再読み込み → 反映を確認
 * ========================================================================= */

Object.assign(window.HEALTH_OS.config, {

  schemaVersion: "2.0.0",

  /* ------------------------------------------------------------- publish
   *  ★ 公開範囲の切替は「この publish が唯一の点」。
   *     将来サイトを非公開／一部伏せる方向へ変えるときは、render 側や
   *     各データファイルを個別に書き換えるのではなく、必ずここだけを変える。
   *     compute.visible(path) が全 render の手前でこの設定を一括適用する設計。
   *
   *  ⚠️ ただし git 履歴からは消えない。
   *     このリポジトリは public で、コミットされた健診値・体組成値は
   *     publish.level を "redacted" / "private" に変えても履歴に残り続ける。
   *     切替でできるのは「以後の新規データをサイトに出さない」ことだけ。
   *     オーナー承知の上での初期値 "full"（＝全掲載）である。
   * -------------------------------------------------------------------- */
  publish: {
    level: "full",                    // "full" | "redacted" | "private"
    redactPillars: [],                // 例: ["labs"] で血液柱を丸ごと非表示
    redactFields: [],                 // 例: ["body.entries[].bodyFatPct"]
    redactedLabel: "非公開（本人のみ）",
  },

  /* athlete — age は生年月日から都度計算するので持たない（二重管理を作らない） */
  athlete: {
    name: "藤井勇成",
    birth: "1995-10-07",
    sex: "男性",
    heightCm: 174,
  },

  units: {
    mass: "kg",
    distance: "km",
    energy: "kcal",
  },

});
