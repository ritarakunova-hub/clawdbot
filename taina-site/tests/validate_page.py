from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

SITE_DIR = Path(__file__).resolve().parents[1]
PAGES = {
    "index.html": {
        "required": [
            "TAINA / AI PRODUCTS & BUSINESS AUTOMATION",
            "TAINA Knowledge Map",
            "TAINA AI Assistant",
            "5 000 ₽",
            "1 490 ₽",
            "Ранний запуск готовится",
            'id="products"',
            'id="solutions"',
            'id="consulting"',
            'name="description"',
            'rel="icon"',
            'href="knowledge-map.html"',
        ],
        "minimum_vk_links": 4,
    },
    "knowledge-map.html": {
        "required": [
            "TAINA",
            "Knowledge Map",
            "1 490 ₽",
            "локальное хранение",
            "облачной синхронизации",
            "Покупка ещё не открыта",
            'name="description"',
            'rel="icon"',
            'href="index.html#products"',
        ],
        "minimum_vk_links": 2,
    },
}
EXPECTED_VK_URL = "https://vk.ru/tainastudio"
VOID_TAGS = {
    "area", "base", "br", "col", "embed", "hr", "img", "input",
    "link", "meta", "param", "source", "track", "wbr"
}


class PageCheck(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.ids = set()
        self.anchors = []
        self.links = []
        self.errors = []
        self.h1_count = 0
        self.form_count = 0
        self.external_font_links = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        element_id = attrs.get("id")
        if element_id:
            if element_id in self.ids:
                self.errors.append("duplicate id: " + element_id)
            self.ids.add(element_id)

        href = attrs.get("href", "")
        if href.startswith("#") and len(href) > 1:
            self.anchors.append(href[1:])
        if href:
            self.links.append((tag, href, attrs))

        if tag == "h1":
            self.h1_count += 1
        if tag == "form":
            self.form_count += 1
        if tag == "link" and any(host in href for host in ("fonts.googleapis.com", "fonts.gstatic.com")):
            self.external_font_links += 1
        if attrs.get("target") == "_blank":
            rel = set((attrs.get("rel") or "").lower().split())
            if not {"noopener", "noreferrer"}.issubset(rel):
                self.errors.append("target=_blank link missing rel=noopener noreferrer")
        if tag not in VOID_TAGS:
            self.stack.append(tag)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID_TAGS and self.stack and self.stack[-1] == tag:
            self.stack.pop()

    def handle_endtag(self, tag):
        if not self.stack:
            self.errors.append("unexpected closing tag: " + tag)
            return
        if self.stack[-1] != tag:
            self.errors.append("mismatched closing tag: " + tag + " (expected " + self.stack[-1] + ")")
            if tag in self.stack:
                while self.stack and self.stack[-1] != tag:
                    self.stack.pop()
                if self.stack:
                    self.stack.pop()
            return
        self.stack.pop()


def main():
    all_errors = []
    parsed = {}

    for filename, config in PAGES.items():
        page = SITE_DIR / filename
        if not page.exists():
            all_errors.append("missing page: " + filename)
            continue

        source = page.read_text(encoding="utf-8")
        parser = PageCheck()
        parser.feed(source)
        parser.close()

        if parser.stack:
            parser.errors.append("unclosed tags: " + ", ".join(parser.stack))
        missing = sorted(set(parser.anchors) - parser.ids)
        if missing:
            parser.errors.append("broken anchor targets: " + ", ".join(missing))
        if parser.h1_count != 1:
            parser.errors.append("expected exactly one h1, found " + str(parser.h1_count))
        if parser.form_count:
            parser.errors.append("forms must remain disabled until privacy/legal review")
        if parser.external_font_links:
            parser.errors.append("external font requests are not expected")

        vk_links = []
        for tag, href, attrs in parser.links:
            parsed_url = urlparse(href)
            if parsed_url.scheme in ("http", "https"):
                if parsed_url.netloc in ("vk.ru", "www.vk.ru"):
                    if href.rstrip("/") != EXPECTED_VK_URL:
                        parser.errors.append("unexpected VK destination: " + href)
                    else:
                        vk_links.append((tag, href, attrs))
            elif not href.startswith("#"):
                local_path = (SITE_DIR / parsed_url.path).resolve()
                if parsed_url.path and not local_path.exists():
                    parser.errors.append("broken local link: " + href)

        if len(vk_links) < config["minimum_vk_links"]:
            parser.errors.append(
                "expected at least " + str(config["minimum_vk_links"]) +
                " VK links, found " + str(len(vk_links))
            )
        for tag, href, attrs in vk_links:
            if tag != "a":
                parser.errors.append("VK destination must be an anchor link: " + href)
            if attrs.get("target") == "_blank":
                rel = set((attrs.get("rel") or "").lower().split())
                if not {"noopener", "noreferrer"}.issubset(rel):
                    parser.errors.append("VK target=_blank link missing safe rel attributes")

        for phrase in config["required"]:
            if phrase not in source:
                parser.errors.append("missing required element: " + phrase)

        if filename == "index.html":
            obsolete = [
                "TAINA STUDIO / РАЗБОР БИЗНЕС-ПРОЦЕССОВ",
                "Первые два платных пилота",
                "9 900 ₽",
                "5–7 часов",
            ]
            for phrase in obsolete:
                if phrase in source:
                    parser.errors.append("obsolete consultation-only copy remains: " + phrase)

        parsed[filename] = parser
        all_errors.extend(filename + ": " + error for error in parser.errors)

    if all_errors:
        print("\n".join("ERROR: " + error for error in all_errors))
        raise SystemExit(1)

    print(
        "OK: both pages have valid nesting, unique IDs, working local links, "
        "one H1 each, safe VK CTAs, no forms and current product/offer copy"
    )


if __name__ == "__main__":
    main()
