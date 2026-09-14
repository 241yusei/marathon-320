#!/usr/bin/env python3
"""~/Downloads に落ちた Apple ヘルスケアの書き出しを見つけて、自動で絞って届ける。

    python3 tools/watch_downloads.py --out ~/"Google Drive/マイドライブ/320"
    python3 tools/watch_downloads.py --slack          # #320 に直接あげる
    python3 tools/watch_downloads.py --dry-run        # 何をするか出すだけ

なぜこれが要るか:
    コーチ（クラウド側のClaude）は使い捨てコンテナで動くので、
    **Mac のファイルシステムには一切さわれない。** ~/Downloads は見えない。
    だから「絞って読み込む」までを自動化するなら、その部分は Mac 側に置くしかない。

    自動化できない工程が1つだけ残る: iPhone の「すべてのヘルスケアデータを書き出す」。
    Apple はここに API を出していないので、手で押すしかない。
    このスクリプトが引き受けるのは **zip が Mac に着いたあとの全部**。

流れ:
    ~/Downloads の 書き出したデータ*.zip / export*.zip を新しい順に見る
      → 未処理のものを health_recent.py に通す（既定8日・全データ型）
      → 出てきた health_recent.zip（数MB）を届ける
      → 処理済みマーカーを残して二度打ちを防ぐ

★ 元の zip は消さない。500MB〜1.5GB あるので消したくなるが、
  こちらの読み違いで再処理したくなることが実際にあった（9/6 の安静時心拍）。
  消すかどうかは本人が決める。
"""
import argparse, hashlib, json, os, subprocess, sys, time
from pathlib import Path

HERE = Path(__file__).resolve().parent
STATE = Path.home() / ".marathon320_watch.json"
PATTERNS = ("書き出したデータ*.zip", "export*.zip", "エクスポート*.zip")
CHANNEL = "C0BUSHJ48R3"  # #320


def newest_export(downloads: Path):
    """~/Downloads でいちばん新しい書き出し zip。無ければ None。"""
    hits = [p for pat in PATTERNS for p in downloads.glob(pat) if p.is_file()]
    return max(hits, key=lambda p: p.stat().st_mtime) if hits else None


def fingerprint(p: Path):
    """中身のハッシュは1GBだと重い。パス＋サイズ＋更新時刻で足りる。"""
    st = p.stat()
    return hashlib.sha1(f"{p}|{st.st_size}|{int(st.st_mtime)}".encode()).hexdigest()


def load_state():
    try:
        return json.loads(STATE.read_text())
    except Exception:
        return {"done": []}


def slack_upload(zip_path: Path, comment: str):
    """Slack へアップロード。SLACK_BOT_TOKEN が要る（files:write スコープ）。"""
    import urllib.request, urllib.parse
    token = os.environ.get("SLACK_BOT_TOKEN")
    if not token:
        sys.exit("SLACK_BOT_TOKEN が未設定。--out でフォルダに置く方式なら token は不要です。")

    def api(method, payload):
        req = urllib.request.Request(
            f"https://slack.com/api/{method}",
            data=urllib.parse.urlencode(payload).encode(),
            headers={"Authorization": f"Bearer {token}",
                     "Content-Type": "application/x-www-form-urlencoded"})
        r = json.loads(urllib.request.urlopen(req).read())
        if not r.get("ok"):
            sys.exit(f"Slack {method} が失敗: {r.get('error')}")
        return r

    size = zip_path.stat().st_size
    up = api("files.getUploadURLExternal", {"filename": zip_path.name, "length": size})
    urllib.request.urlopen(urllib.request.Request(
        up["upload_url"], data=zip_path.read_bytes(), method="POST"))
    api("files.completeUploadExternal", {
        "files": json.dumps([{"id": up["file_id"], "title": zip_path.name}]),
        "channel_id": CHANNEL, "initial_comment": comment})


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--downloads", default=str(Path.home() / "Downloads"))
    ap.add_argument("--days", type=int, default=8, help="既定8日（週7日＋糊しろ1日）")
    ap.add_argument("--out", help="結果の zip を置くフォルダ（Drive の同期フォルダなど）")
    ap.add_argument("--slack", action="store_true", help="#320 に直接あげる")
    ap.add_argument("--force", action="store_true", help="処理済みでもやり直す")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    src = newest_export(Path(a.downloads).expanduser())
    if not src:
        print("書き出し zip が見つかりません。何もしません。")
        return 0

    fp = fingerprint(src)
    state = load_state()
    if fp in state["done"] and not a.force:
        print(f"処理済み: {src.name}（--force でやり直せます）")
        return 0

    age_h = (time.time() - src.stat().st_mtime) / 3600
    print(f"対象: {src}  {src.stat().st_size/1e6:.0f}MB  {age_h:.1f}時間前")
    if a.dry_run:
        print(f"[dry-run] health_recent.py --days {a.days} --zip に通します")
        return 0

    subprocess.run([sys.executable, str(HERE / "health_recent.py"),
                    str(src), "--days", str(a.days), "--zip"], check=True)

    out_zip = Path("health_recent.zip")
    if not out_zip.exists():
        sys.exit("health_recent.zip が出力されていません。上のログを見てください。")

    comment = (f"直近{a.days}日ぶんの書き出しです（{src.name} から自動抽出）。"
               f"{out_zip.stat().st_size/1e6:.1f}MB")
    if a.slack:
        slack_upload(out_zip, comment)
        print("Slack #320 にあげました。")
    if a.out:
        dest = Path(a.out).expanduser()
        dest.mkdir(parents=True, exist_ok=True)
        target = dest / f"health_recent_{time.strftime('%Y%m%d')}.zip"
        target.write_bytes(out_zip.read_bytes())
        print(f"置きました: {target}")
    if not a.slack and not a.out:
        print(f"出力: {out_zip.resolve()}（--out か --slack で自動で届きます）")

    state["done"] = (state["done"] + [fp])[-20:]
    STATE.write_text(json.dumps(state))
    return 0


if __name__ == "__main__":
    sys.exit(main())
