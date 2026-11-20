import importlib.util
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "academic_build", ROOT / "src" / "academic-presentation" / "build.py")
BUILD = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(BUILD)


def render(**content):
    slide = {
        "slide_id": "table-test", "layout": "table", "title": "表格测试",
        "content": {"headers": ["A"], "rows": [["0"], ["1"], ["2"]], **content},
        "notes": "test", "sources": ["test"],
    }
    return BUILD.render_slide(slide, 0, [])


class TableHighlightTests(unittest.TestCase):
    def test_legacy_single_row(self):
        html = render(highlight_row=2)
        self.assertEqual(len(re.findall(r'<tr class="me">', html)), 1)
        self.assertIn('<tr class="me"><td>2</td>', html)

    def test_multiple_rows_and_union(self):
        html = render(highlight_row=1, highlight_rows=[0, 2, 2])
        self.assertEqual(len(re.findall(r'<tr class="me">', html)), 3)

    def test_invalid_values(self):
        for value in (2, "0,1", [True], [-1], [3]):
            with self.subTest(value=value), self.assertRaises(ValueError):
                render(highlight_rows=value)


if __name__ == "__main__":
    unittest.main()
