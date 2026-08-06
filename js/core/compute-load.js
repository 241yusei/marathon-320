/* =========================================================================
 *  health-os / core — compute-load.js（ランと筋トレを1つの物差しで足す）
 *  --------------------------------------------------------------------------
 *  この計算の存在理由:
 *    ランは心拍が取れる。筋トレは取れない。距離も比べられない。
 *    それでも「今週どれだけ体に負荷をかけたか」を1つの数で言えないと、
 *    総合的な疲労管理はできない。
 *
 *    session-RPE（Foster 2001）だけが、両方に同じ形で適用できる。
 *      負荷[AU] = セッションRPE(0〜10) × 所要時間(分)
 *
 *  根拠: docs/strength-research.md §8
 *    §8-1 session-RPE（Foster 2001）
 *    §8-2 単調性 monotony と ストレイン strain（Foster 1998）
 *    §8-3 ACWR（Gabbett 2016）★ただし単独閾値では判断しない（Impellizzeri 2020）
 *
 *  ★重要な設計方針:
 *    ここは「警報」を出すだけで、結論を封鎖しない。
 *    結論を封じるのは compute-datahealth.js の欠測ブロックだけにする。
 *    根拠の弱い指標（ACWR）に自動停止の権限を与えない、という切り分け。
 * ========================================================================= */

(function () {
  "use strict";

  const HOS = window.HEALTH_OS;
  const DAY = 86400000;

  const iso = (d) => d.toISOString().slice(0, 10);
  const addDays = (dateISO, n) => {
    const d = new Date(dateISO + "T00:00:00");
    d.setDate(d.getDate() + n);
    return iso(d);
  };

  /* --------------------------------------------------- 1セッションの負荷 */
  function sessionLoad(rpe, minutes) {
    if (rpe == null || minutes == null) return null;
    const r = Number(rpe), m = Number(minutes);
    if (!(r >= 0) || !(m > 0)) return null;
    return r * m;
  }

  /* ------------------------------------------------ 全セッションの収集 */
  /* ラン（HEALTH_OS.data.running.sessions）と筋トレ（store）を同じ形に揃える。
   *
   * ランに sRPE が入っていない場合の扱い:
   *   欠測として null を返し、estimated:true では **埋めない**。
   *   推定で埋めると「データがある」ように見えてしまい、
   *   7/27 の zoneCompliance 88% と同じ失敗を繰り返す。
   *   ただし心拍が実測されている場合に限り、HRベースの代替推定を
   *   estimated フラグ付きで出す（表示側が区別できるようにする）。
   */
  function collect(days) {
    const D = HOS.data;
    const out = [];
    const cut = addDays(iso(new Date()), -(days || 28));

    /* --- ラン --- */
    ((D.running && D.running.sessions) || []).forEach((s) => {
      if (!s.date || s.date < cut) return;
      const min = s.durationMin || null;
      let load = sessionLoad(s.sRPE, min);
      let estimated = false;

      if (load == null && min && s.hr && typeof s.hr.avg === "number") {
        /* HR から RPE を粗く当てる。Z1≈2, Z2≈3, Z3≈5, Z4≈7, Z5≈9 */
        const hr = s.hr.avg;
        const r = hr < 131 ? 2 : hr < 150 ? 3 : hr < 159 ? 5 : hr < 172 ? 7 : 9;
        load = r * min;
        estimated = true;
      }
      out.push({
        date: s.date, kind: "run", label: s.label || "ラン",
        minutes: min, rpe: s.sRPE != null ? s.sRPE : null,
        load, estimated,
        distanceKm: s.distanceKm || null,
        hrAvg: (s.hr && s.hr.avg) || null,
      });
    });

    /* --- 筋トレ --- */
    (HOS.store ? HOS.store.sessionsSince(days || 28) : []).forEach((s) => {
      if (!(s.entries || []).length) return;
      const min = s.durationMin || null;
      out.push({
        date: s.date, kind: "strength", label: `筋トレ ${s.split}`,
        minutes: min, rpe: s.sRPE != null ? s.sRPE : null,
        load: sessionLoad(s.sRPE, min), estimated: false,
        sets: s.entries.length,
        volumeKg: HOS.compute.sessionVolume ? Math.round(HOS.compute.sessionVolume(s)) : null,
      });
    });

    return out.sort((a, b) => (a.date < b.date ? -1 : 1));
  }

  /* ------------------------------------------------------- 日次に畳む */
  function daily(days) {
    const n = days || 28;
    const items = collect(n);
    const today = iso(new Date());
    const map = {};
    for (let i = n - 1; i >= 0; i--) {
      const d = addDays(today, -i);
      map[d] = { date: d, load: 0, run: 0, strength: 0, estimated: 0, items: [], hasGap: false };
    }
    items.forEach((it) => {
      const row = map[it.date];
      if (!row) return;
      row.items.push(it);
      if (it.load == null) { row.hasGap = true; return; }
      row.load += it.load;
      row[it.kind] += it.load;
      /* ★推定由来の負荷を別勘定で持つ。表示側で実測と見分けられるようにするため。
       * 推定値を実測と同じ見た目で出したことが、7/27のゾーン遵守率88%（実測33%）
       * を22日間放置した直接の原因だった。同じ失敗を構造で防ぐ。 */
      if (it.estimated) row.estimated += it.load;
    });
    return Object.keys(map).sort().map((k) => map[k]);
  }

  /* ------------------------------------- 週間負荷・単調性・ストレイン */
  /* Foster 1998:
   *   monotony = 週の平均日次負荷 ÷ その標準偏差
   *   strain   = 週間総負荷 × monotony
   *   目安: monotony 2.0 未満。高いほど「毎日同じ」で不調・傷害が増える。 */
  function weekly(offsetWeeks) {
    const d = daily(28);
    const off = offsetWeeks || 0;
    const end = d.length - off * 7;
    const week = d.slice(Math.max(0, end - 7), end);
    if (!week.length) return null;

    const loads = week.map((x) => x.load);
    const total = loads.reduce((a, b) => a + b, 0);
    const mean = total / week.length;
    const sd = Math.sqrt(loads.reduce((a, b) => a + (b - mean) ** 2, 0) / week.length);

    /* ★単調性は「負荷のある日が3日以上」ある週でしか意味を持たない。
     * 1〜2セッションしか無い週で計算すると、単に「休みが多い」ことを
     * 低い単調性として報告してしまい、指標が読み手を誤らせる。
     * 足りないときは null を返し、UI 側は「—」と出す。 */
    const activeDays = loads.filter((x) => x > 0).length;
    const enough = activeDays >= 3;
    const monotony = (enough && sd > 0) ? mean / sd : null;
    const strain = monotony != null ? total * monotony : null;

    return {
      from: week[0].date, to: week[week.length - 1].date,
      total: Math.round(total),
      activeDays,
      monotonyReady: enough,
      run: Math.round(week.reduce((a, x) => a + x.run, 0)),
      strength: Math.round(week.reduce((a, x) => a + x.strength, 0)),
      estimated: Math.round(week.reduce((a, x) => a + x.estimated, 0)),
      restDays: week.filter((x) => x.load === 0).length,
      monotony: monotony == null ? null : Math.round(monotony * 100) / 100,
      strain: strain == null ? null : Math.round(strain),
      hasGap: week.some((x) => x.hasGap),
      days: week,
    };
  }

  /* ------------------------------------------------------------- ACWR */
  /* 直近7日 ÷ 過去28日の平均週負荷。0.8〜1.3が目安とされる。
   * ★ただし Impellizzeri 2020 が方法論的な問題を指摘しており、
   *   本アプリでは警報としてのみ扱い、判断を自動で止めない。 */
  function acwr() {
    const d = daily(28);
    if (d.length < 28) return null;
    const acute = d.slice(-7).reduce((a, x) => a + x.load, 0);
    const chronic = d.reduce((a, x) => a + x.load, 0) / 4;   /* 28日→週換算 */

    /* ★慢性負荷の土台が無いうちは比を出さない。
     * 記録初日は「直近7日 = 全期間」なので比が必ず跳ね上がり、
     * 常にスパイク警報が出る。それは実態ではなく履歴不足の症状であり、
     * 意味のない赤字を出すと本物の警報まで無視されるようになる。
     * 過去21日（＝直近7日を除く期間）に3日以上の記録が要る。 */
    const priorActive = d.slice(0, 21).filter((x) => x.load > 0).length;
    if (priorActive < 3 || !(chronic > 0)) {
      return { insufficient: true, priorActive, needDays: 3,
               acute: Math.round(acute), chronic: Math.round(chronic) };
    }

    const ratio = acute / chronic;
    return {
      acute: Math.round(acute),
      chronic: Math.round(chronic),
      ratio: Math.round(ratio * 100) / 100,
      zone: ratio < 0.8 ? "low" : ratio <= 1.3 ? "ok" : ratio <= 1.5 ? "high" : "spike",
    };
  }

  /* ----------------------------------------------------------- 警報 */
  /* 「止める」ではなく「気づかせる」。文言は必ず理由と根拠を伴わせる。 */
  function alerts() {
    const out = [];
    const w = weekly(0);
    const prev = weekly(1);
    const a = acwr();

    if (w && !w.monotonyReady && w.total > 0) {
      out.push({
        level: "info", key: "monotony-thin",
        text: `記録のある日が ${w.activeDays} 日のため、単調性はまだ計算していません`,
        why: "単調性は「毎日同じ負荷になっていないか」を見る指標なので、3日以上の記録が要ります。薄いデータで数字を出すと、単に休みが多いことを良い状態と誤読させます",
      });
    }
    if (w && w.monotony != null && w.monotony >= 2.0) {
      out.push({
        level: "warn", key: "monotony",
        text: `単調性 ${w.monotony}（目安 2.0未満）。負荷が毎日同じ形になっています`,
        why: "総量が同じでも、強弱の差が小さいほど不調・傷害が増える（Foster 1998）。強い日と休む日をはっきり分けるほうが安全です",
      });
    }
    if (w && w.restDays === 0 && w.total > 0) {
      out.push({
        level: "warn", key: "no-rest",
        text: "この7日間、完全休養日がありません",
        why: "単調性が上がる直接の原因になります。週に1〜2日は負荷ゼロの日を作ってください",
      });
    }
    if (a && a.insufficient && w && w.total > 0) {
      out.push({
        level: "info", key: "acwr-thin",
        text: "急性:慢性負荷比は、慢性負荷の土台ができてから表示します",
        why: `直近7日を除く21日間に記録が ${a.priorActive} 日しかありません。この状態で比を出すと必ずスパイク判定になり、実態ではなく履歴不足を警報してしまいます。3週間ぶん溜まれば自動的に表示されます`,
      });
    }
    if (a && a.zone === "spike") {
      out.push({
        level: "warn", key: "acwr-spike",
        text: `急性:慢性負荷比 ${a.ratio}（直近7日 ${a.acute} AU / 慢性 ${a.chronic} AU）`,
        why: "急な負荷の跳ね上がりです。ただしACWRは単独の安全基準ではなく大まかなアラーム（Impellizzeri 2020）。体感と併せて判断してください",
      });
    }
    if (a && a.zone === "low" && prev && prev.total > 0) {
      out.push({
        level: "info", key: "acwr-low",
        text: `急性:慢性負荷比 ${a.ratio}。慢性負荷に対して直近が軽い`,
        why: "回復期なら正常です。意図せず落ちているなら、積み増す余地があります",
      });
    }
    if (w && w.hasGap) {
      out.push({
        level: "info", key: "srpe-gap",
        text: "RPEが未入力のセッションがあり、週間負荷を過小評価しています",
        why: "session-RPE はランと筋トレを同じ単位で足す唯一の入力です（Foster 2001）。終了30分後に0〜10で入れてください",
      });
    }
    if (w && w.estimated > 0 && w.total > 0) {
      out.push({
        level: "info", key: "estimated-load",
        text: `今週の負荷 ${w.total} AU のうち ${w.estimated} AU（${Math.round(w.estimated / w.total * 100)}%）は、RPEではなく心拍からの推定です`,
        why: "グラフでは推定ぶんを薄い色で描き分けています。推定値を実測と同じ見た目で出したことが、7/27のゾーン遵守率を22日間誤って表示し続けた原因でした。同じ扱いは繰り返しません",
      });
    }
    return out;
  }

  /* --------------------------------------------------------- まとめ */
  function report() {
    const w = weekly(0), p = weekly(1);
    return {
      week: w,
      prevWeek: p,
      delta: (w && p && p.total > 0) ? Math.round((w.total / p.total - 1) * 100) : null,
      acwr: acwr(),
      daily: daily(28),
      alerts: alerts(),
    };
  }

  Object.assign(HOS.compute, {
    sessionLoad, loadDaily: daily, loadWeekly: weekly, acwr,
    loadAlerts: alerts, loadReport: report,
  });

})();
