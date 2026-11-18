"""Regression for shared reminder fields, all layouts and legacy spellings."""
import importlib.util
from pathlib import Path
import re
import unittest
import yaml

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("deck_build", ROOT / "src/academic-presentation/build.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)


class AlertsTest(unittest.TestCase):
    def test_all_layouts(self):
        data = yaml.safe_load((ROOT / "decks/starter/content/slides.yaml").read_text(encoding="utf-8"))
        seen = set()
        for original in data["slides"]:
            for object_form in (False, True):
                slide = {**original, "content": dict(original.get("content") or {})}
                for kind in ("note", "callout", "box"):
                    slide["content"][kind] = {"label": kind, "text": "marker-" + kind} if object_form else "marker-" + kind
                result = build.render_slide(slide, 0, [{"id": "chapter", "title": "章节"}])
                self.assertEqual(re.findall(r'class="slide-alert alert-(note|callout|box)', result), ["note", "callout", "box"])
                for kind in ("note", "callout", "box"):
                    self.assertEqual(result.count("marker-" + kind), 1)
                self.assertLess(result.index('class="slide-alerts"'), result.index('<aside class="notes">'))
                seen.add(slide["layout"])
        self.assertEqual(seen, build.KNOWN_LAYOUTS)

    def test_legacy_and_invalid(self):
        result = build.alerts_html({"callout": {"style": "main", "text": "关键"}, "box": {"style": "tbd", "text": "重点"}})
        self.assertIn("alert-main", result)
        self.assertIn("alert-box", result)
        for value in (42, ["text"], {"label": "missing text"}):
            with self.assertRaises(ValueError):
                build.alerts_html({"note": value})


if __name__ == "__main__":
    unittest.main()
