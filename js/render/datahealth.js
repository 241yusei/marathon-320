/* =========================================================================
 *  health-os / render — datahealth.js（#data セクション）
 *  --------------------------------------------------------------------------
 *  欠測を「後で書く注記」ではなく「毎日目に入る一等地」に置く。
 *  サイトの上から2番目（hero の直後）に配置する意図的な設計。
 *
 *  docs/architecture.md A-5「#data セクション」を参照。
 * ========================================================================= */

(function () {
  "use strict";

  const HOS = window.HEALTH_OS;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  const CADENCE_JA = {
    daily: "毎日", "per-session": "練習ごと", weekly: "週1回",
    monthly: "月1回", semiannual: "半年に1回",
  };

  function overdueText(it) {
    if (it.level === "never") return "一度も受領していません";
    if (it.overdue == null) return "";
    if (it.unit === "回") {
      return it.overdue === 0 ? "最新" : `直近 ${it.overdue} 回のランで欠測`;
    }
    return it.overdue === 0 ? "本日" : `${it.overdue} 日前が最終`;
  }

  HOS.render.register({
    id: "datahealth", order: 15, pillar: null, mount: "#data",

    fn(root, D, C) {
      if (!C || typeof C.dataHealth !== "function") return;
      const r = C.dataHealth();

      const head = document.getElementById("dataHealthHead");
      const list = document.getElementById("dataHealthList");
      const foot = document.getElementById("dataHealthFoot");
      if (!head || !list) return;

      const state = r.confidence >= 80 ? "good" : r.confidence >= 55 ? "warn" : "bad";
      head.innerHTML = `
        <div class="dh-score dh-score--${state}">
          <div class="dh-score__num">${r.confidence}<span>%</span></div>
          <div class="dh-score__lbl">データ信頼度</div>
        </div>
        <p class="dh-head__note">${
          r.escalated.length
            ? `<strong>${r.escalated.length}件</strong>のデータが判断に必要な水準を下回っています。該当する結論は保留しています。`
            : "必要なデータは揃っています。"
        }</p>`;

      const row = (it) => `
        <div class="dh-row dh-row--${it.level}${it.blocking ? " is-blocking" : ""}">
          <div class="dh-row__icon">${it.icon}</div>
          <div class="dh-row__body">
            <div class="dh-row__top">
              <span class="dh-row__label">${esc(it.label)}</span>
              <span class="dh-row__cadence">${esc(CADENCE_JA[it.cadence] || it.cadence)}</span>
              ${it.required ? "" : '<span class="dh-row__opt">任意</span>'}
            </div>
            <div class="dh-row__meta">
              ${esc(overdueText(it))}${it.last ? ` ・ 最終 ${esc(it.last)}` : ""}
            </div>
            ${it.blocking && it.blocks.length ? `
              <div class="dh-row__blocks">
                <span class="dh-row__blocks-lbl">判断を保留中:</span>
                ${it.blocks.map((b) => `<code>${esc(b)}</code>`).join(" ")}
              </div>` : ""}
            ${it.level !== "ok" ? `<div class="dh-row__ask">お願い: ${esc(it.ask)}</div>` : ""}
            ${it.note && it.level !== "ok" ? `<div class="dh-row__note">${esc(it.note)}</div>` : ""}
          </div>
        </div>`;

      /* ★揃っているものは畳む。
       * 11系統ぶんを常時展開すると、毎日開く画面で3画面ぶんを占める。
       * この画面で本当に読ませたいのは「足りていない側」だけ。 */
      const need = r.items.filter((it) => it.level !== "ok");
      const ok = r.items.filter((it) => it.level === "ok");

      list.innerHTML =
        (need.length
          ? need.map(row).join("")
          : `<p class="dh-none">必要なデータは揃っています。</p>`) +
        (ok.length ? `
          <details class="dh-ok">
            <summary>揃っているデータ ${ok.length}件</summary>
            ${ok.map(row).join("")}
          </details>` : "");

      if (foot) {
        foot.textContent =
          `${r.today} 時点 ・ ${r.items.length}系統を監視 ・ ` +
          `判断保留 ${r.items.filter((i) => i.blocking).length}件`;
      }

      /* L3/never があればページ最上部にバナーを出す */
      /* ページ上部の常設バナー。
       * ★かつては欠測している系統名を全部並べた全幅の赤帯だった。
       *   だが欠測は慢性的（睡眠は1ヶ月以上未計測）で、毎日同じ赤を出し続けると
       *   警報疲れを起こし、本当に変化があった日にも気づけなくなる。
       *   常設の表示は「静かで、数が分かって、押せる」に留め、
       *   詳細は #data セクション本体に置く。 */
      const banner = document.getElementById("dataHealthBanner");
      if (banner) {
        const blk = r.items.filter((it) => it.blocking);
        banner.innerHTML = blk.length
          ? `<a class="dh-banner" href="#data">
               <span class="dh-banner__n">${blk.length}</span>
               <span class="dh-banner__t">系統のデータが不足しているため、依存する判断を保留しています</span>
               <span class="dh-banner__c">詳細</span>
             </a>`
          : "";
      }
    },
  });

})();
