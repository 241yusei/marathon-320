#!/usr/bin/env python3
"""Apple ヘルスケアの書き出しから、直近N日ぶんを **全データ型** 取り出す。

    python3 tools/health_recent.py 書き出したデータ.zip            # 直近8日
    python3 tools/health_recent.py export.zip --days 14
    python3 tools/health_recent.py export.zip --since 2026-09-01
    python3 tools/health_recent.py export.zip --zip                # 結果を1つのzipに

なぜ 8 日か:
    週のサイクルが7日なので、8日にすると1日ぶん重なる。受け渡しの前後で
    半端に切れて取りこぼす事故を防ぐための、意図的な1日の糊しろ。

tools/health_export_split.py との違い:
    あちらは月単位・7種類の決め打ち（hr/hrv/rhr/sleep/weight/vo2max/walking_hr）。
    こちらは **export.xml に入っている型を全部** 自動で見つけて出す。
    ランニングパワー・上下動・接地時間・歩幅・環境音・マインドフルネスなど、
    決め打ちリストからこぼれていたものが拾える。

出力（既定 health_recent/）:
    <型名>.csv          … 型ごとに1枚。列は date,start,end,value,unit,source,device
    workouts.csv        … ワークアウト本体（★ジムの筋トレも含む）
    workout_stats.csv   … ワークアウトに紐づく統計（距離・平均心拍・消費kcal など）
    activity_summary.csv… 1日ごとのムーブ/エクササイズ/スタンド
    _summary.txt        … 型ごとの件数と最初/最後。まずこれを見る

★ export.xml は 500MB〜1.5GB になることがある。全体をメモリに載せず
  iterparse で流し読みし、処理済みの要素を都度捨てている。
"""
import argparse, csv, io, os, re, sys, zipfile, datetime as dt
import xml.etree.ElementTree as ET
from collections import defaultdict

# 出力ファイル名にできない文字を落とす
def slug(type_id):
    """HKQuantityTypeIdentifierVO2Max → vo2_max

    連続する大文字（SDNN・VO2）を1文字ずつ割らないよう2段階で処理する。
    単純な (?=[A-Z]) だと v_o2_max / heart_rate_variability_s_d_n_n になって読めない。"""
    s = re.sub(r"^HK(Quantity|Category|Characteristic)TypeIdentifier", "", type_id)
    s = re.sub(r"^HKDataType", "", s)
    s = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", s)    # ...tRate  → ...t_Rate
    s = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s)   # ...ySDNN  → ...y_SDNN
    s = s.lower()
    return re.sub(r"[^a-z0-9_]+", "_", s).strip("_") or "unknown"


def day_of(s):
    """'2026-09-05 11:56:23 +0900' → '2026-09-05'。取れなければ空文字"""
    return s[:10] if s and len(s) >= 10 and s[4] == "-" else ""


class Out:
    """型ごとに CSV を開きっぱなしにして書き込む。ファイル数が増えても
    開き直さないので、100種類あっても遅くならない。"""
    def __init__(self, root):
        self.root = root
        self.fh, self.w, self.n = {}, {}, defaultdict(int)
        self.first, self.last = {}, {}
        os.makedirs(root, exist_ok=True)

    def row(self, name, header, row, day=""):
        if name not in self.fh:
            f = open(os.path.join(self.root, name + ".csv"), "w",
                     newline="", encoding="utf-8")
            self.fh[name] = f
            self.w[name] = csv.writer(f)
            self.w[name].writerow(header)
        self.w[name].writerow(row)
        self.n[name] += 1
        if day:
            if name not in self.first or day < self.first[name]: self.first[name] = day
            if name not in self.last  or day > self.last[name]:  self.last[name]  = day

    def close(self):
        for f in self.fh.values():
            f.close()


def open_xml(path):
    """zip でも xml でも受ける。zip の中の export.xml を探す。"""
    if path.lower().endswith(".zip"):
        z = zipfile.ZipFile(path)
        cands = [n for n in z.namelist() if n.endswith("export.xml")]
        if not cands:
            sys.exit("zip の中に export.xml が見つかりません: " + ", ".join(z.namelist()[:10]))
        # 書き出し言語によって apple_health_export/export.xml だったりする
        name = sorted(cands, key=len)[0]
        print("  zip 内の " + name + " を読みます")
        return z.open(name)
    return open(path, "rb")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("export", help="書き出したデータ.zip / export.zip / export.xml")
    ap.add_argument("-o", "--out", default="health_recent")
    ap.add_argument("--days", type=int, default=8,
                    help="直近N日（既定8。週7日＋糊しろ1日）")
    ap.add_argument("--since", help="YYYY-MM-DD。指定するとこちらが優先")
    ap.add_argument("--zip", action="store_true", help="結果を1つのzipにまとめる")
    a = ap.parse_args()

    cutoff = a.since or (dt.date.today() - dt.timedelta(days=a.days)).isoformat()
    print("抽出範囲: " + cutoff + " 以降")

    out = Out(a.out)
    seen_all = defaultdict(int)      # 期間外も含めた全体の型リスト（何があるかを知るため）
    n_rec = n_wk = 0

    fh = open_xml(a.export)
    ctx = ET.iterparse(fh, events=("start", "end"))
    _, root = next(ctx)              # ルートを掴んでおく（あとで捨てるため）

    for event, el in ctx:
        if event != "end":
            continue
        tag = el.tag

        if tag == "Record":
            t = el.get("type", "")
            seen_all[t] += 1
            start = el.get("startDate", "")
            d = day_of(start)
            if d >= cutoff:
                out.row(slug(t),
                        ["date", "start", "end", "value", "unit", "source", "device"],
                        [d, start, el.get("endDate", ""), el.get("value", ""),
                         el.get("unit", ""), el.get("sourceName", ""),
                         (el.get("device") or "")[:80]], d)
                n_rec += 1

        elif tag == "Workout":
            start = el.get("startDate", "")
            d = day_of(start)
            if d >= cutoff:
                wt = el.get("workoutActivityType", "")
                out.row("workouts",
                        ["date", "start", "end", "type", "duration_min",
                         "total_distance", "total_energy", "source"],
                        [d, start, el.get("endDate", ""),
                         re.sub(r"^HKWorkoutActivityType", "", wt),
                         el.get("duration", ""), el.get("totalDistance", ""),
                         el.get("totalEnergyBurned", ""), el.get("sourceName", "")], d)
                # 新しい書き出しは距離や平均心拍が子要素の WorkoutStatistics に入る
                for st in el.findall("WorkoutStatistics"):
                    out.row("workout_stats",
                            ["date", "workout_start", "type", "sum", "average",
                             "minimum", "maximum", "unit"],
                            [d, start, slug(st.get("type", "")), st.get("sum", ""),
                             st.get("average", ""), st.get("minimum", ""),
                             st.get("maximum", ""), st.get("unit", "")], d)
                n_wk += 1

        elif tag == "ActivitySummary":
            d = el.get("dateComponents", "")
            if d >= cutoff:
                out.row("activity_summary",
                        ["date", "move_kcal", "move_goal", "exercise_min",
                         "exercise_goal", "stand_hours", "stand_goal"],
                        [d, el.get("activeEnergyBurned", ""),
                         el.get("activeEnergyBurnedGoal", ""),
                         el.get("appleExerciseTime", ""),
                         el.get("appleExerciseTimeGoal", ""),
                         el.get("appleStandHours", ""),
                         el.get("appleStandHoursGoal", "")], d)

        if tag in ("Record", "Workout", "ActivitySummary", "Correlation", "ClinicalRecord"):
            el.clear()
            root.clear()             # 兄弟の蓄積を捨てる。これが無いとメモリが膨らむ

    fh.close()
    out.close()

    # ---------------------------------------------------------------- 要約
    lines = []
    lines.append("抽出範囲: " + cutoff + " 以降")
    lines.append("Record " + str(n_rec) + " 件 / Workout " + str(n_wk) + " 件")
    lines.append("")
    lines.append("%-38s %8s  %s" % ("ファイル", "件数", "最初 〜 最後"))
    lines.append("-" * 78)
    for name in sorted(out.n, key=lambda k: -out.n[k]):
        lines.append("%-38s %8d  %s 〜 %s" % (
            name + ".csv", out.n[name], out.first.get(name, "?"), out.last.get(name, "?")))

    # 期間内に1件も無かった型を、全体の型リストから炙り出す
    got = {slug(t) for t in seen_all}
    empty = sorted(slug(t) for t in seen_all if slug(t) not in out.n)
    if empty:
        lines.append("")
        lines.append("★ この期間に1件も無かった型（全期間には存在する）:")
        for name in empty:
            lines.append("    " + name)

    text = "\n".join(lines)
    print("\n" + text)
    with open(os.path.join(a.out, "_summary.txt"), "w", encoding="utf-8") as f:
        f.write(text + "\n")

    if a.zip:
        zpath = a.out.rstrip("/") + ".zip"
        with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED) as z:
            for fn in sorted(os.listdir(a.out)):
                z.write(os.path.join(a.out, fn), fn)
        print("\n→ " + zpath + " にまとめました。これを Slack の #320 に貼ってください")


if __name__ == "__main__":
    main()
