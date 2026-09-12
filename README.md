# 宅建 Study Portal

個人用・ログイン式の宅建学習進捗ポータルの土台です。

## 今回入っているもの
- メールアドレス＋パスワードログイン（Supabase Auth）
- 進捗をSupabaseに保存
- RLS前提のSQL
- 1/2/3周目＋チェック日
- 教材別 / 分野別 / 最近やったところ / ホーム
- JSONバックアップ書き出し
- 教材定義と進捗データを分離
- スマホ向けUI
- PWA用manifest

## 大事
`data/` の教材・論点データを後から増やしても、既存の `item_id` を変更しない限り
`progress` テーブルのチェック履歴は残ります。

## セットアップ
1. Supabaseで新規プロジェクトを作成
2. Authenticationで自分のユーザーを1人作成
3. 新規登録を一般公開しない運用にする
4. SQL Editorで `supabase.sql` を実行
5. Project URL と Publishable key（または anon key）を取得
6. `app.js` 冒頭の
   - `YOUR_SUPABASE_URL`
   - `YOUR_SUPABASE_PUBLISHABLE_KEY`
   を置き換える
7. GitHubリポジトリにこのフォルダの中身を置く
8. GitHub Pagesを有効化

## 絶対に入れないもの
Supabaseの `service_role` / secret key はブラウザ用コードに入れないでください。

## 現在の教材データについて
`resources.json` には、会話で確定した教材・デジタルコンテンツを登録済みです。
`topics.json` と `items.json` は動作確認用の一部サンプルです。
次の工程で、各公式目次/PDF/YouTubeから全項目を収集し、正式版に差し替えます。
