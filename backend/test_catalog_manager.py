import unittest
import os
import json
import shutil
import tempfile
import sys

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import catalog_manager

class TestCatalogManager(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.test_catalog_file = os.path.join(self.test_dir, 'catalog-data.js')
        self.test_backup_dir = os.path.join(self.test_dir, 'backups')
        self.test_assets_dir = os.path.join(self.test_dir, 'assets', 'products')
        os.makedirs(self.test_assets_dir, exist_ok=True)

        sample_catalog = {
            "categories": [
                {"id": "all", "name": "All Products", "count": 2},
                {"id": "pen-needles", "name": "Pen Needles", "count": 2}
            ],
            "products": [
                {
                    "id": "101",
                    "itemNo": "101",
                    "name": "Test Pen Needle A",
                    "category": "pen-needles",
                    "categoryName": "Pen Needles",
                    "specs": "31G x 5mm",
                    "ndc": "73317-001-01",
                    "brand": "Quick Touch",
                    "badges": ["High AWP"],
                    "image": "src/assets/products/needle-31x4.png",
                    "description": "Test description A"
                },
                {
                    "id": "102",
                    "itemNo": "102",
                    "name": "Test Pen Needle B",
                    "category": "pen-needles",
                    "categoryName": "Pen Needles",
                    "specs": "32G x 4mm",
                    "ndc": "73317-001-02",
                    "brand": "Quick Touch",
                    "badges": ["Low Acquisition"],
                    "image": "src/assets/products/needle-32x4.png",
                    "description": "Test description B"
                }
            ]
        }
        with open(self.test_catalog_file, 'w', encoding='utf-8') as f:
            f.write(f"// Akron Generics Catalog\nwindow.AKRON_CATALOG = {json.dumps(sample_catalog, indent=2)};\n")

        catalog_manager.CATALOG_PATH = self.test_catalog_file
        catalog_manager.BACKUP_DIR = self.test_backup_dir
        catalog_manager.ASSETS_DIR = self.test_assets_dir

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def test_load_catalog(self):
        data = catalog_manager.load_catalog()
        self.assertIn("categories", data)
        self.assertIn("products", data)
        self.assertEqual(len(data["products"]), 2)
        self.assertEqual(data["products"][0]["name"], "Test Pen Needle A")

    def test_save_catalog_and_recalculate_counts(self):
        data = catalog_manager.load_catalog()
        data["products"].append({
            "id": "103",
            "itemNo": "103",
            "name": "New Needle C",
            "category": "pen-needles",
            "categoryName": "Pen Needles",
            "specs": "33G x 4mm",
            "ndc": "73317-001-03",
            "brand": "Quick Touch",
            "badges": ["New"],
            "image": "src/assets/products/needle-33x4.jpeg",
            "description": "Test description C"
        })

        success, msg = catalog_manager.save_catalog(data)
        self.assertTrue(success, msg)

        reloaded = catalog_manager.load_catalog()
        self.assertEqual(len(reloaded["products"]), 3)
        all_cat = next(c for c in reloaded["categories"] if c["id"] == "all")
        pen_cat = next(c for c in reloaded["categories"] if c["id"] == "pen-needles")
        self.assertEqual(all_cat["count"], 3)
        self.assertEqual(pen_cat["count"], 3)

        backups = os.listdir(self.test_backup_dir)
        self.assertGreaterEqual(len(backups), 1)

    def test_save_catalog_rejects_empty_categories(self):
        data = {"categories": [], "products": [{"name": "P1"}]}
        success, msg = catalog_manager.save_catalog(data)
        self.assertFalse(success)
        self.assertIn("categories", msg)

    def test_upload_image_png_magic_bytes(self):
        # Valid 1x1 PNG in base64
        valid_png_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        rel_path, err = catalog_manager.save_uploaded_image("needle.png", valid_png_b64)
        self.assertIsNone(err)
        self.assertTrue(rel_path.startswith("src/assets/products/needle_"))
        self.assertTrue(rel_path.endswith(".png"))

        full_path = os.path.join(self.test_dir, "assets", "products", os.path.basename(rel_path))
        self.assertTrue(os.path.exists(full_path))

    def test_upload_image_rejects_svg(self):
        svg_content = "<svg xmlns='http://www.w3.org/2000/svg'><script>alert(1)</script></svg>"
        import base64
        svg_b64 = "data:image/svg+xml;base64," + base64.b64encode(svg_content.encode()).decode()
        rel_path, err = catalog_manager.save_uploaded_image("malicious.svg", svg_b64)
        self.assertIsNone(rel_path)
        self.assertIn("Invalid image format", err)

    def test_upload_image_rejects_fake_png_header(self):
        # Fake content pretending to be png
        fake_b64 = "data:image/png;base64," + "SGVsbG8gV29ybGQ=" # "Hello World"
        rel_path, err = catalog_manager.save_uploaded_image("fake.png", fake_b64)
        self.assertIsNone(rel_path)
        self.assertIn("header", err)

    def test_upload_image_traversal_blocked(self):
        valid_png_b64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        rel_path, err = catalog_manager.save_uploaded_image("../../malicious.png", valid_png_b64)
        self.assertIsNone(err)
        self.assertNotIn("..", rel_path)
        outside_file = os.path.join(self.test_dir, "malicious.png")
        self.assertFalse(os.path.exists(outside_file))

if __name__ == '__main__':
    unittest.main()
