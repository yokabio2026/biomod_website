#!/usr/bin/env python3
"""HTMLの崩れを検出する簡易チェック（Python標準ライブラリのみで動作）。

使い方（ターミナルで、サイトのフォルダを開いた状態で）:
    python3 tools/check_html.py

チェックする内容:
  - タグの閉じ忘れ・閉じ間違い（<p> に対する </p> がない、など）
  - 必須の記述（DOCTYPE、style.css / script.js の読み込み、<main> が1つ）
  - id の重複
  - リンク先・画像・スクリプトのファイルが存在するか
  - ナビゲーションのメニューが、全ページで同じ内容か
  - メニューにあるページが、サイト内検索の対象(script.js の PAGES)に入っているか（警告のみ）

sandbox*.html（練習用ページ）は自由に書き換えてよいので、問題があっても警告だけで失敗にしません。
エラーが1件でもあれば終了コード1で終わります（GitHub Actionsが「失敗」と表示します）。
"""
import os
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# 閉じタグを書かない要素（<br> や <img> など）
VOID_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "source", "track", "wbr",
}

# ローカルファイルを指す属性（リンク先が存在するか調べる）
LOCAL_REF_ATTRS = {"a": "href", "img": "src", "video": "src", "audio": "src",
                   "script": "src", "link": "href", "source": "src"}

IN_GITHUB_ACTIONS = os.environ.get("GITHUB_ACTIONS") == "true"


def exists_exact_case(base_dir, relative_path):
    """ファイルが存在し、大文字・小文字まで一致しているかを調べる。

    WindowsやMacは大文字小文字を区別しないため、`Photo.JPG` と書いても手元では表示されます。
    しかし公開先（Linux）では別のファイル扱いになり、画像が表示されなくなります。
    それを手元でも見つけられるよう、実際のファイル名と1つずつ照合します。
    """
    current = Path(base_dir)
    for part in Path(relative_path).parts:
        if part in (".", ""):
            continue
        if part == "..":
            current = current.parent
            continue
        if not current.is_dir() or part not in os.listdir(current):
            return False
        current = current / part
    return True


class PageChecker(HTMLParser):
    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.problems = []      # (行, メッセージ)
        self.stack = []         # 開いているタグ [(タグ名, 開始行)]
        self.ids = {}           # id -> 最初に出てきた行
        self.main_count = 0
        self.has_style_link = False
        self.has_script = False
        self.nav_hrefs = []     # <ul class="nav-links"> の中のリンク
        self._nav_depth = None  # nav-links の <ul> を開いたときのスタックの深さ

    def problem(self, message):
        self.problems.append((self.getpos()[0], message))

    # --- タグの開始 ---
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)

        if tag == "main":
            self.main_count += 1
        if tag == "link" and attrs.get("href") == "style.css":
            self.has_style_link = True
        if tag == "script" and attrs.get("src") == "script.js":
            self.has_script = True

        element_id = attrs.get("id")
        if element_id:
            if element_id in self.ids:
                self.problem(f'id="{element_id}" が重複しています（最初は{self.ids[element_id]}行目）')
            else:
                self.ids[element_id] = self.getpos()[0]

        ref_attr = LOCAL_REF_ATTRS.get(tag)
        if ref_attr and attrs.get(ref_attr):
            self.check_local_reference(tag, attrs[ref_attr])

        if tag == "ul" and "nav-links" in (attrs.get("class") or "").split():
            self._nav_depth = len(self.stack)
        if tag == "a" and self._nav_depth is not None and attrs.get("href"):
            self.nav_hrefs.append(attrs["href"])

        if tag not in VOID_TAGS:
            self.stack.append((tag, self.getpos()[0]))

    # --- タグの終了 ---
    def handle_endtag(self, tag):
        if tag in VOID_TAGS:
            return
        if self.stack and self.stack[-1][0] == tag:
            self.stack.pop()
        elif any(open_tag == tag for open_tag, _ in self.stack):
            # 途中のタグが閉じられていない
            while self.stack and self.stack[-1][0] != tag:
                open_tag, line = self.stack.pop()
                self.problem(f"<{open_tag}>（{line}行目）が </{open_tag}> で閉じられていません")
            self.stack.pop()
        else:
            self.problem(f"</{tag}> に対応する開始タグ <{tag}> がありません")

        if self._nav_depth is not None and tag == "ul" and len(self.stack) == self._nav_depth:
            self._nav_depth = None

    def check_local_reference(self, tag, value):
        if re.match(r"^(https?:|//|mailto:|tel:|data:|#|javascript:)", value):
            return
        target = value.split("#")[0].split("?")[0]
        if not target:
            return
        if not exists_exact_case(self.path.parent, target):
            self.problem(f"<{tag}> が指しているファイル「{value}」が見つかりません（ファイル名・フォルダ・大文字小文字を確認）")

    # --- 最後に行う確認 ---
    def finish(self, text):
        for open_tag, line in self.stack:
            self.problems.append((line, f"<{open_tag}> が閉じられていません（</{open_tag}> がありません）"))
        if not text.lstrip().lower().startswith("<!doctype html"):
            self.problems.append((1, "先頭に <!DOCTYPE html> がありません"))
        if not self.has_style_link:
            self.problems.append((1, '<link rel="stylesheet" href="style.css"> がありません'))
        if not self.has_script:
            self.problems.append((1, '<script src="script.js"></script> がありません'))
        if self.main_count != 1:
            self.problems.append((1, f"<main> がちょうど1つ必要ですが、{self.main_count}個あります"))
        self.problems.sort(key=lambda p: p[0])


def find_html_files():
    files = []
    for path in sorted(ROOT.rglob("*.html")):
        relative_parts = path.relative_to(ROOT).parts
        if any(part.startswith(".") or part == "node_modules" for part in relative_parts):
            continue
        files.append(path)
    return files


def is_sandbox(path):
    return path.name.startswith("sandbox")


def report(kind, path, line, message):
    relative = path.relative_to(ROOT).as_posix()
    if IN_GITHUB_ACTIONS:
        print(f"::{kind} file={relative},line={line}::{message}")
    else:
        label = "エラー" if kind == "error" else "警告"
        print(f"[{label}] {relative}:{line}  {message}")


def search_pages_from_script():
    script = ROOT / "script.js"
    if not script.exists():
        return None
    match = re.search(r"const PAGES = \[(.*?)\];", script.read_text(encoding="utf-8"), re.S)
    return set(re.findall(r"'([^']+\.html)'", match.group(1))) if match else None


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    files = find_html_files()
    if not files:
        print("HTMLファイルが見つかりませんでした")
        return 1

    error_count = 0
    warning_count = 0
    nav_by_page = {}

    for path in files:
        text = path.read_text(encoding="utf-8")
        checker = PageChecker(path)
        checker.feed(text)
        checker.close()
        checker.finish(text)

        # 練習用ページは自由に書き換えてよいので、問題があっても警告だけにする
        kind = "warning" if is_sandbox(path) else "error"
        for line, message in checker.problems:
            report(kind, path, line, message)
            if kind == "error":
                error_count += 1
            else:
                warning_count += 1

        if not is_sandbox(path):
            nav_by_page[path.name] = checker.nav_hrefs

    # ナビゲーションのメニューが全ページで同じか
    if nav_by_page:
        reference_page = "index.html" if "index.html" in nav_by_page else next(iter(nav_by_page))
        reference_nav = nav_by_page[reference_page]
        for page_name, nav in nav_by_page.items():
            if nav != reference_nav:
                report("error", ROOT / page_name, 1,
                       f"ナビゲーションのメニューが {reference_page} と違います（メニューは全ページで同じにしてください）")
                error_count += 1

        # メニューにあるページが、サイト内検索の対象に入っているか
        search_pages = search_pages_from_script()
        if search_pages is not None:
            for href in reference_nav:
                if href.endswith(".html") and href not in search_pages:
                    report("warning", ROOT / "script.js", 1,
                           f"メニューにある {href} が、サイト内検索の対象（script.js の PAGES）に入っていません")
                    warning_count += 1

    print(f"\nチェックしたHTML: {len(files)}ファイル / エラー {error_count}件 / 警告 {warning_count}件")
    if error_count:
        print("エラーがあります。上の内容を直してから、もう一度確認してください。")
        return 1
    print("問題は見つかりませんでした。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
