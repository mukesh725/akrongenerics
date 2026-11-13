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

def load_catalog():
    """
    Load the catalog data dictionary from catalog-data.js using pure Python.
    Returns: dict {"categories": [...], "products": [...]}
    """
    path = get_catalog_path()
    if not os.path.exists(path):
        return {"categories": [], "products": []}

    try:
        with open(path, 'r', encoding='utf-8') as f:
            content = f.read()

        raw_json = _clean_json_str(content)

        # 1. Direct standard JSON parsing
        try:
            return json.loads(raw_json)
        except json.JSONDecodeError:
            pass

        # 2. Pure Python fallback: Quote unquoted object keys and parse
        # Matches unquoted keys like "  name:" -> '  "name":'
        fixed = re.sub(r'([{,]\s*)([a-zA-Z0-9_$]+)\s*:', r'\1"\2":', raw_json)
        # Remove trailing commas before } or ]
        fixed = re.sub(r',\s*([}\]])', r'\1', fixed)
        return json.loads(fixed)

    except Exception as e:
        print(f"[CATALOG_MANAGER ERROR] Could not parse catalog-data.js: {e}")
        return {"categories": [], "products": [], "error": "Unable to parse catalog file"}

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
    catalog_json = json.dumps({
        "categories": categories,
        "products": products
    }, indent=2, ensure_ascii=False)

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
