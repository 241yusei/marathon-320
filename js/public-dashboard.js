(function () {
  "use strict";
  const D = window.PUBLIC_320;
  const el = (id) => document.getElementById(id);
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const date = (v) => v.replace(/-/g, "/");
  const km = (v) => Number(v).toFixed(2);
  const cell = (v) => "<td>" + esc(v === null ? "記載なし" : v) + "</td>";
  const stat = (label, value, note) => '<div class="public-stat"><p class="public-stat__label">' + esc(label) + '</p><p class="public-stat__value">' + esc(value) + '</p><p class="public-stat__note">' + esc(note) + "</p></div>";
  if (!D || D.schemaVersion !== 1) {
    el("freshness").textContent = "公開データを読み込めませんでした。再読み込みしてください。";
    return;
  }
  const R = D.running;
  el("pageUpdated").textContent = date(D.meta.pageUpdated);
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const remaining = Math.round((Date.parse(R.raceDate + "T00:00:00Z") - Date.parse(today + "T00:00:00Z")) / 86400000);
  el("runningStats").innerHTML = stat("確認済みの完了週", km(R.totalKm) + " km", date(R.weekStart) + "〜" + date(R.weekEnd) + "・" + R.runs + "本") +
    stat("最後に確認できたラン", km(R.lastRunKm) + " km", date(R.lastRunDate) + "の記録") +
    stat("横浜マラソン", remaining >= 0 ? "あと" + remaining + "日" : date(R.raceDate), remaining >= 0 ? date(R.raceDate) + " 開催予定" : "開催日後の結果は未確認");
  el("freshness").textContent = "ページ更新 " + date(D.meta.pageUpdated) + " ／ ランニング記録の確認は " + date(D.meta.runningRecordThrough) + " まで。それ以降の実績は未確認です。";
  const beforeReview = today <= R.reassessmentDate;
  el("nextAction").innerHTML = "<h3>新しい実績を確認して、計画と照合する。</h3><p>" +
    esc(date(D.meta.runningRecordThrough) + "以降のラン記録をまとめ、距離・実施日・補給の記録を確認。未報告の練習を実施済みにしない。") +
    "</p><p>" + esc(beforeReview ? date(R.reassessmentDate) + "に予定されている出走見直しに、実績を反映する。" : date(R.reassessmentDate) + "に予定されていた出走見直しの結果は未確認。実施の有無と最新の計画を確認する。") + "</p>";
  el("runningPeriod").textContent = date(R.weekStart) + "〜" + date(R.weekEnd) + "の完了週。";
  el("runningCards").innerHTML = stat("週間実績", km(R.totalKm) + " km / " + R.runs + "本", R.consecutiveRunStart && R.consecutiveRunEnd ? date(R.consecutiveRunStart) + "〜" + date(R.consecutiveRunEnd) + "に連続ラン。新しい実績は未受領。" : "新しい実績は未受領。") +
    stat("最後のラン記録", km(R.lastRunKm) + " km", date(R.lastRunDate) + "。今日の状態や本番の完走見込みに置き換えない。");
  el("runningPlan").innerHTML = '<dl class="public-plan"><dt>既存の週計画</dt><dd>' +
    esc(date(R.planStart) + "〜" + date(R.planEnd) + "：回復優先・最終調整。最大" + R.planMaxKm + "kmの既存上限（必達ではない）。実施・達成は未確認。") +
    '</dd><dt>大会と見直し</dt><dd>' + esc("横浜 " + date(R.raceDate) + "。出走見直し予定 " + date(R.reassessmentDate) + "。") +
    '</dd><dt>長期目標</dt><dd>' + esc(R.longTermYear + "年秋 " + R.longTermTime + "。目標と実績は別。") + "</dd></dl>";
  const C = D.checkup;
  el("checkupDate").textContent = "受診日 " + date(C.measuredAt) + "。現在値ではなく、この日の健診記録。";
  el("checkupSummary").textContent = "総合判定 " + C.rows.find((r) => r.id === "overall").grade + "。原本の値と判定を分けて表示。";
  const labels = {
    overall: "総合", bloodPressure: "血圧（最高 / 最低）", glucose: "血糖（空腹時）", hba1c: "HbA1c", uricAcid: "尿酸",
    ldl: "LDLコレステロール", totalCholesterol: "総コレステロール", hdl: "HDLコレステロール", triglycerides: "中性脂肪（空腹時）",
    liver: "肝機能（AST / ALT / γ-GTP / ALP）", renal: "腎尿路（Cr / eGFR）", urine: "尿蛋白 / 尿潜血", ecg: "心電図",
    vision: "裸眼視力（右 / 左）", hearing: "聴力", body: "BMI / 腹囲", metabolic: "メタボ判定"
  };
  const literal = { annualCheckup: "日常生活に注意し、年1回の健診", negative: "陰性", firstDegreeAVBlock: "Ⅰ度房室ブロック", "1000findings4000none": "左右1000Hz所見あり / 左右4000Hz所見なし", notApplicable: "非該当" };
  function value(v, id) {
    const result = Array.isArray(v) ? v.map((x) => x === null ? "記載なし" : (literal[x] || x)).join(" / ") : (v === null ? "記載なし" : (literal[v] || v));
    return String(result) + (id === "liver" ? "（ALPはIFCC法）" : "");
  }
  el("checkupRows").innerHTML = C.rows.map((r) => "<tr>" + cell(labels[r.id]) + cell(value(r.value, r.id)) + cell(r.grade === null ? "個別記載なし" : r.grade) + "</tr>").join("");
  const S = D.skin;
  el("skinDate").textContent = "撮影日 " + date(S.measuredAt) + "。1回の測定結果。";
  const skinLabels = { pores: "毛穴", wrinkles: "シワ", futureWrinkles: "未来シワ", epidermalPigment: "表皮層色素沈着", melanin: "メラニン", redness: "赤み", brownPigment: "ブラウン色素", sebum: "皮脂", porphyrin: "ポルフィリン", toneUneven: "肌の色ずれ", radiance: "光彩面積" };
  el("skinRows").innerHTML = S.rows.map((r) => "<tr>" + cell(skinLabels[r.id]) + cell(r.measured) + cell(r.ageAverage) + cell(r.display === "combination" ? "U≫T・複合性肌" : r.display) + cell("p" + r.page) + "</tr>").join("");
  const moisture = ["総合", "T", "U"].map((label, i) => label + "：" + (S.moisture[["overall", "t", "u"][i]] === null ? "データなし（none）" : S.moisture[["overall", "t", "u"][i]])).join(" / ");
  el("skinNotes").innerHTML = "<p>" + esc("肌年齢 " + S.deviceAge + "（p2）は機器独自の算出値。医学的な若さの証明ではありません。") +
    "</p><p>" + esc("水分（p2） " + moisture + "。0や乾燥の判定に置き換えません。") +
    "</p><p>" + esc("敏感性（p2）：赤みは5段階で左から" + S.sensitivity.rednessPosition + "番目（橙）、ニキビ関連は" + S.sensitivity.acnePosition + "番目（緑）。p9の赤みGoodは別欄です。") +
    "</p><p>" + esc("くま（p13）は4段階の最も赤い位置。肌トーンは黒くなりやすい側。病気や医学的な良否として扱いません。") + "</p>";
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").catch(() => { /* page remains usable online */ });
  }
})();
