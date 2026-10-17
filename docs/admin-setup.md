# 管理者向け 初期設定手順

「チームだけが見られる・編集できる」状態にするための、最初の1回だけの設定です。
**所要時間の目安：1〜2時間。** 管理者2〜3人で分担すると安全です。

> ⚠️ 画面の名前や場所は、GitHub や Cloudflare の更新で変わることがあります。
> 見つからないときは、画面の英語名で検索するか、Claude に相談してください。

## 現在の状態と、この手順書の使いどころ（2026年10月時点）

- GitHub のリポジトリ（`yokabio2026/biomod_website`）は **Public**、サイトは **GitHub Pages** で公開中です。
- **今は「公開のまま」運用します。** その間は、この手順書の **1〜3（GitHubとメンバーの設定）だけ**が必要です。
  - 公開の間は、サイトも履歴も誰でも見られます。個人情報・未発表のデータ・提出前の内容は載せないでください。
  - 公開の間は、Pull Request ごとの「確認用URL」は出ません（GitHub Pages にはその機能がないため）。
    `README.md` の 5 のとおり、HTMLチェックが緑なら Merge → 公開サイトで確認 → 崩れたら Revert、で運用します。
- **あとで「チームだけ」にしたくなったら**、**4・5（Cloudflare）** を行い、動作を確認してから GitHub を Private に切り替えます。
  Cloudflare のアカウントは作成済みです。サイトのデータは作り直す必要がありません。
  （Private にすると GitHub Pages は止まるので、必ず Cloudflare での公開を確認してから切り替えてください。）

---

## 0. 先に知っておくこと

### ① 無料プランの非公開リポジトリでは、`main` への直接書き込みを禁止できません
GitHub の無料プランでは、「`main` ブランチを保護する（必ず確認を通さないと公開できない）」設定が
**公開リポジトリでしか使えません**。非公開リポジトリで使うには有料プランが必要です。
（[GitHub公式：rulesets の対応プラン](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)）

チームだけに限定したい場合は、次のどれかを選びます。

| 選択肢 | 内容 |
|---|---|
| A. 無料のまま運用ルールで補う（おすすめの出発点・**今回の方針**） | 「`main` に直接書かない。必ず Pull Request」をルールにし、**チェックが緑・見た目OKなら、各自が自分で Merge** する（管理者の承認は不要）。ミスしても Revert で戻せる。 |
| B. 有料プラン（GitHub Team など） | 保護設定が使える。人数分の費用がかかる。料金は GitHub の料金ページで確認。 |
| C. 学生向けの無料枠を確認 | 大学のチームなら、教育向けの優遇がないか確認する価値あり（条件は GitHub Education で確認）。 |

まずは A で始めて、不安なら B・C を検討する、で十分です。

### ② 「ログイン制限」は公開先（Cloudflare）側でかけます
GitHub を非公開にしても、**公開したサイトは別**です。サイトの閲覧をチームだけにするには、
Cloudflare の **Access** で「メンバーのメールアドレスだけ許可」を設定します。
無料枠は50人までです（[Cloudflare Access](https://www.cloudflare.com/en-au/products/cloudflare-access)）。

### ③ アカウントの考え方
- **GitHub：1人1アカウント**。共有アカウントは使いません（規約上も、履歴・セキュリティ上も良くありません）。
- 共有メールアドレスは、Organization の**連絡先・請求先メール**として登録します。
- 管理者（Owner）は**2〜3人**にして、誰かが入れなくなっても止まらないようにします。

---

## 1. GitHub のアカウントと Organization

1. 管理者（2〜3人）が、それぞれ自分のメールで GitHub アカウントを作ります。
2. 全員、次を設定します。
   - **二段階認証**を有効にする（Settings → Password and authentication）
   - **Keep my email addresses private** をオンにする（履歴にメールアドレスが載らないようにする）
3. 管理者の1人が **Organization（Free）** を作ります（右上 ＋ → New organization）。
   - 連絡先メールには、**チームの共有メール**を入れます。
4. ほかの管理者を、Organization の **Owner** に追加します。

## 2. リポジトリを作って、サイトを最初にアップロードする

1. Organization の中で **New repository** を作ります。
   - 名前：例 `yokabio-site`
   - **Private（非公開）** を選ぶ
   - README などの初期ファイルは**追加しない**（空のまま作る）
2. このフォルダ（`BIOMOD Website`）をターミナルで開き、次を実行します（URLは作成したリポジトリのもの）。

```bash
git add .
git commit -m "最初のコミット"
git branch -M main
git remote add origin https://github.com/組織名/yokabio-site.git
git push -u origin main
```

> `git commit` で名前とメールを聞かれたら、先に次を設定してください（メールは GitHub の noreply アドレスが安心です）。
> `git config --global user.name "あなたの名前"` / `git config --global user.email "あなたのGitHubのnoreplyアドレス"`

3. GitHub のリポジトリ画面で、ファイルが表示されること、**Actions** タブの「HTMLチェック」が緑になることを確認します。

## 3. メンバーを招待する

1. Organization の **People → Invite member** で、各メンバーを招待します（メンバーはGitHubアカウントを作ってから受け取る）。
2. リポジトリの **Settings → Collaborators and teams** で、メンバーに **Write** 権限を渡します。
   - 管理者は **Admin**、一般メンバーは **Write** が目安です。
3. メンバーに `README.md` を読んでもらいます。

## 4. Cloudflare Pages で公開する

1. Cloudflare のアカウントを作ります（管理者の個人メールで。共有メールを使う場合は、パスワードを共有しない運用を決める）。
2. **Workers & Pages → Create → Pages → Connect to Git** で GitHub と連携します。
   - 非公開リポジトリを使うには、GitHub 側の「Cloudflare Workers & Pages」アプリに、**このリポジトリへのアクセスを許可**する必要があります。
     （[Cloudflare公式：GitHub連携](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/)）
3. 設定は次のとおりです（ビルド不要の静的サイトです）。
   - Production branch：`main`
   - Framework preset：`None`
   - Build command：（空欄）
   - Build output directory：`/`（またはルートを指す値）
4. デプロイが終わると、`https://プロジェクト名.pages.dev` が表示されます。

> 以後、`main` が更新されるたびに自動で公開されます。Pull Request ごとに「確認用URL」も作られます。

## 5. Cloudflare Access で「メンバーだけ」にする

1. Cloudflare の **Zero Trust**（初回はチーム名の登録が必要）を開きます。
2. **Access → Applications → Add an application → Self-hosted** を作ります。
   - 守る対象：手順4の公開URL。**確認用URL（`*.プロジェクト名.pages.dev`）も同じ設定で守ってください。**
     守らないと、確認用URLは誰でも見られる状態になります。
     Pages の設定に Access を有効にする項目があれば、それを使うのが簡単です。
3. **Policy** を作ります。
   - Action：Allow
   - Include：**Emails** に、メンバー全員のメールアドレスを登録
     （大学のメールなど同じドメインなら **Emails ending in** でまとめて許可もできます）
4. ログイン方法は **One-time PIN**（メールに届く6桁の数字）が簡単です。

### 動作確認（必ずやる）
- **シークレットウィンドウ**で公開URLを開き、**ログイン画面が出る**ことを確認します。
- 許可していないメールアドレスでは入れない、許可したメールではPINで入れる、を確認します。
- Pull Request の確認用URLでも、同じようにログイン画面が出ることを確認します。

## 6. 日常の運用

- **変更の流れ**：メンバーがブラウザで編集 → Pull Request → 確認用URL・HTMLチェックを**自分で確認** → **自分で Merge**。
  管理者の承認は必須にしません。（詳しくは `README.md` の 5）
- **管理者がときどき見ること**（承認ではなく、見守り）：
  - 公開サイトが崩れていないか（Cloudflare Pages の **Deployments** に失敗がないか）
  - HTMLチェックが赤いまま Merge されていないか
  - `script.js` や `style.css` が、予告なく大きく変わっていないか
  - 崩れていたら、**Revert** で戻し、チャットで原因を共有する
- **戻したいとき**：Merge 済みの Pull Request → **Revert**。
- **節目のバックアップ（タグ）**：提出前など。

```bash
git tag backup-2026-11-01
git push origin backup-2026-11-01
```

  GitHub の画面なら **Releases → Draft a new release** でも作れます。
  戻したいときは、そのタグの状態をもとに新しい Pull Request を作ります。

## 7. 困ったとき

| 症状 | 確認すること |
|---|---|
| 公開サイトが更新されない | Cloudflare Pages の **Deployments** に失敗がないか／`main` に Merge されているか |
| 確認用URLが見られない | Access の対象に確認用URL（`*.pages.dev`）が入っているか |
| HTMLチェックが赤い | Actions の中身に、行番号つきで原因が出ています |
| メンバーがログインできない | Access のメール一覧に入っているか／迷惑メールにPINが届いていないか |
| 誰かが `main` に直接書いてしまった | 慌てずに、その変更を **Revert** する。ルールを再周知する |
