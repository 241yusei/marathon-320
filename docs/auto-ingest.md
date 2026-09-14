# 書き出し zip の自動取り込み（2026-09-15）

「~/Downloads に入れておけば、あとは勝手にやってほしい」への答え。

## まず、できないことをはっきりさせる

**コーチ（クラウド側の Claude）は Mac のファイルシステムにさわれない。**
使い捨てのコンテナで動いていて、`~/Downloads` は存在すらしない。
「Downloads を見て」と頼まれてもできない。ここは仕組み上どうにもならない。

**iPhone の「すべてのヘルスケアデータを書き出す」も自動化できない。**
Apple がここに API を出していないので、手で押すしかない。

自動化できるのは、その2つの隙間 —— **zip が Mac に着いたあとの全部**。

```
[手動] iPhone で書き出す → Mac へ転送
          ↓
[自動] ~/Downloads を見張る → 直近8日に絞る（1GB → 数MB）→ 届ける
          ↓
[自動] 私が読む → 分析 → js/data.js 更新 → カレンダー → #320 に所見
```

★ 1GB のまま送れないので、**絞る工程は Mac 側に置くしかない。**
Drive 経由で生 zip を渡す案は、ダウンロードが現実的でないので採らない。

## 使い方

```bash
# 何をするか見るだけ
python3 tools/watch_downloads.py --dry-run

# Drive の同期フォルダに置く（トークン不要・おすすめ）
python3 tools/watch_downloads.py --out ~/"Google Drive/マイドライブ/320"

# Slack #320 に直接あげる（SLACK_BOT_TOKEN が要る）
export SLACK_BOT_TOKEN=xoxb-...
python3 tools/watch_downloads.py --slack
```

- 既定は **直近8日・全データ型**（`--days` で変えられる）
- 同じ zip は二度処理しない（`~/.marathon320_watch.json` にマーカー）。`--force` でやり直せる
- **元の zip は消さない。** 500MB〜1.5GB あるので消したくなるが、
  こちらの読み違いで再処理したくなることが実際にあった（9/6 の安静時心拍・+16bpm の訂正）

## 全自動にする — launchd（Mac が起きていれば動く）

`~/Library/LaunchAgents/com.marathon320.watch.plist` に置いて `launchctl load` する。
**Claude のデスクトップアプリを開いていなくても動く**のが、ローカル定時タスクとの違い。

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.marathon320.watch</string>
  <key>ProgramArguments</key>
  <array>
    <string>/usr/bin/python3</string>
    <string>/Users/fujiiisamusei/Projects/藤井勇成（ヘルスケア）/site/tools/watch_downloads.py</string>
    <string>--out</string>
    <string>/Users/fujiiisamusei/Google Drive/マイドライブ/320</string>
  </array>
  <!-- Downloads に何か落ちるたびに起動する -->
  <key>WatchPaths</key>
  <array><string>/Users/fujiiisamusei/Downloads</string></array>
  <!-- 取りこぼし用に日曜19:00 にも一度 -->
  <key>StartCalendarInterval</key>
  <dict>
    <key>Weekday</key><integer>0</integer>
    <key>Hour</key><integer>19</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>StandardOutPath</key><string>/tmp/marathon320-watch.log</string>
  <key>StandardErrorPath</key><string>/tmp/marathon320-watch.err</string>
</dict>
</plist>
```

```bash
launchctl load  ~/Library/LaunchAgents/com.marathon320.watch.plist
launchctl start com.marathon320.watch      # 手で1回試す
tail -f /tmp/marathon320-watch.log
```

★ `WatchPaths` は「そのフォルダに変化があったら起動」。
ダウンロード中の一時ファイルでも起動するが、対象の zip が無ければ即終了するので害はない。

★ 初回だけ Downloads へのアクセス許可を訊かれる。システム設定 →
プライバシーとセキュリティ → ファイルとフォルダ で `python3` を許可する。

## なぜ Claude のローカル定時タスクにやらせないか

`~/.claude/scheduled-tasks/marathon320-*` はファイルシステムを読めるので、
原理的には同じことができる。実際 9/8 までは動いていた。

ただし **デスクトップアプリが起動していないと発火しない。**
2026-09-09〜09-11 に3日連続で飛び、同時期にクラウド側の朝 Routine も
私が止めていたため、#320 が7日間沈黙した（`docs/daily-loop.md` 参照）。

launchd は OS が持つので、アプリの起動状態に依存しない。
**取り込みだけは、いちばん依存の少ないところに置く。**
