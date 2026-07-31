/* =========================================================================
 *  health-os / data — _boot.js（名前空間の初期化・最初に読む）
 *  --------------------------------------------------------------------------
 *  ヘルス/パフォーマンスOS のルート名前空間 window.HEALTH_OS を1回だけ作る。
 *  以降のファイルは Object.assign(HEALTH_OS.data, {...}) 形式で自己登録するので、
 *  このファイルより後であれば読み込み順は問わない（docs/architecture.md A-2）。
 *
 *  ・ES Modules は使わない。README の「index.html をブラウザで開くだけ」を守るため、
 *    classic script + window 名前空間で構成する（file:// では type="module" が
 *    CORS でブロックされる／docs/architecture.md 0-4）。
 *  ・追加時は index.html の <script> と sw.js の CORE[]・CACHE 更新が必須。
 * ========================================================================= */

window.HEALTH_OS = window.HEALTH_OS || { config: {}, data: {}, compute: {}, judgment: {}, render: {} };
