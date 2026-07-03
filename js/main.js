/* =========================================================================
 *  marathon_plan / site — main.js
 *  data.js を読み込み、各セクションを描画。スクロール連動アニメ・
 *  SVG トレンドチャート・レースカウントダウンを担う。
 * ========================================================================= */
(function () {
  "use strict";
  const D = window.MARATHON_DATA;
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

  /* ---------- inline SVG icons for highlights ---------- */
  const ICONS = {
    weight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 9a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2l-1.2 9a2 2 0 0 1-2 1.7H7.2a2 2 0 0 1-2-1.7L4 9Z"/><path d="M9 7a3 3 0 0 1 6 0"/></svg>',
    hrv:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12h4l2-6 4 12 2-6h8" stroke-linejoin="round" stroke-linecap="round"/></svg>',
    heart:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20s-7-4.5-9.3-9C1 8 2.5 4.8 6 4.8c2 0 3.2 1.2 4 2.4.8-1.2 2-2.4 4-2.4 3.5 0 5 3.2 3.3 6.2C19 15.5 12 20 12 20Z"/></svg>',
    sleep:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" stroke-linejoin="round"/></svg>',
    run:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="15.5" cy="4.5" r="1.8"/><path d="M5 21l3-5 3 1 1-4-4-2 4-3 2 3 3 1" stroke-linejoin="round" stroke-linecap="round"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 5H4v1a3 3 0 0 0 3 3M17 5h3v1a3 3 0 0 1-3 3M9 20h6M12 13v4" stroke-linecap="round"/></svg>',
    check:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12.5 10 17 19 7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    lock:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  };

  /* ====================================================== HERO */
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
  function renderHero() {
    $("navUpdated").textContent = D.meta.lastUpdated;
    $("heroEyebrow").textContent = D.hero.eyebrow;
    $("heroTitle").innerHTML = D.hero.titleLines
      .map((l, i) => i === D.hero.titleLines.length - 1 ? `<span class="grad-text">${esc(l)}</span>` : esc(l))
      .join("<br>");
    $("heroSub").textContent = D.hero.sub;

    $("heroStats").innerHTML = D.hero.bigStats.map((s) => {
      let value = s.value, unit = s.unit, note = s.note;
      if (s.dynamic === "weightGap") {
        const wm = D.metrics.find((m) => m.name === "体重");
        const cur = wm ? parseFloat(wm.value) : null;
        const tgt = D.meta.targetWeight;
        if (cur != null && tgt != null) {
          value = `−${(Math.round((cur - tgt) * 10) / 10).toFixed(1)}`;
          note = `現在 ${cur} → ${tgt}kg`;
        }
      } else if (s.dynamic === "sleepStreak") {
        const gate = D.gates.find((g) => g.unit === "日" && g.total != null);
        if (gate) {
          value = String(gate.progress);
          unit = `/${gate.total}日`;
          note = "7h以上の連続日数（減量ゲート）";
        }
      }
      const simple = /^[−-]?\d+(\.\d+)?$/.test(value);
      return `
        <div class="hstat ${s.dynamic === "sleepStreak" ? "hstat--today" : ""}">
          <div class="hstat__v"><span class="hstat__num" data-final="${esc(value)}" data-animate="${simple ? 1 : 0}">${simple ? "0" : esc(value)}</span>${unit ? `<span class="u">${esc(unit)}</span>` : ""}</div>
          <div class="hstat__l">${esc(s.label)}</div>
          <div class="hstat__n">${esc(note)}</div>
        </div>`;
    }).join("");
    $("heroStats").querySelectorAll('.hstat__num[data-animate="1"]').forEach((elm) => animateCountUp(elm, elm.dataset.final));

    // countdown to race (browser-side date math)
    const race = D.race;
    const today = new Date();
    const rd = new Date(race.date + "T00:00:00");
    const days = Math.max(0, Math.ceil((rd - today) / 86400000));
    $("heroCountdown").innerHTML = `
      <div class="countdown">
        <span class="race">${esc(race.name)}</span>
        <span>${esc(race.date)} まで</span>
        <b>${days}</b><span>日</span>
      </div>`;
  }

  /* ====================================================== TODAY (command center) */
  function daysToRace() {
    const today = new Date();
    const rd = new Date(D.race.date + "T00:00:00");
    return Math.max(0, Math.ceil((rd - today) / 86400000));
  }
  // データが「今日」より古い場合、指針ラベルを日付付きに変え、カードを減光する。
  function updateFreshness() {
    const updated = new Date(D.meta.lastUpdated + "T00:00:00");
    const todayMid = new Date();
    todayMid.setHours(0, 0, 0, 0);
    const stale = todayMid > updated;
    const label = stale
      ? `${updated.getMonth() + 1}/${updated.getDate()} 時点の指針`
      : "本日の指針";
    return { stale, label };
  }
  function renderToday() {
    const j = D.week.judgment;
    const codeCls = { GO: "go", EASY: "easy", REST: "rest" }[j.code] || "easy";
    const fresh = updateFreshness();

    // 判定カード ＋ カウントダウン
    $("todayVerdict").innerHTML = `
      <div class="verdict verdict--${codeCls} ${fresh.stale ? "verdict--stale" : ""}">
        <div class="verdict__main">
          <div class="verdict__code">${esc(j.code)}</div>
          <div class="verdict__meta">
            <div class="verdict__label">${esc(fresh.label)}</div>
            <div class="verdict__reason">${esc(j.reason)}</div>
          </div>
        </div>
        <div class="verdict__race">
          <div class="verdict__race-name">${esc(D.race.name)}</div>
          <div class="verdict__race-days"><b>${daysToRace()}</b> 日</div>
          <div class="verdict__race-date">${esc(D.race.date)}</div>
        </div>
      </div>`;

    // 主要バイタル（4枚）
    const vit = [
      { m: "HRV（直近）", label: "HRV" },
      { m: "睡眠（直近）", label: "睡眠" },
      { m: "安静時HR（直近）", label: "安静時HR" },
      { m: "体重", label: "体重" },
    ];
    $("todayVitals").innerHTML = `<div class="vitals">${vit.map((v) => {
      const m = D.metrics.find((x) => x.name === v.m) || {};
      return `
        <div class="vital">
          <div class="vital__top"><span class="vital__name">${esc(v.label)}</span><span class="vital__dot ${dotClass(m.state)}"></span></div>
          <div class="vital__v">${esc(m.value || "—")}${m.delta ? `<span class="delta delta--${m.deltaState || "none"}">${esc(m.delta)}</span>` : ""}</div>
          <div class="vital__t">目標 ${esc(m.target || "—")}</div>
        </div>`;
    }).join("")}</div>`;

    // ブロッカー（次へ進むための関門）
    const gatePills = D.gates.filter((g) => g.locked).map((g) => {
      const prog = (g.progress != null && g.total != null) ? ` ${g.progress}/${g.total}${g.unit}` : "";
      return `<span class="alert alert--lock">⛔ ${esc(g.name)}${esc(prog)}</span>`;
    }).join("");
    $("todayAlerts").innerHTML = `
      <div class="blockers">
        <span class="blockers__label">次に進むための関門</span>
        <div class="alerts">${gatePills}</div>
      </div>`;

    // 今日やること（未完了の優先事項・上位2件）
    const todos = D.week.priorities.filter((p) => !p.done).slice(0, 2);
    $("todayDo").innerHTML = `
      <div class="todaydo">
        <div class="todaydo__head">今日やること</div>
        ${todos.map((t) => `
          <div class="todaydo__item ${t.emphasis ? "is-key" : ""}">
            <span class="todaydo__bullet"></span>
            <div><div class="todaydo__text">${esc(t.text)}</div><div class="todaydo__detail">${esc(t.detail)}</div></div>
          </div>`).join("")}
      </div>`;
  }

  /* ====================================================== HIGHLIGHTS */
  function renderHighlights() {
    const rail = $("hlRail");
    D.highlights.forEach((h) => {
      const c = el(h.anchor ? "a" : "div", "hl-card");
      if (h.anchor) c.setAttribute("href", "#" + h.anchor);
      c.innerHTML = `
        <span class="hl-card__badge ${dotClass(h.state)}"></span>
        <div class="hl-card__icon">${ICONS[h.icon] || ""}</div>
        <div>
          <div class="hl-card__v">${esc(h.value)}${h.unit ? `<span class="u">${esc(h.unit)}</span>` : ""}</div>
          <div class="hl-card__l">${esc(h.label)}</div>
          <div class="hl-card__n">${esc(h.note)}</div>
          ${h.anchor ? '<div class="hl-card__more">詳しく見る <span>↓</span></div>' : ""}
        </div>`;
      rail.appendChild(c);
    });
  }

  /* ====================================================== STATUS */
  function renderStatus() {
    $("statusSub").textContent =
      `${D.meta.phase}（${D.meta.phaseWeek}） — ${D.meta.phaseGoal}`;
    const countEl = $("statCount");
    if (countEl) countEl.textContent = D.metrics.length;
    $("statGrid").innerHTML = D.metrics.map((m) => `
      <div class="stat-cell">
        <div class="stat-cell__bar" style="background:${stateColor(m.state)}"></div>
        <div class="stat-cell__name">${esc(m.name)}</div>
        <div class="stat-cell__v">${esc(m.value)}${m.delta ? `<span class="delta delta--${m.deltaState || "none"}">${esc(m.delta)}</span>` : ""}</div>
        <div class="stat-cell__meta">目標 ${esc(m.target)}　·　${esc(m.date)}</div>
      </div>`).join("");
  }

  /* ====================================================== WEEK */
  const WEEKDAY_JA = ["日", "月", "火", "水", "木", "金", "土"];
  function renderWeek() {
    $("weekTitle").textContent = D.week.label;
    const j = D.week.judgment;
    const fresh = updateFreshness();
    $("weekJudge").innerHTML = `
      <div class="judge-pill">
        <span class="code">${esc(fresh.label)} · ${esc(j.code)}</span>
        <span class="reason">${esc(j.reason)}</span>
      </div>`;
    $("weekTodos").innerHTML = D.week.priorities.map((p) => `
      <div class="todo ${p.emphasis ? "todo--emph" : ""}">
        <div class="todo__check ${p.done ? "done" : ""}">${p.done ? ICONS.check : ""}</div>
        <div class="todo__body">
          <div class="todo__text">${esc(p.text)}</div>
          <div class="todo__detail">${esc(p.detail)}</div>
          <span class="todo__tag">${esc(p.tag)}</span>
        </div>
      </div>`).join("");

    const scheduleHeading = $("scheduleHeading");
    if (scheduleHeading) scheduleHeading.textContent = `週間スケジュール（${D.meta.phase.split(":")[0].trim()}）`;
    const todayWD = WEEKDAY_JA[new Date().getDay()];
    const hasVal = (v) => v && v !== "—";
    $("scheduleTbl").innerHTML = `
      <div class="sched-list">${D.schedule.map((s) => `
        <div class="sched-row ${s.rest ? "is-rest" : ""} ${s.day === todayWD ? "is-today" : ""}">
          <div class="sched-day">${esc(s.day)}${s.day === todayWD ? '<span class="sched-today-tag">今日</span>' : ""}</div>
          <div class="sched-body">
            <div class="sched-menu">${esc(s.menu)}</div>
            <div class="sched-meta">${hasVal(s.dist) ? `${esc(s.dist)} ・ ` : ""}${esc(s.zone)}</div>
          </div>
        </div>`).join("")}</div>`;

    renderNextWorkout();
  }

  /* ====================================================== NEXT WORKOUT (evidence) */
  function renderNextWorkout() {
    const el = $("nextWorkout");
    if (!el || !D.nextWorkout) return;
    const n = D.nextWorkout;
    el.innerHTML = `
      <p class="sec-sub" style="margin-bottom:22px">
        <strong style="color:var(--accent-soft)">${esc(n.day)}</strong> — ${esc(n.menu)}
      </p>
      <div class="nw-points">${n.points.map((p) => `
        <div class="todo">
          <div class="todo__check">${ICONS.check}</div>
          <div class="todo__body">
            <div class="todo__text" style="font-size:16px">${esc(p.title)}</div>
            <div class="todo__detail">${esc(p.detail)}</div>
          </div>
        </div>`).join("")}</div>
      <div class="nw-evidence">${n.evidence.map((e) => `
        <div class="evidence-item">
          <span class="evidence-tag">${esc(e.tag)}</span>
          <span class="evidence-text">${esc(e.text)}</span>
        </div>`).join("")}</div>`;
  }

  /* ====================================================== RUNS */
  const judgeTag = (code) => {
    if (!code || code === "—") return '<span class="tag tag-mute">—</span>';
    const map = { GO: "tag-go", EASY: "tag-easy", REST: "tag-rest" };
    const key = code.replace("相当", "");
    return `<span class="tag ${map[key] || "tag-mute"}">${esc(code)}</span>`;
  };
  function renderRuns() {
    const DAILY_SHOW = 8;
    const dailyRecent = D.dailyLog.slice(-DAILY_SHOW).reverse();
    const has = (v) => v && v !== "—";
    $("dailyTbl").innerHTML = `
      <div class="dlog-list">${dailyRecent.map((d) => {
        const meta = [
          has(d.hrv)    ? `HRV ${esc(d.hrv)}ms`     : null,
          has(d.rhr)    ? `RHR ${esc(d.rhr)}`       : null,
          has(d.sleep)  ? `睡眠 ${esc(d.sleep)}h`   : null,
          has(d.weight) ? `体重 ${esc(d.weight)}kg` : null,
        ].filter(Boolean).join(" ・ ");
        return `
        <div class="dlog">
          <div class="dlog__top">
            <span class="dlog__date">${esc(d.date)}</span>
            ${judgeTag(d.judge)}
            ${has(d.run) ? `<span class="dlog__run">${esc(d.run)}</span>` : ""}
          </div>
          ${meta ? `<div class="dlog__meta">${meta}</div>` : ""}
          <div class="dlog__note" title="${esc(d.note)}">${esc(d.note)}</div>
        </div>`;
      }).join("")}</div>
      ${D.dailyLog.length > DAILY_SHOW ? `<p class="tbl-foot">直近 ${DAILY_SHOW} 日を新しい順で表示（全 ${D.dailyLog.length} 件）</p>` : ""}`;

    const runsRecent = D.recentRuns.slice(-6).reverse();
    $("runsTbl").innerHTML = `
      <table class="tbl">
        <thead><tr><th>日付</th><th>距離</th><th>ペース</th><th>評価</th><th></th></tr></thead>
        <tbody>${runsRecent.map((r) => `
          <tr>
            <td class="num">${esc(r.date)}</td>
            <td class="num">${esc(r.dist)}</td>
            <td class="num">${esc(r.pace)}</td>
            <td style="white-space:normal">${esc(r.note)}</td>
            <td>${r.good ? '<span class="good-mark">✓ 適切</span>' : '<span class="bad-mark">! 速い</span>'}</td>
          </tr>`).join("")}</tbody>
      </table>`;

    renderRunReview();
  }

  /* ====================================================== RUN REVIEW (良かった点/改善点) */
  function renderRunReview() {
    const el = $("runReview");
    if (!el || !D.runReview) return;
    const r = D.runReview;
    const z = D.zoneCompliance;
    el.innerHTML = `
      <div class="rr-head">
        <p class="sec-sub" style="margin:0">
          <strong style="color:var(--ink)">${esc(r.date)}</strong> — ${esc(r.summary)}
        </p>
        ${z ? `
        <div class="zring-wrap">
          <div class="zring" style="--pct:${z.pct}"><div class="zring__ring"><div class="zring__val">${z.pct}<span>%</span></div></div></div>
          <div class="zring__label">Z1-2比率 ・ 目標${z.target}%</div>
        </div>` : ""}
      </div>
      <div class="rr-grid" style="margin-top:20px">
        <div class="rr-col rr-col--good">
          <h4 class="rr-col__title good-mark">◎ 良かった点</h4>
          <ul class="rr-list">${r.good.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        </div>
        <div class="rr-col rr-col--bad">
          <h4 class="rr-col__title bad-mark">△ 改善点</h4>
          <ul class="rr-list">${r.bad.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
        </div>
      </div>`;
  }

  /* ====================================================== CHART (SVG) */
  let chartKey = "hrv";
  function renderChartTabs() {
    const tabs = $("chartTabs");
    const keys = Object.keys(D.trends.series);
    tabs.innerHTML = keys.map((k) =>
      `<button class="chart-tab ${k === chartKey ? "active" : ""}" data-k="${k}">${esc(D.trends.series[k].label)}</button>`
    ).join("");
    tabs.querySelectorAll(".chart-tab").forEach((b) =>
      b.addEventListener("click", () => {
        chartKey = b.dataset.k;
        tabs.querySelectorAll(".chart-tab").forEach((x) => x.classList.toggle("active", x === b));
        drawChart();
      })
    );
  }
  // SVG presentation attributes don't resolve CSS var(); convert to a literal color.
  function resolveColor(c) {
    if (typeof c === "string" && c.indexOf("var(") === 0) {
      const name = c.slice(c.indexOf("(") + 1, c.indexOf(")")).trim();
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || "#ff6a2b";
    }
    return c;
  }
  function drawChart() {
    const s = D.trends.series[chartKey];
    const color = resolveColor(s.color);
    const axis = resolveColor("var(--on-dark-2)");
    const days = D.trends.days;
    const W = 920, H = 380, pad = { t: 30, r: 24, b: 44, l: 48 };
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const data = s.data;
    let min = Math.min(...data), max = Math.max(...data);
    if (s.target != null) { min = Math.min(min, s.target); max = Math.max(max, s.target); }
    const span = (max - min) || 1;
    min -= span * 0.12; max += span * 0.12;
    const x = (i) => pad.l + (iw * i) / (days.length - 1);
    const y = (v) => pad.t + ih - (ih * (v - min)) / (max - min);

    // gridlines (4)
    let grid = "";
    for (let g = 0; g <= 4; g++) {
      const gv = min + ((max - min) * g) / 4;
      const gy = y(gv);
      grid += `<line x1="${pad.l}" y1="${gy.toFixed(1)}" x2="${W - pad.r}" y2="${gy.toFixed(1)}" stroke="rgba(255,255,255,0.08)"/>`;
      grid += `<text x="${pad.l - 10}" y="${(gy + 4).toFixed(1)}" fill="${axis}" font-size="12" text-anchor="end">${gv.toFixed(0)}</text>`;
    }
    // x labels
    let xlab = "";
    days.forEach((d, i) => {
      xlab += `<text x="${x(i).toFixed(1)}" y="${H - 14}" fill="${axis}" font-size="12" text-anchor="middle">${esc(d)}</text>`;
    });
    // target line
    let tgt = "";
    if (s.target != null) {
      const ty = y(s.target);
      tgt = `<line x1="${pad.l}" y1="${ty.toFixed(1)}" x2="${W - pad.r}" y2="${ty.toFixed(1)}" stroke="${color}" stroke-width="1.4" stroke-dasharray="5 5" opacity="0.55"/>
             <text x="${W - pad.r}" y="${(ty - 8).toFixed(1)}" fill="${color}" font-size="12" font-weight="600" text-anchor="end">${esc(s.targetLabel || "目標")}</text>`;
    }
    // line + area path
    const pts = data.map((v, i) => [x(i), y(v)]);
    const linePath = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
    const areaPath = `${linePath} L${pad.l + iw} ${pad.t + ih} L${pad.l} ${pad.t + ih} Z`;
    // 常時ラベルは最初/最後/最小/最大のみ。他はタップ/ホバーで表示（数字の圧迫感を減らす）。
    // 横ばい補完で同値が並ぶ場合は「最初にその値になった点」だけを鍵点にする。
    const minVal = Math.min(...data), maxVal = Math.max(...data);
    const keyIdx = new Set([0, data.length - 1, data.indexOf(minVal), data.indexOf(maxVal)]);
    const unitSuffix = chartKey === "distance" ? "km" : (chartKey === "rhr" ? "bpm" : (chartKey === "sleep" ? "h" : "ms"));
    const points = pts.map((p, i) => `
      <g class="pt ${keyIdx.has(i) ? "is-key" : ""}">
        <title>${esc(days[i])} ・ ${data[i]}${unitSuffix}</title>
        <circle class="pt-hit" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="14" fill="transparent"/>
        <circle class="pt-dot" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="4.5" fill="#000" stroke="${color}" stroke-width="2.5"/>
        <text class="pt-label" x="${p[0].toFixed(1)}" y="${(p[1] - 14).toFixed(1)}" fill="#fff" font-size="12.5" font-weight="700" text-anchor="middle">${data[i]}</text>
      </g>`
    ).join("");

    const gid = "g_" + chartKey;
    $("chartBox").innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(s.label)} 7日間推移">
        <defs>
          <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="${color}" stop-opacity="0.32"/>
            <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
          </linearGradient>
        </defs>
        ${grid}${tgt}
        <path d="${areaPath}" fill="url(#${gid})"/>
        <path d="${linePath}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="chart-line"/>
        ${points}${xlab}
      </svg>`;
    $("chartBox").querySelectorAll(".pt").forEach((g) => {
      g.addEventListener("click", () => g.classList.toggle("show-label"));
    });
    // animate stroke
    const line = $("chartBox").querySelector(".chart-line");
    if (line) {
      const len = line.getTotalLength();
      line.style.strokeDasharray = len;
      line.style.strokeDashoffset = len;
      requestAnimationFrame(() => {
        line.style.transition = "stroke-dashoffset 1.1s cubic-bezier(.28,.11,.32,1)";
        line.style.strokeDashoffset = "0";
      });
    }
    $("chartNote").textContent = D.trends.note;
  }

  /* ====================================================== GATES */
  function renderGates() {
    $("gatesGrid").innerHTML = D.gates.map((g) => {
      const achieved = g.progress != null && g.total != null && g.progress >= g.total;
      let prog = "";
      if (g.progress != null && g.total != null) {
        if (g.unit === "日" && g.total <= 21) {
          // 14日など短い日数ゲートはドットグリッドで「埋めていく」実感を出す
          const dots = Array.from({ length: g.total }, (_, i) =>
            `<span class="gate-dot ${i < g.progress ? "is-on" : ""}" style="--i:${i}"></span>`
          ).join("");
          prog = `
            <div class="gate__progress">
              <div class="dot-grid">${dots}</div>
              <div class="progress-label">${g.progress} / ${g.total} ${esc(g.unit)}</div>
            </div>`;
        } else {
          const pct = Math.min(100, (g.progress / g.total) * 100);
          prog = `
            <div class="gate__progress">
              <div class="progress-track"><div class="progress-fill" data-w="${pct}" style="width:0"></div></div>
              <div class="progress-label">進捗 ${g.progress} / ${g.total} ${esc(g.unit)}</div>
            </div>`;
        }
      }
      return `
        <div class="gate ${achieved ? "gate--unlocked" : ""}">
          <div class="gate__head">
            <span class="gate__lock">${achieved ? ICONS.check : ICONS.lock}</span>
            <span class="gate__name">${esc(g.name)}</span>
            ${achieved ? '<span class="gate__unlocked-tag">開放！</span>' : ""}
          </div>
          ${g.conditions.map((c) => `<div class="gate__cond">${esc(c)}</div>`).join("")}
          ${prog}
          <div class="gate__why">${esc(g.why)}</div>
        </div>`;
    }).join("");
  }

  /* ====================================================== PHASES */
  function renderPhases() {
    $("phaseRail").innerHTML = D.phases.map((p) => `
      <div class="phase-row ${p.active ? "active" : ""}">
        <div>
          <div class="phase-id">${esc(p.id)}${p.active ? '<span class="phase-now">NOW</span>' : ""}</div>
          <div class="phase-weeks">${esc(p.weeks)}</div>
        </div>
        <div>
          <div class="phase-name">${esc(p.name)}</div>
          <div class="phase-goal">${esc(p.goal)}</div>
          <span class="phase-dist">週間 ${esc(p.dist)}</span>
        </div>
      </div>`).join("");
  }

  /* ====================================================== REQUIREMENTS */
  function renderReq() {
    $("reqTbl").innerHTML = `
      <table class="tbl">
        <thead><tr><th>指標</th><th>現在</th><th>必要値</th><th>根拠</th></tr></thead>
        <tbody>${D.requirements.map((r) => `
          <tr>
            <td style="font-weight:600">${esc(r.metric)}</td>
            <td class="num" style="color:var(--ink-2)">${esc(r.now)}</td>
            <td class="num" style="color:var(--accent);font-weight:700">${esc(r.need)}</td>
            <td style="white-space:normal;color:var(--ink-2);font-size:12.5px">${esc(r.basis)}</td>
          </tr>`).join("")}</tbody>
      </table>`;
    $("savingBox").innerHTML = D.timeSavings.map((s) => `
      <div class="saving-row ${s.total ? "total" : ""}">
        <div class="saving-item"><b>${esc(s.item)}</b><div class="saving-cond">${esc(s.cond)}</div></div>
        <div class="saving-effect">${esc(s.effect)}</div>
      </div>`).join("");
  }

  /* ====================================================== FUEL + ZONES */
  function renderFuel() {
    const n = D.nutrition;
    $("calNote").textContent = `BMR ${n.calories.bmr} kcal · TDEE ${n.calories.tdee} kcal · 目標摂取 ${n.calories.target} kcal/日`;
    const cls = { "タンパク質": "p", "糖質": "c", "脂質": "f" };
    $("macroBar").innerHTML = n.macros.map((m) => `<div class="macro-seg ${cls[m.name] || "p"}" style="width:${m.pct}%"></div>`).join("");
    $("macroList").innerHTML = n.macros.map((m) => `
      <div style="display:flex;justify-content:space-between;align-items:baseline;padding:11px 0;border-top:1px solid var(--line)">
        <div><b style="font-size:15px">${esc(m.name)}</b> <span style="font-size:12px;color:var(--ink-2)">${esc(m.per)}</span><div style="font-size:12.5px;color:var(--ink-2)">${esc(m.note)}</div></div>
        <div style="font-weight:700;font-size:16px;white-space:nowrap">${esc(m.amount)}</div>
      </div>`).join("");
    $("suppChips").innerHTML = n.supplements.map((s) => `
      <span class="chip">${esc(s.name)} <span class="ev ${s.evidence === "強" ? "strong" : ""}">${esc(s.dose)} · 根拠${esc(s.evidence)}</span></span>`).join("");

    $("zoneList").innerHTML = D.zones.map((z) => `
      <div class="zone-row ${z.core ? "core" : ""}">
        <div class="zone-tag">${esc(z.z)}</div>
        <div>
          <div class="zone-name">${esc(z.name)}${z.core ? ' <span style="font-size:11px;color:var(--accent);font-weight:700">← 練習の中心</span>' : ""}</div>
          <div class="zone-meta">${esc(z.hr)} bpm · ${esc(z.pace)} · ${esc(z.purpose)}</div>
        </div>
      </div>`).join("");
  }

  /* ====================================================== SCIENCE / REVIEW / HISTORY / CTA */
  function renderScience() {
    $("researchGrid").innerHTML = D.research.map((r) => `
      <div class="r-card">
        <div class="r-card__t">${esc(r.title)}</div>
        <div class="r-card__b">${esc(r.body)}</div>
        <div class="r-card__d">${esc(r.date)} 反映</div>
      </div>`).join("");
  }
  function renderReview() {
    $("strList").innerHTML = D.review.strengths.map((s) => `<li>${esc(s)}</li>`).join("");
    $("rskList").innerHTML = D.review.risks.map((s) => `<li>${esc(s)}</li>`).join("");
    $("historyTl").innerHTML = D.history.map((h) => `
      <div class="tl-item"><div class="tl-date">${esc(h.date)}</div><div class="tl-text">${esc(h.text)}</div></div>`).join("");
  }
  function renderCTA() {
    const r = D.race;
    $("ctaRace").innerHTML = `
      <div class="r-name">${esc(r.name)}</div>
      <div class="r-date">${esc(r.date)} · ${esc(r.type)}</div>
      <div class="r-goal">目標 ${esc(r.goal)}</div>`;
  }

  /* ====================================================== SPEC (tech specs) */
  function renderSpec() {
    const a = D.meta.athlete;
    const metric = (n) => D.metrics.find((m) => m.name === n) || {};
    const req = (n) => D.requirements.find((r) => r.metric === n) || {};
    const cal = D.nutrition.calories;
    const active = D.phases.find((p) => p.active) || {};
    const groups = [
      { title: "身体 / Body", rows: [
        ["氏名", a.name],
        ["年齢", `${a.age} 歳（${a.birth}）`],
        ["性別 / 身長", `${a.sex} / ${a.height} cm`],
        ["体重（現在）", `${metric("体重").value || "—"}（${metric("体重").date || ""}）`],
        ["目標体重", "65.0 kg"],
        ["BMI", `${req("BMI").now || "—"} → 目標 ${req("BMI").need || "—"}`],
      ]},
      { title: "生理 / Physiology", rows: [
        ["最大心拍数", "187 bpm（Tanaka式）"],
        ["VO2max", `${req("VO2max").now || "—"} → 必要 ${req("VO2max").need || "—"}`],
        ["HRV（直近）", `${metric("HRV（直近）").value || "—"} → 目標 ${metric("HRV（直近）").target || "—"}`],
        ["安静時HR", `${metric("安静時HR（直近）").value || "—"} → 目標 ${metric("安静時HR（直近）").target || "—"}`],
        ["睡眠", `${metric("睡眠（直近）").value || "—"} → 目標 ${metric("睡眠（直近）").target || "—"}`],
      ]},
      { title: "運用 / Operation", rows: [
        ["現在フェーズ", `${D.meta.phase}（${D.meta.phaseWeek}）`],
        ["週間距離目標", `${active.dist || "—"}`],
        ["目標タイム / ペース", `${D.hero.bigStats[0].value} / 4:44 /km`],
        ["カロリー", `BMR ${cal.bmr} · TDEE ${cal.tdee} · 摂取 ${cal.target} kcal`],
        ["目標レース", `${D.race.name}（${D.race.date}）`],
      ]},
    ];
    $("specGrid").innerHTML = groups.map((g) => `
      <div class="spec-group">
        <h3>${esc(g.title)}</h3>
        ${g.rows.map((r) => `<div class="spec-row"><span class="spec-k">${esc(r[0])}</span><span class="spec-v">${esc(r[1])}</span></div>`).join("")}
      </div>`).join("");
  }

  /* ====================================================== SCROLL FX */
  function initReveal() {
    const items = document.querySelectorAll(".reveal");
    if (!("IntersectionObserver" in window)) { items.forEach((i) => i.classList.add("in")); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          // fire progress bars when gates reveal
          e.target.querySelectorAll(".progress-fill[data-w]").forEach((p) => { p.style.width = p.dataset.w + "%"; });
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    items.forEach((i) => io.observe(i));
  }
  function initParallax() {
    const glow = $("heroGlow");
    if (!glow) return;
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const y = window.scrollY;
        glow.style.transform = `translateY(${y * 0.35}px) scale(${1 + y * 0.0004})`;
        ticking = false;
      });
    }, { passive: true });
  }

  /* ====================================================== BOOT */
  function boot() {
    if (!D) { console.error("MARATHON_DATA missing"); return; }
    renderHero();
    renderToday();
    renderHighlights();
    renderStatus();
    renderWeek();
    renderRuns();
    renderChartTabs();
    drawChart();
    renderGates();
    renderPhases();
    renderReq();
    renderFuel();
    renderScience();
    renderReview();
    renderCTA();
    renderSpec();
    initReveal();
    initParallax();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  /* ====================================================== PWA: service worker */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("sw.js").catch((e) => console.warn("SW登録失敗:", e));
    });
  }
})();
