import os
import json
import re
import time
import uuid
import base64
import tempfile

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, '..'))
FRONTEND_DIR = os.path.join(PROJECT_ROOT, 'frontend')

CATALOG_PATH = os.path.join(FRONTEND_DIR, 'src', 'js', 'catalog-data.js')
BACKUP_DIR = os.path.join(BASE_DIR, 'data', 'catalog_backups')
ASSETS_DIR = os.path.join(FRONTEND_DIR, 'src', 'assets', 'products')

ALLOWED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp'}
MAX_UPLOAD_SIZE = 15 * 1024 * 1024  # 15 MB
MAX_BACKUPS_RETAINED = 20

def get_catalog_path():
    return CATALOG_PATH

def _clean_json_str(content):
    """
    Extract the JSON object from the JS file.
    Supports both standard JSON and unquoted JS object literals.
    """
    match = re.search(r'window\.AKRON_CATALOG\s*=\s*(\{[\s\S]*\});?\s*$', content)
    if match:
        return match.group(1).rstrip(';').strip()

    lines = content.split('\n')
    body = '\n'.join([l for l in lines if not l.strip().startswith('//')])
    body = re.sub(r'^\s*window\.AKRON_CATALOG\s*=\s*', '', body.strip())
    return body.rstrip(';').strip()

def get_default_special_offers():
    """
    Returns default monthly special offers structure matching the hero section.
    """
    return {
        "eyebrow": "AKRON GENERICS · SPECIAL OFFERS",
        "title": "A new month. More opportunity.",
        "subtitle": "Featured prices from our November specials.",
        "notice": "Promotional allocation. Offer valid till November 30, 2026. Confirm availability before ordering.",
        "catalogUrl": "src/november-specials.pdf",
        "catalogBtnText": "Explore the Catalog ↗",
        "items": [
            {
                "id": "SPEC-1",
                "productId": "18366",
                "title": "Quick Touch Safety Pen Needles | 100 CT",
                "badge": "SPECIAL PRICE",
                "image": "src/assets/products/quick-touch-safety-packaging.png",
                "description": "Safety-shielded pen needle engineered for single-use protection and smooth injection comfort.",
                "ndc": "73317-6816-04"
            },
            {
                "id": "SPEC-2",
                "productId": "17178",
                "title": "Safety Lancets 28G | 100 CT",
                "badge": "SPECIAL PRICE",
                "image": "src/assets/products/comfort-touch-safety-lancets-28g.jpg",
                "description": "Pressure-activated safety lancet for capillary blood sampling with automatic needle retraction.",
                "ndc": "73317-4683-01"
            },
            {
                "id": "SPEC-3",
                "productId": "18365",
                "title": "Lidocaine 4% Topical Patches | 15 Patches",
                "badge": "SPECIAL PRICE",
                "image": "src/assets/products/lidocaine-patch-box.png",
                "description": "Maximum strength OTC lidocaine topical patch providing targeted temporary numbing pain relief.",
                "ndc": "73317-6866-05"
            },
            {
                "id": "SPEC-4",
                "productId": "CONTOUR-100",
                "title": "Contour Next Retail Test Strips | 100 CT",
                "badge": "AUTHORIZED DEALER",
                "image": "src/assets/products/contour-next-100ct.jpg",
                "description": "High-accuracy blood glucose test strips featuring Second-Chance sampling and multi-pulse technology.",
                "ndc": "00193-7312-21"
            }
        ]
    }

def load_catalog():
    """
    Load the catalog data dictionary from catalog-data.js using pure Python.
    Returns: dict {"categories": [...], "products": [...], "specialOffers": {...}}
    """
    path = get_catalog_path()
    if not os.path.exists(path):
        return {"categories": [], "products": [], "specialOffers": get_default_special_offers()}

    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()

        raw_json = _clean_json_str(content)

        parsed_data = None
        # 1. Direct standard JSON parsing
        try:
            parsed_data = json.loads(raw_json)
        except json.JSONDecodeError:
            pass

        if parsed_data is None:
            # 2. Pure Python fallback: Quote unquoted object keys and parse
            fixed = re.sub(r'([{,]\s*)([a-zA-Z0-9_$]+)\s*:', r'\1"\2":', raw_json)
            fixed = re.sub(r',\s*([}\]])', r'\1', fixed)
            parsed_data = json.loads(fixed)

        if not isinstance(parsed_data, dict):
            parsed_data = {"categories": [], "products": []}

        if 'specialOffers' not in parsed_data or not isinstance(parsed_data.get('specialOffers'), dict):
            parsed_data['specialOffers'] = get_default_special_offers()

        return parsed_data

    except Exception as e:
        print(f"[CATALOG_MANAGER ERROR] Could not parse catalog-data.js: {e}")
        return {
            "categories": [],
            "products": [],
            "specialOffers": get_default_special_offers(),
            "error": "Unable to parse catalog file"
        }

def save_catalog(catalog_dict):
    """
    Save catalog dict to catalog-data.js with atomic replacement and snapshot backup.
    Recalculates category counts and prunes stale backups.
    Returns: (bool success, str message)
    """
    if not isinstance(catalog_dict, dict):
        return False, "Catalog data must be an object with categories and products."

    products = catalog_dict.get('products')
    categories = catalog_dict.get('categories')

    if not isinstance(products, list):
        return False, "Products must be a list."

    if not isinstance(categories, list) or len(categories) == 0:
        return False, "Catalog data must contain a non-empty categories list."

    # Validate each product
    for idx, p in enumerate(products):
        if not isinstance(p, dict):
            return False, f"Product at index {idx} must be an object."
        if not p.get('name'):
            return False, f"Product at index {idx} is missing a name."
        if not p.get('id'):
            p['id'] = str(int(time.time() * 1000) + idx)
        if not p.get('itemNo'):
            p['itemNo'] = p['id']
        if not p.get('category'):
            p['category'] = 'all'

    # Recalculate counts
    for cat in categories:
        cat_id = cat.get('id')
        if cat_id == 'all':
            cat['count'] = len(products)
        else:
            cat['count'] = sum(1 for p in products if p.get('category') == cat_id)

    # Prepare backup directory
    os.makedirs(BACKUP_DIR, exist_ok=True)
    target_path = get_catalog_path()

    # Backup existing file if exists
    if os.path.exists(target_path):
        ts = int(time.time())
        backup_filename = f"catalog-backup-{ts}.js"
        backup_file = os.path.join(BACKUP_DIR, backup_filename)
        try:
            with open(target_path, 'r', encoding='utf-8') as src, open(backup_file, 'w', encoding='utf-8') as dst:
                dst.write(src.read())
        except Exception as b_err:
            print(f"[CATALOG_MANAGER WARN] Failed to write backup: {b_err}")

        # Prune old backups (keep only latest MAX_BACKUPS_RETAINED)
        try:
            backups = sorted([
                os.path.join(BACKUP_DIR, f)
                for f in os.listdir(BACKUP_DIR)
                if f.startswith('catalog-backup-') and f.endswith('.js')
            ])
            if len(backups) > MAX_BACKUPS_RETAINED:
                for old_b in backups[:-MAX_BACKUPS_RETAINED]:
                    try:
                        os.remove(old_b)
                    except OSError:
                        pass
        except Exception:
            pass

    # Build Javascript content with formatted JSON
    save_obj = {
        "categories": categories,
        "products": products
    }

    special_offers = catalog_dict.get('specialOffers')
    if special_offers and isinstance(special_offers, dict):
        raw_items = special_offers.get('items')
        items = raw_items if isinstance(raw_items, list) else []
        valid_items = []
        for idx, item in enumerate(items):
            if isinstance(item, dict) and item.get('title'):
                valid_items.append({
                    "id": str(item.get('id') or f"SPEC-{int(time.time() * 1000) + idx}").strip(),
                    "productId": str(item.get('productId') or '').strip(),
                    "title": str(item.get('title') or '').strip(),
                    "badge": str(item.get('badge') or 'SPECIAL PRICE').strip(),
                    "image": str(item.get('image') or 'src/assets/products/quick-touch-safety-packaging.png').strip(),
                    "description": str(item.get('description') or '').strip(),
                    "ndc": str(item.get('ndc') or '').strip()
                })

        raw_url = str(special_offers.get('catalogUrl') or special_offers.get('catalogLink') or 'src/november-specials.pdf').strip()
        if not re.match(r'^(https?:\/\/|\/|src\/|[a-zA-Z0-9_\-\.\/]+\.pdf)', raw_url, re.IGNORECASE):
            raw_url = 'src/november-specials.pdf'

        save_obj['specialOffers'] = {
            "eyebrow": str(special_offers.get('eyebrow') or 'AKRON GENERICS · SPECIAL OFFERS').strip(),
            "title": str(special_offers.get('title') or special_offers.get('heading') or 'A new month. More opportunity.').strip(),
            "subtitle": str(special_offers.get('subtitle') or 'Featured prices from our November specials.').strip(),
            "notice": str(special_offers.get('notice') or 'Promotional allocation. Offer valid till November 30, 2026. Confirm availability before ordering.').strip(),
            "catalogUrl": raw_url,
            "catalogBtnText": str(special_offers.get('catalogBtnText') or special_offers.get('catalogButtonText') or 'Explore the Catalog ↗').strip(),
            "items": valid_items
        }
    else:
        # Preserve default or existing special offers if available
        try:
            current_data = load_catalog()
            save_obj['specialOffers'] = current_data.get('specialOffers', get_default_special_offers())
        except Exception:
            save_obj['specialOffers'] = get_default_special_offers()

    catalog_json = json.dumps(save_obj, indent=2, ensure_ascii=False)

    js_content = f"// Akron Generics Product Catalog Data\nwindow.AKRON_CATALOG = {catalog_json};\n"

    # Atomic write using a temp file in same directory
    target_dir = os.path.dirname(os.path.abspath(target_path))
    os.makedirs(target_dir, exist_ok=True)

    fd, temp_file_path = tempfile.mkstemp(prefix='catalog_tmp_', suffix='.js', dir=target_dir)
    try:
        with os.fdopen(fd, 'w', encoding='utf-8') as f:
            f.write(js_content)
        os.replace(temp_file_path, target_path)
    except Exception as w_err:
        if os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except Exception:
                pass
        return False, f"Failed to write catalog file: {w_err}"

    return True, f"Successfully updated catalog ({len(products)} products)."

def _validate_image_magic_bytes(raw_bytes, ext):
    """
    Verify magic bytes match the expected raster image extension.
    Prevents disguised binaries, scripts, or SVG XSS attacks.
    """
    if len(raw_bytes) < 12:
        return False

    if ext == '.png':
        return raw_bytes.startswith(b'\x89PNG\r\n\x1a\n')
    elif ext in ('.jpg', '.jpeg'):
        return raw_bytes.startswith(b'\xff\xd8\xff')
    elif ext == '.webp':
        return raw_bytes.startswith(b'RIFF') and raw_bytes[8:12] == b'WEBP'

    return False

def save_uploaded_image(file_name, data_url_or_bytes):
    """
    Save an uploaded image file securely to the assets/products directory.
    Enforces collision-safe unique filenames, raster format restriction,
    magic byte header validation, and strict path boundary checks.
    """
    # 1. Sanitize base file name and check extension
    base_name = os.path.basename(file_name or 'product-image.png')
    _, ext = os.path.splitext(base_name)
    ext = ext.lower()
    if ext not in ALLOWED_EXTENSIONS:
        return None, "Invalid image format. Only PNG, JPG, and WEBP images are supported."

    # 2. Decode bytes
    if isinstance(data_url_or_bytes, str):
        if ',' in data_url_or_bytes:
            header, b64_str = data_url_or_bytes.split(',', 1)
        else:
            b64_str = data_url_or_bytes
        try:
            raw_bytes = base64.b64decode(b64_str)
        except Exception as dec_err:
            return None, "Invalid base64 image data."
    elif isinstance(data_url_or_bytes, bytes):
        raw_bytes = data_url_or_bytes
    else:
        return None, "Invalid image data format."

    if len(raw_bytes) > MAX_UPLOAD_SIZE:
        return None, f"Image file exceeds maximum limit of {MAX_UPLOAD_SIZE // (1024*1024)}MB."

    # 3. Magic bytes verification
    if not _validate_image_magic_bytes(raw_bytes, ext):
        return None, "Image content does not match expected image file header."

    # 4. Generate collision-safe unique filename
    slug = re.sub(r'[^a-zA-Z0-9_\-]', '', os.path.splitext(base_name)[0]).strip()[:24] or 'prod'
    unique_suffix = uuid.uuid4().hex[:8]
    unique_filename = f"{slug}_{int(time.time())}_{unique_suffix}{ext}"

    # 5. Resolve destination path safely
    os.makedirs(ASSETS_DIR, exist_ok=True)
    real_assets_dir = os.path.realpath(ASSETS_DIR)
    dest_path = os.path.realpath(os.path.join(real_assets_dir, unique_filename))

    if not dest_path.startswith(real_assets_dir + os.sep):
        return None, "Path resolution violation."

    # 6. Write file
    try:
        with open(dest_path, 'wb') as f:
            f.write(raw_bytes)
    except Exception as wr_err:
        return None, f"Failed to save image file: {wr_err}"

    rel_path = f"src/assets/products/{unique_filename}"
    return rel_path, None
