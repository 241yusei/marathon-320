#!/usr/bin/env python3
"""筋トレの記録を読んで、コーチが見る形に畳む。

使い方は2つ。

  # ① Hevy などの書き出しCSVから
  python3 tools/strength_log.py hevy_workouts.csv

  # ② チャットに書く1行から（アプリを使っていない日）
  python3 tools/strength_log.py --text "8/30 スクワット 90x5x3 RIR2 / ベンチ 60x8x3 RIR3 / ステップダウン 自重x10x3"

出すもの:
  ・種目ごとの e1RM（Epley＋RIR）とトップセット
  ・週間セット数
  ・傷害予防種目が入っているかの点検（docs/strength-research.md §5）
  ・★下り対策の偏心種目が入っているかの点検（10/25 の首都高区間対策）
  ・js/data.js の dailyLog にそのまま貼れる1行

CSVの列名は決め打ちしない。アプリの仕様変更で壊れないよう、
見出しを小文字化して部分一致で探す（weight / reps / rpe / exercise / date …）。
"""
import argparse, csv, io, re, sys, datetime as dt
from collections import defaultdict, OrderedDict

# ---------------------------------------------------------------- 点検リスト
# 最も抜けやすい3種目（docs/strength-research.md §5）
INJURY = {
    "nordic":  ("ノルディックハムストリング", ("nordic", "ノルディック", "ハムストリングカール")),
    "calf":    ("シーテッドカーフレイズ",     ("seated calf", "シーテッドカーフ", "カーフレイズ")),
    "plank":   ("サイドプランク",             ("side plank", "サイドプランク")),
}
# 10/25 の首都高の下り対策（大腿四頭筋の偏心収縮）
ECCENTRIC = {
    "stepdown": ("ステップダウン",   ("step down", "step-down", "ステップダウン", "step down")),
    "squat":    ("スクワット系",     ("squat", "スクワット", "レッグプレス", "leg press")),
    "lunge":    ("ランジ／スプリット", ("lunge", "ランジ", "split squat", "スプリットスクワット", "bulgarian")),
}


def norm(s):
    return re.sub(r"\s+", " ", (s or "")).strip().lower()


def e1rm(w, reps, rir):
    """Epley＋RIR。w × (1 + (reps + rir) / 30)"""
    if not w or not reps:
        return None
    return w * (1 + (reps + (rir or 0)) / 30)


# ---------------------------------------------------------------- CSV 読み取り
def pick(headers, *cands):
    """見出しを部分一致で探す。最初に当たったものを返す。"""
    low = {h: norm(h) for h in headers}
    for c in cands:
        for h, l in low.items():
            if c in l:
                return h
    return None


def read_csv(path):
    rows = list(csv.DictReader(io.open(path, encoding="utf-8-sig")))
    if not rows:
        sys.exit("行がありません: " + path)
    H = list(rows[0].keys())
    col = {
        "date": pick(H, "start_time", "start time", "date", "日付"),
        "ex":   pick(H, "exercise_title", "exercise", "種目", "title"),
        "w":    pick(H, "weight_kg", "weight", "重量", "kg"),
        "reps": pick(H, "reps", "rep", "回数"),
        "rpe":  pick(H, "rpe", "rir"),
        "sec":  pick(H, "duration_seconds", "duration", "時間"),
        "set":  pick(H, "set_index", "set_order", "set"),
    }
    miss = [k for k in ("date", "ex", "reps") if not col[k]]
    if miss:
        sys.exit("必要な列が見つかりません: " + ", ".join(miss)
                 + "\n見つかった見出し: " + ", ".join(H))
    print("列の対応: " + " / ".join(f"{k}→{v}" for k, v in col.items() if v))

    out = []
    for r in rows:
        d = (r.get(col["date"]) or "")[:10].replace("/", "-")
        name = r.get(col["ex"]) or ""
        if not name:
            continue
        def num(key):
            v = (r.get(col[key]) or "").strip() if col[key] else ""
            try:
                return float(v)
            except ValueError:
                return None
        rpe = num("rpe")
        # Hevy などは RPE（6〜10）で入る。RIR に直す。RIR で入っていればそのまま
        rir = (10 - rpe) if (rpe is not None and rpe > 5) else rpe
        out.append({"date": d, "ex": name, "w": num("w"),
                    "reps": num("reps"), "rir": rir, "sec": num("sec")})
    return out


# ---------------------------------------------------------------- テキスト読み取り
TXT = re.compile(
    r"(?P<ex>[^/,]+?)\s+(?P<w>自重|[\d.]+)\s*[x×]\s*(?P<reps>\d+)\s*[x×]\s*(?P<sets>\d+)"
    r"(?:\s*RIR\s*(?P<rir>[\d.]+))?", re.I)


def read_text(s):
    m = re.match(r"\s*(\d{1,2})[/-](\d{1,2})\s+", s)
    if m:
        y = dt.date.today().year
        date = f"{y}-{int(m.group(1)):02d}-{int(m.group(2)):02d}"
        s = s[m.end():]
    else:
        date = dt.date.today().isoformat()
    out = []
    for m in TXT.finditer(s):
        w = None if m.group("w") in ("自重",) else float(m.group("w"))
        for _ in range(int(m.group("sets"))):
            out.append({"date": date, "ex": m.group("ex").strip(), "w": w,
                        "reps": float(m.group("reps")),
                        "rir": float(m.group("rir")) if m.group("rir") else None,
                        "sec": None})
    if not out:
        sys.exit("解釈できませんでした。例: スクワット 90x5x3 RIR2 / ベンチ 60x8x3")
    return out


# ---------------------------------------------------------------- 集計と出力
def hit(sets, keys):
    names = " ".join(norm(s["ex"]) for s in sets)
    return [lbl for lbl, pats in keys.values() if any(p in names for p in pats)]


def report(sets):
    by_date = defaultdict(list)
    for s in sets:
        by_date[s["date"]].append(s)

    for date in sorted(by_date):
        ss = by_date[date]
        print(f"\n{'='*66}\n■ {date}   {len(ss)} セット")
        ex = OrderedDict()
        for s in ss:
            ex.setdefault(s["ex"], []).append(s)
        print(f"  {'種目':<28}{'セット':>5}{'トップセット':>16}{'e1RM':>9}{'総量kg':>9}")
        for name, g in ex.items():
            vol = sum((s["w"] or 0) * (s["reps"] or 0) for s in g)
            best, top = None, ""
            for s in g:
                v = e1rm(s["w"], s["reps"], s["rir"])
                if v and (best is None or v > best):
                    best = v
                    top = f"{s['w']:.0f}kg×{int(s['reps'])}" + (f" RIR{s['rir']:.0f}" if s["rir"] is not None else "")
            print(f"  {name[:27]:<28}{len(g):>5}{top:>16}"
                  f"{(f'{best:.1f}' if best else '—'):>9}{(f'{vol:.0f}' if vol else '—'):>9}")

        rir = [s["rir"] for s in ss if s["rir"] is not None]
        if rir:
            avg = sum(rir) / len(rir)
            judge = "追い込みすぎ" if avg <= 1 else "軽すぎ" if avg >= 4 else "目標どおり"
            print(f"\n  平均RIR {avg:.1f} → {judge}（目標 2〜3 / docs/strength-research.md §8-4）")
        else:
            print("\n  RIR の記録なし → 追い込み具合を判定できない")

    print(f"\n{'='*66}\n■ 期間の点検")
    got_i = hit(sets, INJURY)
    miss_i = [lbl for lbl, _ in INJURY.values() if lbl not in got_i]
    print("  傷害予防種目（§5）: " + (("入っている → " + "、".join(got_i)) if got_i else "1つも入っていない"))
    if miss_i:
        print("    ★不足: " + "、".join(miss_i) + "  ← 14日入っていなければ要指摘")

    got_e = hit(sets, ECCENTRIC)
    print("  下り対策の偏心種目: " + (("入っている → " + "、".join(got_e)) if got_e else "★入っていない"))
    if not got_e:
        print("    10/25 は24km地点から首都高の上り下りが交互に来る。")
        print("    下ろす局面を3〜4秒かけるスクワット／レッグプレス／ステップダウンを入れる")

    wk = defaultdict(int)
    for s in sets:
        try:
            d = dt.date.fromisoformat(s["date"])
        except ValueError:
            continue
        wk[d.isocalendar()[:2]] += 1
    if wk:
        print("\n  週間セット数: " + " / ".join(f"{y}-W{w}: {n}" for (y, w), n in sorted(wk.items())))

    # dailyLog に貼る1行
    print(f"\n{'='*66}\n■ js/data.js の dailyLog に貼る形")
    for date in sorted(by_date):
        ss = by_date[date]
        ex = OrderedDict()
        for s in ss:
            ex.setdefault(s["ex"], []).append(s)
        head = "、".join(f"{n}{len(g)}セット" for n, g in list(ex.items())[:4])
        detail = " / ".join(
            f"{n} " + "・".join(
                f"{s['w']:.0f}×{int(s['reps'])}" if s["w"] else f"自重×{int(s['reps'])}" for s in g)
            for n, g in ex.items())
        mm, dd = date[5:7], date[8:10]
        md = f"{int(mm)}/{int(dd)}"
        print(f'    {{ date: "{md}", hrv: "—", rhr: "—", sleep: "—", weight: "—", '
              f'run: "筋トレ（{head}）", judge: "筋トレ", note: "{detail}" }},')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csv", nargs="?", help="Hevy などの書き出しCSV")
    ap.add_argument("--text", help='チャット形式。例: "8/30 スクワット 90x5x3 RIR2 / ベンチ 60x8x3"')
    a = ap.parse_args()
    if a.text:
        report(read_text(a.text))
    elif a.csv:
        report(read_csv(a.csv))
    else:
        ap.error("CSV か --text のどちらかを渡してください")


if __name__ == "__main__":
    main()
