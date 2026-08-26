#!/usr/bin/env python3
"""Apple ヘルスケアの書き出し（export.xml）から、必要な系統だけを月別CSVに切り出す。

  python3 tools/health_export_split.py 書き出したデータ.zip -o out --months 1

出力（health_monthly/YYYY-MM/ と同じ構成）:
  hrv.csv         datetime,ms,source           ← 起床時HRVの判断に使う。時刻が要る
  rhr.csv         datetime,bpm,source
  hr.csv          datetime,bpm,source          ← ゾーン計算の元。件数が多い
  walking_hr.csv  datetime,bpm,source
  vo2max.csv      datetime,ml_kg_min,source
  weight.csv      datetime,kg,source
  sleep.csv       date,start,end,hours,stage,source
  workouts.csv    date,type,start,end,duration_min,distance_km,energy_kcal,source

注意: 心拍は GPX には入っていない。必ず export.xml の <Record> から取る
（2026-07 に「心拍が欠測している」と誤診したのは、GPXだけを読んでいたため）。
"""
import argparse, csv, datetime as dt, io, os, re, sys, zipfile
import xml.etree.ElementTree as ET

QUANTITY = {
    "HKQuantityTypeIdentifierHeartRateVariabilitySDNN": ("hrv.csv", "ms", 1.0),
    "HKQuantityTypeIdentifierRestingHeartRate":         ("rhr.csv", "bpm", 1.0),
    "HKQuantityTypeIdentifierHeartRate":                ("hr.csv", "bpm", 1.0),
    "HKQuantityTypeIdentifierWalkingHeartRateAverage":  ("walking_hr.csv", "bpm", 1.0),
    "HKQuantityTypeIdentifierVO2Max":                   ("vo2max.csv", "ml_kg_min", 1.0),
    "HKQuantityTypeIdentifierBodyMass":                 ("weight.csv", "kg", 1.0),
    "HKQuantityTypeIdentifierBodyFatPercentage":        ("bodyfat.csv", "pct", 100.0),
}
TS = re.compile(r"^(\d{4})-(\d{2})-(\d{2}) ")


def parse_dt(s):
    # "2026-07-01 13:34:04 +0900"
    try:
        return dt.datetime.strptime(s, "%Y-%m-%d %H:%M:%S %z")
    except ValueError:
        return None


def month_of(s):
    m = TS.match(s or "")
    return f"{m.group(1)}-{m.group(2)}" if m else None


class Out:
    """月×ファイル名ごとに開いたCSVを使い回す。"""

    def __init__(self, root):
        self.root, self.f, self.w = root, {}, {}

    def row(self, month, name, header, row):
        key = (month, name)
        if key not in self.w:
            d = os.path.join(self.root, month)
            os.makedirs(d, exist_ok=True)
            fh = io.open(os.path.join(d, name), "w", encoding="utf-8", newline="")
            self.f[key] = fh
            self.w[key] = csv.writer(fh)
            self.w[key].writerow(header)
        self.w[key].writerow(row)

    def close(self):
        for fh in self.f.values():
            fh.close()
        return sorted({m for m, _ in self.f})


def open_xml(path):
    if path.lower().endswith(".zip"):
        z = zipfile.ZipFile(path)
        names = [n for n in z.namelist() if n.endswith("/export.xml") or n == "export.xml"]
        if not names:
            sys.exit("zip の中に export.xml が見つかりません: " + ", ".join(z.namelist()[:5]))
        return z.open(names[0])
    return io.open(path, "rb")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("export", help="書き出したデータ.zip か export.xml のパス")
    ap.add_argument("-o", "--out", default="health_monthly")
    ap.add_argument("--months", type=int, default=1, help="直近Nか月だけ出す（0=全期間）")
    ap.add_argument("--since", help="YYYY-MM-DD。指定するとこちらが優先")
    a = ap.parse_args()

    if a.since:
        cutoff = dt.date.fromisoformat(a.since)
    elif a.months:
        cutoff = dt.date.today() - dt.timedelta(days=31 * a.months)
    else:
        cutoff = dt.date.min

    out, n_rec, n_wk, skipped = Out(a.out), 0, 0, 0

    with open_xml(a.export) as fh:
        for _, el in ET.iterparse(fh, events=("end",)):
            if el.tag == "Record":
                spec = QUANTITY.get(el.get("type"))
                start = el.get("startDate")
                if spec and start:
                    d = parse_dt(start)
                    if d and d.date() >= cutoff:
                        name, unit, mul = spec
                        try:
                            v = float(el.get("value")) * mul
                        except (TypeError, ValueError):
                            v = None
                        if v is not None:
                            out.row(month_of(start), name, ["datetime", unit, "source"],
                                    [start, round(v, 4), el.get("sourceName", "")])
                            n_rec += 1
                elif el.get("type") == "HKCategoryTypeIdentifierSleepAnalysis":
                    s, e = el.get("startDate"), el.get("endDate")
                    ds, de = parse_dt(s), parse_dt(e)
                    if ds and de and ds.date() >= cutoff:
                        out.row(month_of(s), "sleep.csv",
                                ["date", "start", "end", "hours", "stage", "source"],
                                [ds.date().isoformat(), s, e,
                                 round((de - ds).total_seconds() / 3600, 3),
                                 (el.get("value") or "").replace("HKCategoryValueSleepAnalysis", ""),
                                 el.get("sourceName", "")])
                        n_rec += 1

            elif el.tag == "Workout":
                s, e = el.get("startDate"), el.get("endDate")
                ds = parse_dt(s)
                if ds and ds.date() >= cutoff:
                    # 新しい書き出しは totalDistance を持たず WorkoutStatistics に入れる
                    dist, kcal = el.get("totalDistance"), el.get("totalEnergyBurned")
                    for st in el.findall("WorkoutStatistics"):
                        t = st.get("type", "")
                        if t.endswith("DistanceWalkingRunning") or t.endswith("DistanceCycling"):
                            dist = dist or st.get("sum")
                        elif t.endswith("ActiveEnergyBurned"):
                            kcal = kcal or st.get("sum")
                    out.row(month_of(s), "workouts.csv",
                            ["date", "type", "start", "end", "duration_min",
                             "distance_km", "energy_kcal", "source"],
                            [ds.date().isoformat(),
                             (el.get("workoutActivityType") or "").replace("HKWorkoutActivityType", ""),
                             s, e, el.get("duration", ""), dist or "", kcal or "",
                             el.get("sourceName", "")])
                    n_wk += 1
                else:
                    skipped += 1
            else:
                continue
            el.clear()

    months = out.close()
    print(f"{cutoff} 以降を書き出し: レコード {n_rec} 件 / ワークアウト {n_wk} 件")
    print("対象月: " + (", ".join(months) if months else "なし"))
    for m in months:
        d = os.path.join(a.out, m)
        for f in sorted(os.listdir(d)):
            print(f"  {m}/{f}  {os.path.getsize(os.path.join(d, f)):,} bytes")


if __name__ == "__main__":
    main()
