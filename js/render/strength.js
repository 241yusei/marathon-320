/* =========================================================================
 *  health-os / render — strength.js（筋トレ: 今日のメニューと記録）
 *  --------------------------------------------------------------------------
 *  #train  … 今日やる内容・推奨重量・その場での記録
 *  #library… 種目ライブラリ（解説リンク・対象筋・ランナーにとっての意味）
 *
 *  設計方針:
 *   ・入力は「重量 / 回数 / RIR」の3つだけ。それ以外は全部こちらで導出する
 *   ・推奨重量には必ず「なぜその重量か」を併記する（本人が納得できないと続かない）
 *   ・解説リンクはチャンネル内検索URL。動画が入れ替わっても壊れない
 *
 *  根拠: docs/strength-research.md §2 用量 / §4-3 週4回の配分 / §8-4 RIR
 * ========================================================================= */

(function () {
  "use strict";

  const HOS = window.HEALTH_OS;
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* 週の開始（月曜）を返す */
  function weekStart() {
    const d = new Date();
    const dow = (d.getDay() + 6) % 7;      /* 月=0 */
    d.setDate(d.getDate() - dow);
    return d.toISOString().slice(0, 10);
  }

  /* 今週すでに実施した split と、次に推奨する split */
  function weekState(program) {
    const ws = weekStart();
    const done = {};
    HOS.store.sessions().forEach((s) => {
      if (s.date >= ws && (s.entries || []).length) done[s.split] = s.date;
    });
    const phase = (program.periodization || []).find((p) => p.active) || program.periodization[0];
    const planned = phase.split;
    const next = planned.find((k) => !done[k]) || null;
    return { weekStart: ws, done, planned, phase, next };
  }

  /* A と C の間隔チェック（72時間ルール・§4-3） */
  function spacingWarning(splitKey) {
    if (splitKey !== "A" && splitKey !== "C") return null;
    const other = splitKey === "A" ? "C" : "A";
    const last = HOS.store.sessions().find((s) => s.split === other && (s.entries || []).length);
    if (!last) return null;
    const hours = (Date.now() - new Date(last.date + "T12:00:00").getTime()) / 3600000;
    if (hours >= 72) return null;
    return `直近の ${other}（下肢ヘビー）から約${Math.round(hours)}時間です。` +
           `下肢ヘビー同士は48〜72時間あけてください（docs/strength-research.md §4-3）。` +
           `今日は上肢の B / D に替えることを勧めます。`;
  }

  /* ------------------------------------------------------ 解説リンク */
  function linksHTML(ex) {
    return `<div class="ex__links">
      <span class="ex__links-lbl">解説</span>
      ${ex.links.map((l) => `
        <a class="cref cref--${l.medium}" href="${esc(l.url)}" target="_blank" rel="noopener noreferrer">
          <span class="cref__name">${esc(l.name)}</span>
          <span class="cref__hint">${esc(l.hint)}</span>
        </a>`).join("")}
    </div>`;
  }

  /* ブロックが処方をどこまで上書きするかを1箇所で決める。
   * split の items は「筋力ブロック（主ブロック）」の値を持っている。
   * 再適応ブロックのように、より軽く・より多い回数を指示するブロックでは
   * ブロック側を優先しないと、「再適応中です」と言いながら主ブロックの
   * 重量を出すことになる（表示と処方が食い違う）。
   * RIR は「余力をより多く残す方（大きい方）」を採る＝常に安全側に倒す。 */
  /* 重量で強度を決める種目だけが対象。自重・プライオ・時間指定の体幹種目は
   * ブロックの%1RM処方と無関係なので、絶対に上書きしない。
   * （ノルディックカールを「8〜10回」に書き換えるようなことが起きる。
   *   あれは2セット×3〜5回から入る種目で、回数を増やすのは有害） */
  const LOADABLE = { barbell: 1, dumbbell: 1, machine: 1, cable: 1 };

  function prescriptionFor(item, block) {
    const ex = HOS.data.exerciseById(item.ex);
    const itemRir = item.rir != null ? item.rir : 2;
    const plain = { reps: item.reps, rir: itemRir, overridden: false };

    if (!block || block.rirTarget == null) return plain;
    if (!ex || !LOADABLE[ex.equipment]) return plain;

    const rir = Math.max(itemRir, block.rirTarget);
    if (rir === itemRir) return plain;

    /* 「30〜45秒/側」「8〜10/脚」のような指定は回数の意味が違うので数値だけ差し替えない */
    const repsIsPlainRange = /^\s*\d+\s*[〜~-]?\s*\d*\s*$/.test(String(item.reps));

    /* ★回数の差し替えは「より軽くなる方向」にしか行わない。
     * 再適応ブロックの 8〜10 を、元が 12〜15 のフェイスプルに当てると
     * 回数が減って重量が上がる＝減量ブロックの意図と逆になる。 */
    const mid = (s) => {
      const n = String(s).match(/\d+/g);
      return n ? (n.length > 1 ? (+n[0] + +n[1]) / 2 : +n[0]) : null;
    };
    const bm = mid(block.reps), im = mid(item.reps);
    const useBlockReps = repsIsPlainRange && block.reps && bm != null && im != null && bm > im;

    return {
      reps: useBlockReps ? block.reps : item.reps,
      rir,
      overridden: true,
      blockName: block.name,
    };
  }

  /* ------------------------------------------------ 1種目のカード */
  function exerciseCard(item, session, block) {
    const D = HOS.data, C = HOS.compute;
    const ex = D.exerciseById(item.ex);
    if (!ex) return "";

    const p = prescriptionFor(item, block);
    const targetRir = p.rir;
    const sug = C.suggestLoad(ex.id, p.reps, targetRir, block);
    const logged = (session.entries || []).filter((e) => e.ex === ex.id);
    const { best } = C.bestFor(ex.id);

    const rows = logged.map((e) => {
      const r = C.e1rm(e.weightKg, e.reps, e.rir);
      return `<tr>
        <td class="num">${e.setNo}</td>
        <td class="num">${e.weightKg == null ? "—" : esc(e.weightKg)}</td>
        <td class="num">${e.reps == null ? "—" : esc(e.reps)}</td>
        <td class="num">${e.rir == null ? "—" : esc(e.rir)}</td>
        <td class="num muted">${r ? r.value.toFixed(0) : "—"}</td>
        <td><button class="lnk-del" data-del="${esc(e.id)}" aria-label="このセットを削除">削除</button></td>
      </tr>`;
    }).join("");

    return `
    <article class="ex" data-ex="${esc(ex.id)}">
      <header class="ex__head">
        <div>
          <h4 class="ex__name">${esc(ex.name)}
            ${ex.injuryPrevention ? '<span class="tag tag--prev">傷害予防</span>' : ""}
            ${item.role === "main" ? '<span class="tag tag--main">主種目</span>' : ""}
          </h4>
          <p class="ex__pre">${esc(item.sets)}セット × ${esc(p.reps)} ／ 目標 RIR ${esc(targetRir)}
            <span class="muted">（あと${esc(targetRir)}回上げられる重さで止める）</span></p>
          ${p.overridden ? `<p class="ex__override">${esc(p.blockName)}ブロック中のため、
            主ブロックの処方（${esc(item.reps)} / RIR${esc(item.rir != null ? item.rir : 2)}）より軽い側で出しています</p>` : ""}
        </div>
        <div class="ex__sug">
          ${sug.kg
            ? `<div class="ex__sug-kg ${sug.estimated ? "is-est" : ""}">${sug.kg}<span>kg</span></div>`
            : '<div class="ex__sug-kg ex__sug-kg--none">要測定</div>'}
          <div class="ex__sug-lbl">${
            sug.source === "measured" ? "推奨（実測）"
            : sug.source === "reported" ? "推奨（申告値）"
            : sug.source === "derived" ? "推奨（比から推定）"
            : "推奨"}</div>
        </div>
      </header>

      <p class="ex__why">${esc(sug.reason)}${best ? ` ・ 自己ベスト推定1RM ${best.e1rm.toFixed(0)}kg` : ""}</p>
      ${item.caution ? `<p class="ex__caution">⚠ ${esc(item.caution)}</p>` : ""}

      <!-- ★「なぜこの種目か」はここ（折りたたみ）に置く。
           ジムでこの画面を開く目的はセットの記録であり、入力欄が
           解説文の下に押し下げられてはいけない。読みたい人は開ける。 -->
      <details class="ex__cues">
        <summary>やり方と根拠 ${ex.muscles.primary.length ? `・対象: ${esc(ex.muscles.primary.join("・"))}` : ""}</summary>
        <p class="ex__runner">${esc(ex.runner)}</p>
        <ul>${ex.cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
        ${linksHTML(ex)}
      </details>

      ${logged.length ? `
      <table class="setlog">
        <thead><tr><th>set</th><th>kg</th><th>回</th><th>RIR</th><th>推定1RM</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>` : ""}

      <!-- novalidate: ブラウザ標準の検証は、値が不正なとき submit を
           「何も言わずに」中止する。記録用の道具でボタンが無反応になるのは
           最悪の失敗なので、検証は下のハンドラで明示的に行う。 -->
      <form class="setform" data-form="${esc(ex.id)}" novalidate>
        <label>重量<input type="number" step="0.5" inputmode="decimal" name="weightKg"
          value="${sug.kg != null ? sug.kg : ""}" placeholder="kg"></label>
        <label>回数<input type="number" step="1" inputmode="numeric" name="reps" placeholder="回"></label>
        <!-- ★step は 0.5。ブロックの目標RIRは3.5のような中間値を取りうるので、
             step="1" だと初期値が「無効な値」と判定され、ブラウザが送信を
             黙って中止する（記録ボタンが何も起こさない状態になっていた）。 -->
        <label>RIR<input type="number" step="0.5" inputmode="decimal" name="rir" min="0" max="6"
          value="${targetRir}" placeholder="余力"></label>
        <button type="submit">セットを記録</button>
      </form>
    </article>`;
  }

  /* ============================================================ #train */
  HOS.render.register({
    id: "strength-today", order: 22, pillar: "strength", mount: "#train",

    fn(root, D, C) {
      const P = D.strengthProgram;
      if (!P || !HOS.store) return;

      const head = document.getElementById("trainHead");
      const body = document.getElementById("trainBody");
      if (!head || !body) return;

      const st = weekState(P);
      const block = (P.blocks || []).find((b) => b.id === P.currentBlock) || P.blocks[0];

      /* 選択中のsplit。未選択なら推奨 */
      let active = body.dataset.split || st.next || st.planned[0];
      if (st.planned.indexOf(active) < 0) active = st.planned[0];

      /* ---------------------------------------------------------- head */
      head.innerHTML = `
        <div class="train__phase">
          <div class="train__phase-now">
            <span class="eyebrow">現在のブロック</span>
            <h3>${esc(block.name)}<span class="muted"> ／ ${esc(block.weeks)}</span></h3>
            <p>${esc(block.intensity)} ・ ${esc(block.reps)}</p>
            <p class="muted small">${esc(block.why)}</p>
          </div>
          <div class="train__week">
            <span class="eyebrow">今週（${esc(st.weekStart)}〜）</span>
            <div class="train__dots">
              ${st.planned.map((k) => {
                const s = (P.split || []).find((x) => x.key === k) || {};
                const done = !!st.done[k];
                return `<button class="sdot ${done ? "is-done" : ""} ${k === active ? "is-active" : ""}"
                  data-split="${esc(k)}" title="${esc(s.name || k)}">
                  <span class="sdot__k">${esc(k)}</span>
                  <span class="sdot__n">${esc((s.name || "").split(" — ")[0])}</span>
                </button>`;
              }).join("")}
            </div>
            <p class="muted small">${esc(st.phase.phase)}・週${st.phase.days}回 ／ ${esc(st.phase.note)}</p>
          </div>
        </div>`;

      /* ---------------------------------------------------------- body */
      const day = (P.split || []).find((x) => x.key === active);
      if (!day) { body.innerHTML = ""; return; }

      const session = HOS.store.startSession(active);
      const warn = spacingWarning(active);
      const done = session.entries.length;
      const target = day.items.reduce((a, i) => a + i.sets, 0);

      body.dataset.split = active;
      body.dataset.session = session.id;
      body.innerHTML = `
        <div class="train__daybar">
          <div>
            <h3 class="train__dayname">${esc(day.name)}</h3>
            <p class="muted small">${esc(day.why)}</p>
            <p class="muted small">配置: ${esc(day.placement)} ／ 目安 ${day.estMin}分
              ／ 走行への干渉: ${({ high: "大", low: "小", none: "ほぼ無し" }[day.interference])}</p>
          </div>
          <div class="train__prog">
            <div class="train__prog-n">${done}<span>/${target}</span></div>
            <div class="train__prog-l">記録セット</div>
          </div>
        </div>
        ${warn ? `<div class="notice notice--warn">${esc(warn)}</div>` : ""}
        ${day.items.map((it) => exerciseCard(it, session, block)).join("")}

        <form class="finish" id="finishForm" novalidate>
          <h4>セッションを締める</h4>
          <p class="muted small">★これがランと筋トレを同じ単位で足す唯一の入力です。
            終了30分後に、その日全体のきつさを0〜10で（Foster 2001 / strength-research §8-1）</p>
          <div class="finish__row">
            <label>所要時間<input type="number" name="durationMin" inputmode="numeric"
              value="${session.durationMin != null ? session.durationMin : day.estMin}" placeholder="分"></label>
            <label>セッションRPE<input type="number" name="sRPE" inputmode="decimal" step="0.5" min="0" max="10"
              value="${session.sRPE != null ? session.sRPE : ""}" placeholder="0〜10"></label>
            <button type="submit">${session.sRPE != null ? "更新する" : "記録する"}</button>
          </div>
          <p class="muted small">${session.sRPE != null
            ? `記録済み: RPE ${session.sRPE} × ${session.durationMin}分 = <b>${(session.sRPE * session.durationMin).toFixed(0)} AU</b>`
            : "未入力のあいだ、この日の負荷は週間集計に入りません"}</p>
        </form>`;

      /* -------------------------------------------------------- events */
      /* 再描画で listener が重複しないよう、毎回 body を作り直してから貼る */
      head.querySelectorAll("[data-split]").forEach((b) => {
        b.addEventListener("click", () => {
          body.dataset.split = b.dataset.split;
          rerender();
        });
      });

      body.querySelectorAll(".setform").forEach((f) => {
        f.addEventListener("submit", (ev) => {
          ev.preventDefault();
          const fd = new FormData(f);
          const reps = fd.get("reps");
          const msg = f.querySelector(".setform__msg");
          if (msg) msg.remove();
          if (!reps || !(Number(reps) > 0)) {
            const el = document.createElement("p");
            el.className = "setform__msg";
            el.textContent = "回数を入れてください（重量とRIRは任意）";
            f.appendChild(el);
            const r = f.querySelector('[name="reps"]');
            if (r) r.focus();
            return;
          }
          HOS.store.addSet(body.dataset.session, {
            ex: f.dataset.form,
            weightKg: fd.get("weightKg") || null,
            reps,
            rir: fd.get("rir") === "" ? null : fd.get("rir"),
          });
          rerender();
        });
      });

      body.querySelectorAll("[data-del]").forEach((b) => {
        b.addEventListener("click", () => {
          HOS.store.removeSet(body.dataset.session, b.dataset.del);
          rerender();
        });
      });

      const ff = document.getElementById("finishForm");
      if (ff) ff.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const fd = new FormData(ff);
        HOS.store.finishSession(body.dataset.session, {
          sRPE: fd.get("sRPE") === "" ? null : fd.get("sRPE"),
          durationMin: fd.get("durationMin") === "" ? null : fd.get("durationMin"),
        });
        rerender();
      });

      function rerender() {
        const spec = HOS.render.all().find((s) => s.id === "strength-today");
        try { spec.fn(root, HOS.data, HOS.compute); } catch (e) { console.error(e); }
        /* 負荷側も連動して更新する */
        ["load-dashboard", "strength-progress"].forEach((id) => {
          const s = HOS.render.all().find((x) => x.id === id);
          if (!s) return;
          const r = s.mount ? document.querySelector(s.mount) : null;
          try { s.fn(r, HOS.data, HOS.compute); } catch (e) { console.error(e); }
        });
      }
    },
  });

  /* ================================================== #train 内: 進捗 */
  HOS.render.register({
    id: "strength-progress", order: 23, pillar: "strength", mount: "#train",

    fn(root, D, C) {
      const box = document.getElementById("trainProgress");
      if (!box || !HOS.store) return;
      const s = C.strengthSummary();

      /* ---------------------------------------------------- 基準値パネル */
      const B = D.strengthProgram.baseline;
      let baseHTML = "";
      if (B) {
        const rows = (B.lifts || []).map((l) => {
          const ex = D.exerciseById(l.ex);
          const b = C.baselineE1rm(l.ex);
          const { latest } = C.bestFor(l.ex);
          return { name: ex ? ex.short || ex.name : l.ex, l, b, measured: latest };
        });
        const ratios = C.baselineRatios();
        const low = ratios.filter((r) => r.alert);

        baseHTML = `
        <div class="baseline">
          <div class="baseline__head">
            <span class="eyebrow">基準値（BIG3）</span>
            <span class="muted small">${esc(B.reportedAt)} 本人申告 ・ 体重 ${B.bodyWeightKg}kg</span>
          </div>
          <table class="base-tbl">
            <thead><tr><th>種目</th><th>申告</th><th>推定1RM</th><th>体重比</th><th>状態</th></tr></thead>
            <tbody>
              ${rows.map((r) => `<tr>
                <td>${esc(r.name)}</td>
                <td class="num">${r.l.weightKg}kg × ${r.l.reps}</td>
                <td class="num"><b>${r.b ? r.b.value.toFixed(0) : "—"}</b> kg</td>
                <td class="num muted">${r.b ? (r.b.value / B.bodyWeightKg).toFixed(2) : "—"} ×</td>
                <td class="${r.measured ? "is-ok" : "is-est"}">${r.measured ? "実測で更新済み" : "申告値"}</td>
              </tr>`).join("")}
            </tbody>
          </table>
          <p class="muted small">RIRを伺っていないため <b>RIR${B.rirAssumed}</b> と仮定して換算しています。
            「あれは限界だった（RIR0）」なら約3%下振れ、「まだ2回いけた」なら約3%上振れします。
            初回セッションで1セット入力すれば、そこから実測に置き換わります。</p>

          ${ratios.length ? `
          <div class="ratios">
            ${ratios.map((r) => `
              <div class="ratio ratio--${r.state}${r.alert ? " is-alert" : ""}">
                <div class="ratio__v">${r.value}</div>
                <div class="ratio__l">${esc(r.label)}</div>
                <div class="ratio__t">一般に ${esc(r.typical)}</div>
              </div>`).join("")}
          </div>` : ""}

          ${low.length ? low.map((r) => `
            <div class="notice notice--warn">
              <b>${esc(r.label)}が ${r.value}（一般に${esc(r.typical)}）と低い</b>
              <span>${esc(r.why)}</span>
            </div>`).join("") : ""}
        </div>`;
      }

      if (!s.totalSessions) {
        const O = D.strengthProgram.onboarding;
        box.innerHTML = baseHTML + `
          <div class="onboard">
            <span class="eyebrow">はじめに</span>
            <h3>${esc(O.headline)}</h3>
            <ol class="onboard__steps">
              ${O.steps.map((st) => `<li>
                <b>${esc(st.text)}</b>
                <span>${esc(st.why)}</span>
              </li>`).join("")}
            </ol>
            <table class="rir">
              <caption>RIR の目安（Zourdos 2016 / strength-research §8-4）</caption>
              <thead><tr><th>RIR</th><th>RPE</th><th>感覚</th><th>%1RM</th></tr></thead>
              <tbody>${D.strengthProgram.rirScale.map((r) => `
                <tr class="${r.target ? "is-target" : ""}">
                  <td class="num">${r.rir}</td><td class="num">${r.rpe}</td>
                  <td>${esc(r.label)}</td><td class="num muted">${esc(r.pct)}</td>
                </tr>`).join("")}</tbody>
            </table>
          </div>`;
        return;
      }

      const prev = s.injuryPrevention;
      const missing = prev.filter((p) => !p.ok);

      box.innerHTML = baseHTML + `
        <div class="kpis">
          <div class="kpi"><div class="kpi__n">${s.week.sessions}</div><div class="kpi__l">今週のセッション</div></div>
          <div class="kpi"><div class="kpi__n">${s.week.sets}</div><div class="kpi__l">今週のセット</div></div>
          <div class="kpi"><div class="kpi__n">${s.week.volumeKg.toLocaleString()}<span>kg</span></div><div class="kpi__l">今週の総挙上量</div></div>
          <div class="kpi"><div class="kpi__n">${s.totalSessions}</div><div class="kpi__l">通算セッション</div></div>
        </div>

        <div class="split2">
          <section>
            <span class="eyebrow">今週のセット数（筋群別）</span>
            <p class="muted small">主働筋を1・協働筋を0.5として数える。★肥大が目的ではないので
              週10セットを追う必要はない。ランナーの目的関数は走効率と傷害予防（strength-research §2-3）</p>
            <ul class="bars">
              ${s.byMuscle.slice(0, 8).map((m) => `
                <li><span class="bars__l">${esc(m.muscle)}</span>
                  <span class="bars__t"><i style="width:${Math.min(100, m.sets / 12 * 100)}%"></i></span>
                  <span class="bars__n">${m.sets}</span></li>`).join("")}
            </ul>
          </section>
          <section>
            <span class="eyebrow">傷害予防種目の実施（直近14日）</span>
            <p class="muted small">最も「やった気になって抜ける」部分なので独立に監視する（strength-research §5）</p>
            <ul class="checks">
              ${prev.map((p) => `<li class="${p.ok ? "is-ok" : "is-miss"}">
                <span class="checks__i">${p.ok ? "●" : "○"}</span>
                <span class="checks__n">${esc(p.short)}</span>
                <span class="checks__d">${p.last ? esc(p.last) : "未実施"}</span>
              </li>`).join("")}
            </ul>
            ${missing.length ? `<p class="notice notice--info small">
              ${esc(missing.map((m) => m.short).join("・"))} が14日間入っていません。
              ${esc(missing[0].why)}</p>` : ""}
          </section>
        </div>`;
    },
  });

  /* ========================================================== #library */
  HOS.render.register({
    id: "strength-library", order: 24, pillar: "strength", mount: "#library",

    fn(root, D, C) {
      const box = document.getElementById("libraryBody");
      const coaches = document.getElementById("libraryCoaches");
      if (!box) return;

      if (coaches) {
        coaches.innerHTML = (D.coaches || []).map((c) => `
          <a class="coach" href="${esc(c.home)}" target="_blank" rel="noopener noreferrer">
            <span class="coach__medium">${c.medium === "youtube" ? "YouTube" : "ブログ"}</span>
            <span class="coach__name">${esc(c.full)}</span>
            <span class="coach__note">${esc(c.note)}</span>
          </a>`).join("");
      }

      const GROUPS = [
        { p: "squat",  label: "スクワット系（膝関節優位）" },
        { p: "hinge",  label: "ヒンジ系（股関節優位・後鎖）" },
        { p: "lunge",  label: "片脚（左右差の是正）" },
        { p: "calf",   label: "下腿（ランナー必須）" },
        { p: "push",   label: "上肢プッシュ" },
        { p: "pull",   label: "上肢プル" },
        { p: "core",   label: "体幹（動かさない力）" },
        { p: "plyo",   label: "プライオメトリクス" },
        { p: "mobility", label: "可動域・ストレッチ（自宅）" },
      ];

      box.innerHTML = GROUPS.map((g) => {
        const list = (D.exercises || []).filter((e) => e.pattern === g.p);
        if (!list.length) return "";
        return `
        <section class="lib__group">
          <h3 class="lib__gh">${esc(g.label)}</h3>
          ${list.map((e) => `
            <details class="lib__ex">
              <summary>
                <span class="lib__name">${esc(e.name)}</span>
                <span class="lib__m">${esc((e.muscles.primary || []).join("・"))}</span>
                ${e.injuryPrevention ? '<span class="tag tag--prev">傷害予防</span>' : ""}
              </summary>
              <p class="lib__runner">${esc(e.runner)}</p>
              <p class="lib__scheme">既定の処方: ${e.scheme.sets}セット × ${esc(e.scheme.reps)}
                ${e.scheme.rir != null ? ` ／ RIR ${e.scheme.rir}` : ""}
                ${e.scheme.restSec ? ` ／ 休息 ${e.scheme.restSec}秒` : ""}
                ${e.scheme.tempo ? ` ／ ${esc(e.scheme.tempo)}` : ""}</p>
              <ul class="lib__cues">${e.cues.map((c) => `<li>${esc(c)}</li>`).join("")}</ul>
              ${linksHTML(e)}
            </details>`).join("")}
        </section>`;
      }).join("");
    },
  });

})();
