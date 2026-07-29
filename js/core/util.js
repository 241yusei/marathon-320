/* =========================================================================
 *  health-os / core — util.js（描画層で共有する最小ヘルパ）
 *  --------------------------------------------------------------------------
 *  js/main.js 冒頭のヘルパを HEALTH_OS.util へ移設したもの。
 *  ロジックは移設元と1文字も変えていない（docs/architecture.md A-4「意図的に
 *  共有する部分」）。移行 M0 の段階では main.js 側にも同じ定義が残っており、
 *  重複は意図的（main.js を触らずに土台だけ置くため）。M2 で main.js を
 *  render/*.js へ分解する際に、こちら側へ一本化する。
 *
 *  $            … getElementById
 *  el           … 要素生成（class / innerHTML つき）
 *  esc          … HTML エスケープ
 *  dotClass     … 状態→ドットのCSSクラス
 *  stateColor   … 状態→CSS変数の色
 *  animateCountUp … 数値のカウントアップ（prefers-reduced-motion を尊重）
 * ========================================================================= */

(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const dotClass = (s) => ({ good: "dot-good", warn: "dot-warn", bad: "dot-bad", none: "dot-none" }[s] || "dot-none");
  const stateColor = (s) => ({ good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)", none: "var(--ink-2)" }[s] || "var(--ink-2)");

  function animateCountUp(elm, targetStr, duration) {
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      elm.textContent = targetStr;
      return;
    }
    const norm = String(targetStr).replace(/−/g, "-");
    const m = norm.match(/-?\d+(\.\d+)?/);
    if (!m) { elm.textContent = targetStr; return; }
    const end = parseFloat(m[0]);
    const decimals = (m[0].split(".")[1] || "").length;
    const prefix = norm.slice(0, m.index).replace(/-/g, "−");
    const suffix = norm.slice(m.index + m[0].length);
    const t0 = performance.now();
    const dur = duration || 1100;
    function frame(now) {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      elm.textContent = prefix + (end * eased).toFixed(decimals) + suffix;
      if (p < 1) requestAnimationFrame(frame);
      else elm.textContent = targetStr;
    }
    requestAnimationFrame(frame);
  }

  window.HEALTH_OS.util = Object.assign(window.HEALTH_OS.util || {}, {
    $, el, esc, dotClass, stateColor, animateCountUp,
  });

})();
