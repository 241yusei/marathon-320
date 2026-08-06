/* =========================================================================
 *  health-os / render — load.js（疲労と負荷 / 朝のチェックイン / 書き出し）
 *  --------------------------------------------------------------------------
 *  #checkin … 朝の主観コンディション。客観データと同等に扱う入力
 *  #load    … ランと筋トレを合算した負荷・単調性・ACWR
 *  #vault   … 端末内データの書き出し・取り込み
 *
 *  根拠: docs/strength-research.md §8（Foster 2001 / Foster 1998 / Gabbett 2016）
 *        docs/training-protocol.md §7（主観申告を客観データと同等以上に重視する）
 * ========================================================================= */

(function () {
  "use strict";

  const HOS = window.HEALTH_OS;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function rerender(ids) {
    ids.forEach((id) => {
      const s = HOS.render.all().find((x) => x.id === id);
      if (!s) return;
      const r = s.mount ? document.querySelector(s.mount) : null;
      try { s.fn(r, HOS.data, HOS.compute); } catch (e) { console.error(e); }
    });
  }

  /* ========================================================== #checkin */
  HOS.render.register({
    id: "checkin", order: 18, pillar: "recovery", mount: "#checkin",

    fn(root, D, C) {
      const box = document.getElementById("checkinBody");
      if (!box || !HOS.store) return;

      const today = HOS.store.todayISO();
      const c = HOS.store.checkinOn(today) || {};
      const recent = HOS.store.checkins().slice(0, 14);

      const COLORS = [
        { v: "green",  label: "緑", desc: "普通〜好調。予定どおり進めてよい" },
        { v: "yellow", label: "黄", desc: "だるさや重さがある。強度を1段下げる" },
        { v: "red",    label: "赤", desc: "明らかに不調。休むか、歩く程度に留める" },
      ];

      box.innerHTML = `
        <p class="muted small">Magness の3色システム。プロコーチは主観申告を客観データと
          同等以上に重視します（docs/training-protocol.md §7）。30秒で終わります。</p>

        <form id="checkinForm" class="checkin">
          <div class="checkin__colors">
            ${COLORS.map((k) => `
              <label class="ccard ccard--${k.v} ${c.overall === k.v ? "is-on" : ""}">
                <input type="radio" name="overall" value="${k.v}" ${c.overall === k.v ? "checked" : ""}>
                <span class="ccard__l">${k.label}</span>
                <span class="ccard__d">${esc(k.desc)}</span>
              </label>`).join("")}
          </div>
          <div class="checkin__nums">
            <label>昨夜の睡眠<input type="number" step="0.25" inputmode="decimal" name="sleepH"
              value="${c.sleepH != null ? c.sleepH : ""}" placeholder="時間"></label>
            <label>筋肉痛 0〜10<input type="number" step="1" min="0" max="10" inputmode="numeric" name="soreness"
              value="${c.soreness != null ? c.soreness : ""}" placeholder="0=無し"></label>
            <label>やる気 0〜10<input type="number" step="1" min="0" max="10" inputmode="numeric" name="motivation"
              value="${c.motivation != null ? c.motivation : ""}" placeholder="0〜10"></label>
            <label>体重<input type="number" step="0.1" inputmode="decimal" name="weightKg" placeholder="kg（任意）"></label>
          </div>
          <label class="checkin__note">ひとこと
            <input type="text" name="note" value="${esc(c.note || "")}" placeholder="任意"></label>
          <button type="submit">${c.overall ? "今日の記録を更新" : "今日の記録を保存"}</button>
        </form>

        ${recent.length ? `
        <div class="streak">
          <span class="eyebrow">直近14日</span>
          <div class="streak__row">
            ${recent.slice().reverse().map((x) => `
              <span class="sq sq--${esc(x.overall || "none")}" title="${esc(x.date)}${x.sleepH ? " / 睡眠" + x.sleepH + "h" : ""}"></span>
            `).join("")}
          </div>
        </div>` : ""}`;

      const f = document.getElementById("checkinForm");
      if (f) f.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const fd = new FormData(f);
        HOS.store.saveCheckin({
          date: today,
          overall: fd.get("overall") || null,
          sleepH: fd.get("sleepH") || null,
          soreness: fd.get("soreness") || null,
          motivation: fd.get("motivation") || null,
          weightKg: fd.get("weightKg") || null,
          note: fd.get("note") || "",
        });
        rerender(["checkin", "vault"]);
      });
    },
  });

  /* ============================================================= #load */
  HOS.render.register({
    id: "load-dashboard", order: 26, pillar: "cross", mount: "#load",

    fn(root, D, C) {
      const box = document.getElementById("loadBody");
      if (!box || !C.loadReport) return;

      const r = C.loadReport();
      const w = r.week, a = r.acwr;
      const max = Math.max(1, ...r.daily.map((d) => d.load));

      const monoState = w && w.monotony != null
        ? (w.monotony >= 2.0 ? "bad" : w.monotony >= 1.6 ? "warn" : "good") : "none";
      const acwrReady = a && !a.insufficient;
      const acwrState = acwrReady
        ? ({ ok: "good", low: "warn", high: "warn", spike: "bad" }[a.zone]) : "none";

      box.innerHTML = `
        <p class="muted small">ランの心拍と筋トレの重量は足せません。両方に同じ形で使える指標は
          <b>セッションRPE × 時間</b> だけです（Foster 2001）。この画面はその1つの単位で
          6週間ぶんを積み上げています。</p>

        <div class="kpis">
          <div class="kpi">
            <div class="kpi__n">${w ? w.total.toLocaleString() : "—"}<span>AU</span></div>
            <div class="kpi__l">今週の総負荷</div>
            <div class="kpi__d ${r.delta > 0 ? "up" : r.delta < 0 ? "down" : ""}">${
              r.delta == null ? "前週データなし" : `前週比 ${r.delta > 0 ? "+" : ""}${r.delta}%`}</div>
          </div>
          <div class="kpi kpi--${monoState}">
            <div class="kpi__n">${w && w.monotony != null ? w.monotony : "—"}</div>
            <div class="kpi__l">単調性 monotony</div>
            <div class="kpi__d">${w && !w.monotonyReady ? "記録3日ぶんで算出開始" : "目安 2.0未満"}</div>
          </div>
          <div class="kpi kpi--${acwrState}">
            <div class="kpi__n">${acwrReady ? a.ratio : "—"}</div>
            <div class="kpi__l">急性:慢性負荷比</div>
            <div class="kpi__d">${acwrReady ? "目安 0.8〜1.3（警報のみ）" : "慢性負荷の土台ができてから"}</div>
          </div>
          <div class="kpi">
            <div class="kpi__n">${w ? w.restDays : "—"}<span>日</span></div>
            <div class="kpi__l">今週の完全休養日</div>
            <div class="kpi__d">週1〜2日が目安</div>
          </div>
        </div>

        <div class="loadchart">
          <div class="loadchart__head">
            <span class="eyebrow">日別の負荷（28日・積み上げ）</span>
            <span class="legend"><i class="lg lg--run"></i>ラン <i class="lg lg--est"></i>ラン(推定)
              <i class="lg lg--str"></i>筋トレ</span>
          </div>
          ${max <= 1 ? `<div class="loadchart__empty">
            まだ負荷の記録がありません。筋トレを1セッション記録するか、ランのRPEを教えてください。
          </div>` : `
          <div class="loadchart__bars">
            ${r.daily.map((d) => {
              /* 推定ぶんと実測ぶんを分けて積む。同じ色にしない */
              const estRun = Math.min(d.run, d.estimated);
              const realRun = d.run - estRun;
              return `<div class="lbar" title="${esc(d.date)} / ${Math.round(d.load)} AU${
                d.estimated ? "（うち推定 " + Math.round(d.estimated) + "）" : ""}">
                <span class="lbar__str" style="height:${d.strength / max * 100}%"></span>
                <span class="lbar__run" style="height:${realRun / max * 100}%"></span>
                <span class="lbar__est" style="height:${estRun / max * 100}%"></span>
              </div>`;
            }).join("")}
          </div>
          <div class="loadchart__ax">
            <span>${esc(r.daily[0] ? r.daily[0].date.slice(5) : "")}</span>
            <span>${esc(r.daily[r.daily.length - 1] ? r.daily[r.daily.length - 1].date.slice(5) : "")}</span>
          </div>`}
        </div>

        ${w ? `<div class="split2">
          <section>
            <span class="eyebrow">今週の内訳</span>
            <table class="kv">
              <tbody>
                <tr><th>ラン</th><td class="num">${w.run.toLocaleString()} AU</td></tr>
                <tr><th>筋トレ</th><td class="num">${w.strength.toLocaleString()} AU</td></tr>
                <tr><th>ストレイン</th><td class="num">${w.strain != null ? w.strain.toLocaleString() : "—"}</td></tr>
                <tr><th>期間</th><td class="num muted">${esc(w.from)} 〜 ${esc(w.to)}</td></tr>
              </tbody>
            </table>
            <p class="muted small">ストレイン = 週間総負荷 × 単調性。総量が同じでも
              「毎日そこそこ」の方が不調・傷害が増えます（Foster 1998）。強い日と休む日を分けるほど安全です。</p>
          </section>
          <section>
            <span class="eyebrow">気づき</span>
            ${r.alerts.length ? r.alerts.map((al) => `
              <div class="notice notice--${al.level === "warn" ? "warn" : "info"}">
                <b>${esc(al.text)}</b>
                <span>${esc(al.why)}</span>
              </div>`).join("") : `<p class="muted small">現時点で警報はありません。</p>`}
            <p class="muted small">★この画面は警報を出すだけで、判断を自動で止めることはしません。
              ACWRは単独の安全基準として支持されていないためです（Impellizzeri 2020）。
              結論を止めるのは欠測検知だけ、という切り分けにしています。</p>
          </section>
        </div>` : ""}`;
    },
  });

  /* ============================================================ #vault */
  HOS.render.register({
    id: "vault", order: 92, pillar: null, mount: "#vault",

    fn(root, D, C) {
      const box = document.getElementById("vaultBody");
      if (!box || !HOS.store) return;
      const s = HOS.store.stats();

      box.innerHTML = `
        <p class="muted small">このサイトはサーバーを持たない静的サイトなので、入力は
          <b>この端末のブラウザ内</b>に保存されます。つまり <b>端末をまたいで同期しません</b>し、
          ブラウザのデータを消すと失われます。だから書き出しが要ります。</p>

        <div class="kpis kpis--sm">
          <div class="kpi"><div class="kpi__n">${s.sessions}</div><div class="kpi__l">記録セッション</div></div>
          <div class="kpi"><div class="kpi__n">${s.sets}</div><div class="kpi__l">記録セット</div></div>
          <div class="kpi"><div class="kpi__n">${s.checkins}</div><div class="kpi__l">チェックイン</div></div>
          <div class="kpi"><div class="kpi__n">${s.lastSession || "—"}</div><div class="kpi__l">最終記録日</div></div>
        </div>

        ${s.unexportedSessions ? `<div class="notice notice--warn">
          <b>${s.unexportedSessions}件のセッションがまだ書き出されていません</b>
          <span>JSONを書き出して Google Drive の「320」に置いてください。私が取り込んで恒久化し、
            週次のコーチングに反映します。書き出さないまま端末を変えると失われます。</span>
        </div>` : ""}

        <div class="vault__acts">
          <button id="expJSON" class="btn">JSONを書き出す</button>
          <button id="expCSV"  class="btn btn--ghost">CSVを書き出す</button>
          <label class="btn btn--ghost">
            読み込む（復元）<input type="file" id="impFile" accept="application/json,.json" hidden>
          </label>
        </div>
        <p class="muted small">保存先: <code>${esc(s.storage)}</code>
          ${s.storage === "memory-only" ? " ★localStorageが使えない環境です。タブを閉じると消えます（プライベートモードの可能性）" : ""}
          ／ 最終書き出し: ${s.lastExportAt ? esc(s.lastExportAt.slice(0, 16).replace("T", " ")) : "まだありません"}</p>
        <p id="vaultMsg" class="vault__msg"></p>`;

      const msg = (t, ok) => {
        const m = document.getElementById("vaultMsg");
        if (m) { m.textContent = t; m.className = "vault__msg " + (ok ? "is-ok" : "is-bad"); }
      };

      function download(text, name, mime) {
        try {
          const blob = new Blob([text], { type: mime + ";charset=utf-8" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = name;
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
          HOS.store.markExported();
          msg(`${name} を書き出しました。Driveの「320」に置いてください。`, true);
          rerender(["vault"]);
        } catch (e) {
          msg("書き出しに失敗しました: " + e, false);
        }
      }

      const d = HOS.store.todayISO();
      const bJ = document.getElementById("expJSON");
      const bC = document.getElementById("expCSV");
      const bI = document.getElementById("impFile");

      if (bJ) bJ.addEventListener("click", () =>
        download(HOS.store.exportJSON(), `healthos-${d}.json`, "application/json"));
      if (bC) bC.addEventListener("click", () =>
        download("﻿" + HOS.store.exportCSV(), `strength-${d}.csv`, "text/csv"));
      if (bI) bI.addEventListener("change", (ev) => {
        const file = ev.target.files && ev.target.files[0];
        if (!file) return;
        const fr = new FileReader();
        fr.onload = () => {
          const res = HOS.store.importJSON(String(fr.result), { merge: true });
          if (res.ok) { msg(`取り込みました（${res.added || 0}件を追加）`, true); rerender(["vault", "strength-today", "strength-progress", "load-dashboard", "checkin"]); }
          else msg("取り込めませんでした: " + res.error, false);
        };
        fr.readAsText(file);
      });
    },
  });

})();
