# プロジェクトルール

## デプロイルール（必須）

**ファイルを変更・修正したら、必ず最後に Git コミット＆プッシュを行うこと。**

```bash
git add <変更ファイル>
git commit -m "変更内容の説明"
git push origin main
```

- GitHub Pages でホストしているため、push しないとスマホ等の本番環境に反映されない
- `index.html` / `data.json` / `scripts/` などを変更した場合は必ずセットで実行
- push 後、GitHub Pages への反映には最大 1〜2 分かかる場合がある

## プロジェクト概要

- 大谷翔平 成績トラッカー（静的 Web サイト）
- ホスティング: GitHub Pages（`naotokashihara-ops/shoheiotani` リポジトリ）
- データ更新: GitHub Actions（`.github/workflows/update-stats.yml`）が定期実行し `data.json` を更新
- MLB Stats API（`statsapi.mlb.com`）からリアルタイムデータ取得

## ファイル構成

| ファイル | 役割 |
|---|---|
| `index.html` | メインページ（全 UI・JS を含む単一ファイル） |
| `data.json` | GitHub Actions が生成する成績データ |
| `scripts/fetch-stats.js` | データ取得スクリプト（Node.js 18+） |
| `.github/workflows/update-stats.yml` | 自動更新ワークフロー |
