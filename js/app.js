/* =========================================================================
 *  health-os — app.js（ブート）
 *  --------------------------------------------------------------------------
 *  レジストリに登録された render を order 順に実行する。役割は3つだけ:
 *
 *   1. 障害の局所化
 *      各 render を try/catch で包む。1つが例外を投げても以降は実行される。
 *      （分割前の main.js の boot() は try/catch 無しで逐次呼んでいたため、
 *        1つの例外でページ全体が白紙になった。柱が6つに増える前に潰す）
 *
 *   2. 公開フラグの一括適用
 *      compute.visible(pillar) を全 render の手前で通す。
 *      config.publish.redactPillars に柱名を入れるだけでサイトから消える。
 *      ※ compute.visible は未実装（欠測検知の Issue で入る）。
 *        存在しない間は素通しする。
 *
 *   3. スクロール演出と Service Worker の起動
 *
 *  docs/architecture.md A-4 を参照。
 * ========================================================================= */

(function () {
  "use strict";

  const HOS = window.HEALTH_OS;

  function runAll() {
    if (!HOS || !HOS.render || typeof HOS.render.all !== "function") {
      console.error("[app] HEALTH_OS.render が未初期化です");
      return;
    }

    const D = HOS.data;
    const C = HOS.compute || {};
    const visible = (typeof C.visible === "function") ? C.visible : null;

    HOS.render.all().forEach((spec) => {
      /* 公開フラグ。未実装の間は素通し */
      if (visible && spec.pillar && !visible(spec.pillar)) return;

      const root = spec.mount ? document.querySelector(spec.mount) : null;
      if (spec.mount && !root) return;   // 該当セクションが無いページなら黙って飛ばす

      try {
        spec.fn(root, D, C);
      } catch (e) {
        console.error("[render:" + spec.id + "]", e);
        showError(root, spec.id);
      }
    });
  }

  /* 失敗したセクションの先頭に警告を差し込む。
   * innerHTML を置き換えるのではなく前置するのは、部分的に描画できた内容を
   * 消さないため（何がどこまで描けたかが分かる方が原因を追いやすい）。 */
  function showError(root, id) {
    if (!root) return;
    const box = document.createElement("div");
    box.className = "render-error";
    box.textContent = "このセクションの描画に失敗しました（" + id + "）。データを確認してください。";
    root.insertBefore(box, root.firstChild);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runAll);
  } else {
    runAll();
  }

  /* ------------------------------------------------ PWA: service worker */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW登録失敗:", e));
    });
  }

})();
