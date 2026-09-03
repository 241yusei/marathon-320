/* =========================================================================
 *  marathon_plan / render — plan.js（最上部の4セクション）
 *  --------------------------------------------------------------------------
 *  2026-08-30 追加。フィットネスアプリの設計事例を踏まえた再編。
 *
 *  ・Oura … 毎朝「今日の優先レーン1つ」だけを最上部に置き、残りを従属させる
 *  ・Whoop … 数字を出して終わりにせず、行動の判断まで出す
 *  ・★Ouraの弱点として指摘されているのが「介入層の欠如」（数値は出すが
 *    何をすべきかを言わない）。だから signals には必ず action を持たせる
 *
 *  従来の構成は17セクションの1本スクロールで、「月に一度読む読み物」の並びだった。
 *  毎日開く画面としては、上から順に
 *    ① 今日ひとつ ② 今週ひとつ ③ 信号3つ ④ ロング走11本の進捗
 *  を置き、根拠・記録・監視はその下へ回す。
 * ========================================================================= */

(function () {
  "use strict";

  const D = window.MARATHON_DATA;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ------------------------------------------------ ① 今日やること（1つだけ）*/
  function renderTodayOne() {
    const el = $("todayOne"); const t = D.todayOne;
    if (!el || !t) return;
    el.innerHTML = `
      <div class="one">
        <div class="one__date">${esc(t.date)}</div>
        <h3 class="one__title">${esc(t.title)}</h3>
        <p class="one__sub">${esc(t.sub)}</p>
        <div class="one__must"><span>必ず</span>${esc(t.must)}</div>
        <p class="one__why"><b>なぜ</b> ${esc(t.why)}</p>
        ${(t.alt || []).length ? `<div class="one__alt">
          <span class="one__alt-l">選べるもの</span>
          ${t.alt.map((a) => `<span class="chip">${esc(a)}</span>`).join("")}
        </div>` : ""}
      </div>`;
  }

  /* ------------------------------------------------------ ② 今週の目標 */
  function renderWeekGoal() {
    const el = $("weekGoal"); const w = D.weekGoal;
    if (!el || !w) return;
    el.innerHTML = `
      <div class="wg">
        <div class="wg__head">
          <span class="wg__badge">${esc(w.label)}</span>
          <span class="wg__span">${esc(w.span)}</span>
          <span class="wg__theme">${esc(w.theme)}</span>
        </div>
        <div class="wg__grid">
          <div><dt>週合計の目安</dt><dd>${esc(w.volume)}</dd></div>
          <div><dt>ロング走</dt><dd>${esc(w.longRuns)}</dd></div>
          <div class="wg__wide"><dt>その他</dt><dd>${esc(w.others)}</dd></div>
        </div>
        <div class="wg__succ">
          <p class="wg__succ-l">今週の成功基準（走った距離ではありません）</p>
          <ul>${w.success.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
        </div>
        ${w.note ? `<p class="wg__note">${esc(w.note)}</p>` : ""}
      </div>`;
  }

  /* --------------------------------------------- ③ 信号3つ（介入層つき）*/
  function renderSignals() {
    const el = $("signals");
    if (!el || !D.signals) return;
    el.innerHTML = D.signals.map((s) => `
      <div class="sig sig--${esc(s.state || "none")}">
        <div class="sig__top">
          <span class="sig__name">${esc(s.name)}</span>
          <span class="sig__judge">${esc(s.judge)}</span>
        </div>
        <div class="sig__v">${esc(s.value)}<span>${esc(s.unit || "")}</span></div>
        <p class="sig__act">${esc(s.action)}</p>
      </div>`).join("");
  }

  /* ------------------------------------- ④ 現在の走行計画 ＋ 週割り */
  /* ★予定日を過ぎたのに done でない本は「未報告」として赤で出す。
   * 旧版は done:false を未来と同じ淡色で描いていたので、9/1 の 8.9km を
   * 走ったのか走っていないのか画面から読み取れなかった。
   * 計画の背骨で最も知りたいのは「どこまで来たか」であって予定表ではない。 */
  function runState(r, todayMD) {
    if (r.done) return "done";
    return md(r.date) < todayMD ? "miss" : "todo";
  }
  /* "9/1" → 901。年をまたがない8週のブロック内なので月日の比較で足りる */
  function md(s) {
    const m = String(s).match(/(\d{1,2})\/(\d{1,2})/);
    return m ? Number(m[1]) * 100 + Number(m[2]) : 0;
  }

  function renderLongRuns() {
    const el = $("longRuns");
    if (!el || !D.longRuns) return;
    const max = Math.max.apply(null, D.longRuns.map((r) => r.km));
    const now = new Date();
    const todayMD = (now.getMonth() + 1) * 100 + now.getDate();

    const states = D.longRuns.map((r) => runState(r, todayMD));
    const nextIdx = states.indexOf("todo");
    const miss = states.filter((x) => x === "miss").length;
    const done = states.filter((x) => x === "done").length;

    const LABEL = { done: "実施", miss: "未報告", next: "次" };
    el.innerHTML = `
      <div class="lr">
        ${D.longRuns.map((r, i) => {
          const st = i === nextIdx ? "next" : states[i];
          const cls = st === "done" ? "is-done" : st === "miss" ? "is-miss" : st === "next" ? "is-next" : "";
          return `
          <div class="lr__row ${cls}">
            <span class="lr__n">${r.n}</span>
            <span class="lr__d">${esc(r.date)}</span>
            <div class="lr__bar"><i style="width:${(r.km / max * 100).toFixed(1)}%"></i></div>
            <span class="lr__km">${r.km.toFixed(1)}<span>km</span></span>
            <span class="lr__gut">${r.gut > 0 ? `補給 ${r.gut}<span>g/h</span>` : "補給なし"}</span>
            <span class="lr__tag">${
              LABEL[st] ? `<span class="lr__state lr__state--${st}">${LABEL[st]}</span> ` : ""
            }${esc(r.tag || "")}</span>
          </div>`;
        }).join("")}
      </div>
      <p class="lr__foot">
        ${esc(D.longRunsNote || "走行計画は最新データ受領時に更新する。")}<br>
        <b>実施 ${done} 本</b>${miss ? ` ／ <span style="color:#e7000b">未報告 ${miss} 本</span>` : ""} ／ 残り ${D.longRuns.length - done - miss} 本。
        ${miss ? "未報告の本は、走ったかどうかが分からないという意味で、走らなかったのと同じ扱いになる。実施していれば日曜のデータ送付で拾える。" : ""}
      </p>`;

    const bl = $("blocks");
    if (bl && D.blocks) {
      bl.innerHTML = D.blocks.map((b) => `
        <div class="blk ${b.active ? "is-now" : ""}">
          <span class="blk__w">${esc(b.w)}</span>
          <span class="blk__s">${esc(b.span)}</span>
          <span class="blk__v">${esc(b.vol)}</span>
          <span class="blk__l">${esc(b.lr)}</span>
          <span class="blk__n">${esc(b.note)}</span>
        </div>`).join("");
    }
  }

  /* -------------------------------------------------- ⑤ なぜ（根拠）*/
  function renderRationale() {
    const el = $("rationale");
    if (!el || !D.rationale) return;
    el.innerHTML = D.rationale.map((r, i) => `
      <details class="rat" ${i === 0 ? "open" : ""}>
        <summary>${esc(r.q)}</summary>
        <p class="rat__a">${esc(r.a)}</p>
        <p class="rat__e"><b>根拠</b> ${esc(r.e)}</p>
      </details>`).join("");
  }

  /* ---------------------------------------------- ⑥ やらないこと */
  function renderDoNot() {
    const el = $("doNot"); const d = D.doNot;
    if (!el || !d) return;
    const col = (title, items, cls) => `
      <div class="dn__col dn__col--${cls}">
        <p class="dn__t">${esc(title)}<span>${items.length}件</span></p>
        <ul>${items.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>
      </div>`;
    el.innerHTML = col("買わない", d.buy, "buy") + col("やらない", d.stop, "stop");
  }

  /* boot。個別に try で囲み、1つ壊れても他が出るようにする */
  [renderTodayOne, renderWeekGoal, renderSignals, renderLongRuns,
   renderRationale, renderDoNot].forEach((fn) => {
    try { fn(); } catch (e) { console.error("[plan.js]", fn.name, e); }
  });

})();
