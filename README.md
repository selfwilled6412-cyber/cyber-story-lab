# CYBER STORY LAB v0.5

B型利用者本人が作者になる4コマ漫画制作Webアプリ。AIは「困った時の質問」「文章→作画指示」「本人原画の任意仕上げ」だけを担当し、物語を勝手に完成・修正しません。

## 今できること
- お題 → 主役 → 4コマを1問ずつ制作
- ヒントは段階式。AI未接続でもローカル補助で動作
- A4 1枚 = 1コマの作画指示
- 原画4枚の撮影/アップロード、ブラウザ内軽量化、簡易線補正
- 2×2 / 縦4コマの完成レイアウト
- IndexedDBの「作品棚」へ複数作品を保存・再開・削除
- 5作品で「第1巻」へ進む進捗表示
- A4比率のPNG保存
- Cloudflare Worker + Gemini API接続用バックエンド実装済み

## AI設計
- Text: `gemini-3.1-flash-lite`（短いヒント・作画指示。低コスト/無料枠を優先）
- Image: `gemini-3.1-flash-lite-image`（原画を尊重した任意仕上げ。低コスト優先）
- APIキーはフロントへ置かず Cloudflare Worker secret `GEMINI_API_KEY` に保存
- AI画像仕上げは利用者/スタッフが明示的に押したコマだけ実行

## 公開時のAI保護
`AI_ACCESS_PIN` をCloudflare Secretとして設定すると、課金が発生するAI APIだけスタッフPINで保護できます。通常の4コマ制作画面、文章入力、原画アップロード、作品棚はそのまま利用でき、AI補助を押した時だけPINが必要になります。

## ローカルでUIだけ確認
`public/index.html` をブラウザで開く。AIは OFFLINE DEMO 表示になるが、制作フローは使えます。

## CloudflareでAI込み確認
1. `npm install`
2. `.dev.vars.example` を `.dev.vars` にコピーし、`GEMINI_API_KEY` と `AI_ACCESS_PIN` を設定
3. `npm run dev`
4. 表示された localhost URL を開く

## テスト
- `npm run check`
- `npm test`

## 本番
Cloudflare Worker Secretsへ `GEMINI_API_KEY` と `AI_ACCESS_PIN` を登録してから `npm run deploy`。
