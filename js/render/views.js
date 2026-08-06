/* =========================================================================
 *  health-os / render — views.js（ビュー分割ルーター）
 *  --------------------------------------------------------------------------
 *  なぜ必要か（2026-08-06 の計測）:
 *    23セクション・41,452px・**49画面ぶんのスクロール**・21,364文字。
 *    そして筋トレの最初の入力欄に到達するまで **12.6画面ぶんスクロール**していた。
 *    ジムでセット間に開く道具として成立していない。
 *
 *    原因は装飾ではなく構造。1枚のページに性質の違う2つのプロダクトが同居していた。
 *      ・読み物 … 週1回コーチの分析を読む（今週の方針・達成可能性・研究）
 *      ・道具   … 毎日/ジムで開いて数十秒で用を済ませる（チェックイン・筋トレ入力）
 *    スクロール1本に並べると、道具が読み物の下に埋まる。
 *
 *  対策:
 *    利用頻度でセクションを5つのビューに束ね、1度に1ビューだけ描く。
 *    既存の render 関数には一切触らない（DOM の表示/非表示だけを切り替える）。
 *
 *  ★タブに「要対応」のドットを出す。どこへ行けばよいかを本人に考えさせない。
 * ========================================================================= */

(function () {
  "use strict";

  const HOS = window.HEALTH_OS;

  /* 利用頻度の高い順。左から右が「毎日 → 週1回」になるよう並べている */
  const VIEWS = [
    /* ★この配列の順序が、そのまま画面上の並び順になる（reorder が DOM を並べ替える）。
     * HTML のソース順ではなく「先にやることが上」で並べる。
     * 元の並びだとヒーローとデータ状態が先にあり、朝のチェックイン欄に着くまで
     * 4.3画面ぶんスクロールしていた。 */
    { id: "today", label: "今日", icon: "sun", sections: [
      { id: "top", nav: false }, { id: "checkin", nav: "今朝" },
      { id: "today", nav: "指針" }, { id: "data", nav: "データ状態" } ] },
    /* ★種目ライブラリはここに置かない。
     * 各種目の解説リンクは筋トレ画面のカード内に既にある。一覧の方は
     * 「調べ物」であって「今やること」ではないので、知識ビューへ回す。
     * ここに置くと、セット入力にたどり着くまでに一覧を通過することになる。 */
    { id: "train", label: "筋トレ", icon: "dumbbell", sections: [
      { id: "train", nav: false } ] },
    { id: "log", label: "記録", icon: "chart", sections: [
      { id: "load", nav: "疲労と負荷" }, { id: "vault", nav: "書き出し" },
      { id: "runs", nav: "ランログ" }, { id: "trend", nav: "トレンド" } ] },
    { id: "plan", label: "計画", icon: "flag", sections: [
      { id: "week", nav: "今週" }, { id: "gates", nav: "ゲート" },
      { id: "odds", nav: "達成可能性" }, { id: "req", nav: "必要条件" },
      { id: "plan", nav: "フェーズ" }, { id: "status", nav: "現在地" },
      { id: "highlights", nav: false } ] },
    { id: "know", label: "知識", icon: "book", sections: [
      { id: "library", nav: "種目" }, { id: "fuel", nav: "栄養" },
      { id: "science", nav: "研究" }, { id: "review", nav: "強みとリスク" },
      { id: "story", nav: "経緯" }, { id: "spec", nav: "全仕様" },
      { id: "cta", nav: false } ] },
  ];

  const ICONS = {
    sun: '<path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M17.7 6.3l-1.4 1.4M7.7 16.3l-1.4 1.4"/><circle cx="12" cy="12" r="3.6"/>',
    dumbbell: '<path d="M4 9v6M7 7v10M17 7v10M20 9v6M7 12h10"/>',
    chart: '<path d="M4 20V10M10 20V5M16 20v-7M22 20H2"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 3.5L16 11H5"/>',
    book: '<path d="M5 4h9a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H5V4Z"/><path d="M17 7h2v13H8"/>',
  };

  const byId = {};
  const sectionView = {};
  VIEWS.forEach((v) => {
    byId[v.id] = v;
    v.sections.forEach((s) => { sectionView[s.id] = v.id; });
  });

  let active = null;

  /* ------------------------------------------------------- 要対応の判定 */
  /* 「今どこに行けばよいか」をタブ自身に語らせる。
   * 数字のバッジは煽りになるので、静かなドット1つに留める。 */
  function badges() {
    const out = {};
    const store = HOS.store;
    const today = store ? store.todayISO() : null;

    /* 今日: 朝のチェックインが未入力 */
    if (store && today && !store.checkinOn(today)) out.today = "今朝のコンディションが未入力";

    /* 筋トレ: 今日まだ1セットも入れていない、かつ今週の予定が残っている */
    if (store) {
      const P = HOS.data.strengthProgram;
      const doneToday = store.sessionsOn(today).some((s) => (s.entries || []).length);
      if (!doneToday && P) {
        const ws = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); })();
        const done = new Set(store.sessions().filter((s) => s.date >= ws && (s.entries || []).length).map((s) => s.split));
        const phase = (P.periodization || []).find((x) => x.active) || P.periodization[0];
        const left = phase.split.filter((k) => !done.has(k)).length;
        if (left > 0) out.train = `今週あと${left}回`;
      }
    }

    /* 記録: 未書き出しのセッションが溜まっている */
    if (store) {
      const st = store.stats();
      if (st.unexportedSessions) out.log = `${st.unexportedSessions}件が未書き出し`;
    }

    /* 計画: 欠測でL2以上（督促段階）のデータがある */
    if (HOS.compute && typeof HOS.compute.dataHealth === "function") {
      try {
        const r = HOS.compute.dataHealth();
        if (r.escalated && r.escalated.length) out.today = out.today ||
          `${r.escalated.length}件のデータが不足しています`;
      } catch (e) { /* 欠測検知が落ちてもタブは出す */ }
    }
    return out;
  }

  /* ----------------------------------------------------------- 描画 */
  /* すべてのセクションを1つの入れ物に集め、VIEWS の宣言順に並べ替える。
   * HTML のソース順は「読み物として上から読む」前提で組まれているため、
   * 道具として使う順序（先にやることが上）とは一致しない。
   * DOM を動かしても getElementById は効くので、既存の render 関数は無傷。 */
  function reorder() {
    let root = document.getElementById("viewRoot");
    if (!root) {
      root = document.createElement("main");
      root.id = "viewRoot";
      const footer = document.querySelector(".footer");
      if (footer && footer.parentNode) footer.parentNode.insertBefore(root, footer);
      else document.body.appendChild(root);
    }
    VIEWS.forEach((v) => v.sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) root.appendChild(el);       /* 既存ノードの移動。再生成はしない */
    }));
  }

  function buildBar() {
    if (document.getElementById("viewBar")) return;
    const bar = document.createElement("nav");
    bar.id = "viewBar";
    bar.className = "vbar";
    bar.setAttribute("aria-label", "ビュー切り替え");
    /* ★body の末尾ではなくヘッダ直後に入れる。
     * position:sticky は「自分の本来の位置」から効くため、末尾に置くと
     * デスクトップでページ最下部に貼り付いてしまう（スマホの fixed では気づけない）。 */
    const nav = document.querySelector(".nav");
    if (nav && nav.parentNode) nav.parentNode.insertBefore(bar, nav.nextSibling);
    else document.body.insertBefore(bar, document.body.firstChild);
  }

  function paintBar() {
    const bar = document.getElementById("viewBar");
    if (!bar) return;
    const b = badges();
    bar.innerHTML = VIEWS.map((v) => `
      <button class="vtab ${v.id === active ? "is-on" : ""}" data-view="${v.id}"
        ${v.id === active ? 'aria-current="page"' : ""}
        ${b[v.id] ? `title="${b[v.id]}"` : ""}>
        <svg class="vtab__i" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[v.icon]}</svg>
        <span class="vtab__l">${v.label}</span>
        ${b[v.id] ? '<span class="vtab__dot" aria-hidden="true"></span>' : ""}
      </button>`).join("");

    bar.querySelectorAll("[data-view]").forEach((el) => {
      el.addEventListener("click", () => go(el.dataset.view, true));
    });

    /* 要対応があるビューの説明を1行だけ出す。ドットだけだと何のことか分からない */
    const notes = VIEWS.filter((v) => b[v.id]).map((v) => `${v.label}: ${b[v.id]}`);
    const hint = document.getElementById("viewHint");
    if (hint) {
      hint.innerHTML = notes.length
        ? notes.map((n) => `<span>${n}</span>`).join("")
        : "";
      hint.hidden = !notes.length;
    }
  }

  /* 長文の折りたたみ。
   * 週の判定理由が実測で1,536字・1,443pxの1ブロックになっていた。
   * 内容は残す価値があるが、既定で全部見せると他の項目に到達できない。
   * 4行に畳んで「続きを読む」を出す。 */
  /* 実測して長かった箇所だけを対象にする（憶測でクラス名を並べない）。
   * とくに .verdict__reason は「今日」ビューにあり、1,536字あった。
   * 毎日開く画面の一等地が長文で埋まると、その下の項目に到達しない。 */
  const CLAMP_TARGETS = [
    ".verdict__reason",   // 今日の判定理由（1,536字）
    ".judge-pill .reason", // 今週の判定理由（同文）
    ".gate__why",          // ゲートの根拠（879字）
    ".chart-note",         // トレンドの注記（390字）
    ".dlog__note",         // 日次ログの所見（最長418字）
    ".fac__note",          // 達成可能性のファクター注記
  ].join(", ");
  const CLAMP_MIN_CHARS = 300;

  function clampLongText(scope) {
    (scope || document).querySelectorAll(CLAMP_TARGETS).forEach((el) => {
      if (el.dataset.clamped) return;
      const text = (el.innerText || "").replace(/\s/g, "");
      if (text.length < CLAMP_MIN_CHARS) return;
      el.dataset.clamped = "1";

      const body = document.createElement("span");
      body.className = "clampable__body";
      while (el.firstChild) body.appendChild(el.firstChild);
      el.appendChild(body);
      el.classList.add("clampable", "is-clamped");

      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "clampable__more";
      btn.textContent = `続きを読む（残り約${Math.max(1, Math.round((text.length - 120) / 100) * 100)}字）`;
      btn.addEventListener("click", () => {
        const open = el.classList.toggle("is-clamped");
        btn.textContent = open ? "続きを読む" : "閉じる";
      });
      el.appendChild(btn);
    });
  }

  function apply(viewId) {
    Object.keys(sectionView).forEach((sec) => {
      const el = document.getElementById(sec);
      if (!el) return;
      const on = sectionView[sec] === viewId;
      el.hidden = !on;
      if (on) {
        /* 非表示のあいだ IntersectionObserver が発火していないので、
         * スクロール連動のフェードインを手動で解除する。
         * これをしないと、切り替えた先が真っ白に見える */
        el.querySelectorAll(".reveal").forEach((r) => r.classList.add("in"));
        clampLongText(el);
      }
    });
    document.body.dataset.view = viewId;
    paintSubNav(viewId);
  }

  /* ビュー内の移動。計画ビューは6セクションあるので、中でも迷わせない */
  function paintSubNav(viewId) {
    const box = document.getElementById("navSub");
    if (!box) return;
    const v = byId[viewId];
    const items = (v ? v.sections : []).filter((s) => s.nav && document.getElementById(s.id));
    box.innerHTML = items.length > 1
      ? items.map((s) => `<a href="#${s.id}">${s.nav}</a>`).join("")
      : "";
  }

  function go(viewId, push) {
    if (!byId[viewId]) viewId = VIEWS[0].id;
    active = viewId;
    apply(viewId);
    paintBar();
    if (push) {
      try { history.replaceState(null, "", "#/" + viewId); } catch (e) {}
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }

  /* URL から初期ビューを決める。
   * 旧来のセクション直リンク（#train, #gates …）も生かす。
   * 過去にブックマークやカレンダーの説明文へ貼ったリンクを壊さないため。 */
  function fromHash() {
    const h = (location.hash || "").replace(/^#\/?/, "");
    if (!h) return null;
    if (byId[h]) return { view: h, scrollTo: null };
    if (sectionView[h]) return { view: sectionView[h], scrollTo: h };
    return null;
  }

  function sync() {
    const t = fromHash();
    const v = t ? t.view : VIEWS[0].id;
    active = v;
    apply(v);
    paintBar();
    if (t && t.scrollTo) {
      const el = document.getElementById(t.scrollTo);
      if (el) setTimeout(() => el.scrollIntoView({ block: "start", behavior: "auto" }), 0);
    }
  }

  HOS.render.register({
    /* 全セクションが描き終わってから束ねる */
    id: "views", order: 990, pillar: null, mount: null,

    fn() {
      reorder();
      buildBar();
      sync();

      /* セクション直リンク（サブナビ・本文中のリンク）は hashchange で拾う */
      window.addEventListener("hashchange", sync);

      /* 入力のたびにバッジを描き直す（チェックイン済み・記録済みが即反映される） */
      if (HOS.store && typeof HOS.store.onChange === "function") {
        HOS.store.onChange(() => { try { paintBar(); } catch (e) {} });
      }
    },
  });

  HOS.views = { go, all: VIEWS, current: () => active };

})();
