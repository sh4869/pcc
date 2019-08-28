# update-suggester

typescript library update suggester in npm.

## candidate for name

* Douage(胴上げ)

# logic

1. ライブラリの依存パッケージを取得
2. 依存関係の衝突が発生するかを確認
3. 衝突が発生した場合、古い方を利用している利用元のライブラリを確認（複数コンフリクトしている場合はとりあえずおいておく）
4. そのライブラリをアップデートすると依存先のライブラリが更新されるかどうかを確認
5. 更新される場合、その更新が自動的に可能かどうかを確認
6. suggestする

# やること

* logicTreeじゃなくてPackageDepndecyListから依存関係のコンフリクトが出力できるようにする