/* =========================================================================
 *  health-os / render — _registry.js（描画レジストリ）
 *  --------------------------------------------------------------------------
 *  各 render は自分を register() で登録するだけにし、実行は js/app.js が担う。
 *  これにより:
 *   ・1つの render が例外を投げても他が巻き添えにならない（app.js の try/catch）
 *   ・公開フラグ compute.visible() の適用点が app.js の1箇所に集約される
 *   ・柱ごとに独立したファイル・独立したPRで追加できる
 *
 *  spec の形:
 *    { id:"running", order:30, pillar:"running", mount:"#runs", fn(root, D, C){} }
 *      id     … ログ表示用の識別子
 *      order  … 実行順（昇順）。現行 main.js の boot() の呼び出し順を再現する
 *      pillar … 公開フラグの単位。null なら常に実行
 *      mount  … 失敗時にエラー表示を差し込む先の CSS セレクタ。null なら表示しない
 *      fn     … 実処理。(root, HEALTH_OS.data, HEALTH_OS.compute) を受ける
 * ========================================================================= */

(function () {
  "use strict";

  const specs = [];

  window.HEALTH_OS.render = Object.assign(window.HEALTH_OS.render || {}, {

    register(spec) {
      if (!spec || typeof spec.fn !== "function") {
        console.error("[render.register] fn が無い spec は登録できません", spec);
        return;
      }
      specs.push(Object.assign({ order: 999, pillar: null, mount: null }, spec));
    },

    /* order 昇順。同 order は登録順を保つ（安定ソート） */
    all() {
      return specs
        .map((s, i) => ({ s, i }))
        .sort((a, b) => (a.s.order - b.s.order) || (a.i - b.i))
        .map((x) => x.s);
    },

  });

})();
