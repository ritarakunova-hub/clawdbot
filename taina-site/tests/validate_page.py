from html.parser import HTMLParser
from pathlib import Path

PAGE = Path(__file__).resolve().parents[1] / "index.html"
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
    if not PAGE.exists():
        raise SystemExit("Missing page: " + str(PAGE))
    source = PAGE.read_text(encoding="utf-8")
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

    required = [
        "TAINA STUDIO / AI PROCESS CONSULTING",
        "5 000 ₽",
        "60 минут онлайн",
        "Записаться на консультацию в VK",
    ]
    for phrase in required:
        if phrase not in source:
            parser.errors.append("missing current offer element: " + phrase)
    obsolete = ["9 900 ₽", "5–7 часов", "Первые два платных пилота", "1 490 ₽"]
    for phrase in obsolete:
        if phrase in source:
            parser.errors.append("obsolete offer element remains: " + phrase)

    if parser.errors:
        print("\n".join("ERROR: " + error for error in parser.errors))
        raise SystemExit(1)
    print("OK: HTML structure, anchors, privacy form gate and current consultation offer")


if __name__ == "__main__":
    main()
