/**
 * ==============================================================================
 * AKRON GENERICS - EXECUTIVE ADMIN DASHBOARD LOGIC (CATEGORY-WISE & USER-FRIENDLY)
 * Features:
 * - Category Chips Navigation with Live Item Counts
 * - Category-Grouped Sections
 * - Grid View vs Table View Toggle
 * - 1-Click Quick Image Upload directly on Product Cards
 * - NDC Copy-to-Clipboard
 * - Safe DOM event delegation, Zero inline XSS
 * ==============================================================================
 */

(function() {
  'use strict';

  let currentCatalog = { categories: [], products: [] };
  let allPricingRequests = [];
  let allContactInquiries = [];

  let activeCategory = 'all';
  let currentViewMode = 'grid'; // 'grid' | 'table'

  const CATEGORY_META = [
    { id: 'all', name: 'All Products', icon: '📦' },
    { id: 'pen-needles', name: 'Pen Needles', icon: '💉' },
    { id: 'lancets', name: 'Lancets & Prep Pads', icon: '🩸' },
    { id: 'blood-pressure', name: 'Blood Pressure', icon: '🩺' },
    { id: 'nebulizers', name: 'Nebulizers & Chambers', icon: '🫁' },
    { id: 'topical-relief', name: 'Topical Pain Relief', icon: '🩹' },
    { id: 'pharmacy-vials', name: 'Pharmacy Vials', icon: '🧴' },
    { id: 'contour-next', name: 'Contour Next', icon: '⚡' }
  ];

  const CATEGORY_NAMES = {
    'pen-needles': 'Pen Needles',
    'lancets': 'Lancets & Prep Pads',
    'blood-pressure': 'Blood Pressure',
    'nebulizers': 'Nebulizers & Chambers',
    'topical-relief': 'Topical Pain Relief',
    'pharmacy-vials': 'Pharmacy Vials',
    'contour-next': 'Contour Next',
    'all': 'All Products'
  };

  function getAuthHeader() {
    const key = localStorage.getItem('akron_admin_key');
    if (key) {
      return { 'Authorization': `Bearer ${key}` };
    }
    return {};
  }

  function showToast(msg) {
    const el = document.getElementById('toastMsg');
    if (!el) return;
    el.textContent = msg;
    el.style.display = 'flex';
    setTimeout(() => { el.style.display = 'none'; }, 4000);
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // ----------------------------------------------------------------------------
  // TAB NAVIGATION (Products, Pricing, Contact - No Applications)
  // ----------------------------------------------------------------------------
  window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
    document.querySelectorAll('.metric-card').forEach(card => card.classList.remove('active-metric'));

    const btnId = 'tabBtn-' + tabId.replace('tab-', '');
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.add('active');

    const panel = document.getElementById(tabId);
    if (panel) panel.classList.add('active');

    const cards = document.querySelectorAll('.metric-card');
    if (tabId === 'tab-products' && cards[0]) cards[0].classList.add('active-metric');
    if (tabId === 'tab-pricing' && cards[1]) cards[1].classList.add('active-metric');
    if (tabId === 'tab-contact' && cards[2]) cards[2].classList.add('active-metric');
  };

  // ----------------------------------------------------------------------------
  // VIEW MODE TOGGLE (Grid Cards vs Compact Table)
  // ----------------------------------------------------------------------------
  window.setViewMode = function(mode) {
    currentViewMode = mode;
    document.querySelectorAll('.view-toggle-btn').forEach(b => {
      if (b.dataset.mode === mode) b.classList.add('active');
      else b.classList.remove('active');
    });

    const gridContainer = document.getElementById('productsGridContainer');
    const tableContainer = document.getElementById('productsTableContainer');

    if (mode === 'grid') {
      if (gridContainer) gridContainer.style.display = 'block';
      if (tableContainer) tableContainer.style.display = 'none';
    } else {
      if (gridContainer) gridContainer.style.display = 'none';
      if (tableContainer) tableContainer.style.display = 'block';
    }
  };

  // ----------------------------------------------------------------------------
  // CATEGORY PILLS BAR
  // ----------------------------------------------------------------------------
  function renderCategoryPills() {
    const pillsBar = document.getElementById('categoryPillsBar');
    if (!pillsBar) return;

    const products = currentCatalog.products || [];

    pillsBar.innerHTML = CATEGORY_META.map(cat => {
      let count = 0;
      if (cat.id === 'all') {
        count = products.length;
      } else {
        count = products.filter(p => p.category === cat.id).length;
      }

      const isActive = (cat.id === activeCategory) ? 'active' : '';

      return `
        <button type="button" class="cat-chip ${isActive}" data-category="${cat.id}">
          <span style="font-size:14px;">${cat.icon}</span>
          <span>${cat.name}</span>
          <span class="chip-count">${count}</span>
        </button>
      `;
    }).join('');
  }

  function initCategoryPillsDelegation() {
    const pillsBar = document.getElementById('categoryPillsBar');
    if (!pillsBar) return;

    pillsBar.addEventListener('click', function(e) {
      const chip = e.target.closest('.cat-chip');
      if (!chip) return;
      activeCategory = chip.dataset.category || 'all';

      // Update pills styling
      document.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');

      // Update category header banner text
      updateActiveCategoryBanner();

      // Filter and render
      filterProducts();
    });
  }

  function updateActiveCategoryBanner() {
    const titleEl = document.getElementById('activeCatHeaderTitle');
    const descEl = document.getElementById('activeCatHeaderDesc');
    const addBtnText = document.getElementById('addProdBtnText');

    const catObj = CATEGORY_META.find(c => c.id === activeCategory) || CATEGORY_META[0];
    if (titleEl) titleEl.textContent = catObj.name;
    if (addBtnText) {
      if (activeCategory === 'all') addBtnText.textContent = '+ Add New Product';
      else addBtnText.textContent = `+ Add Product to ${catObj.name}`;
    }

    if (descEl) {
      if (activeCategory === 'all') {
        descEl.textContent = 'Showing all products across all categories. You can edit information, upload new images, or reassign categories.';
      } else {
        descEl.textContent = `Managing all products categorized under ${catObj.name}. Changes update the storefront immediately.`;
      }
    }
  }

  // ----------------------------------------------------------------------------
  // CATALOG & PRODUCTS MANAGEMENT
  // ----------------------------------------------------------------------------
  window.loadCatalogProducts = function() {
    fetch('/api/admin/products', { headers: getAuthHeader() })
    .then(res => {
      if (!res.ok) throw new Error('API status: ' + res.status);
      return res.json();
    })
    .then(data => {
      if (data && data.products) {
        currentCatalog = data;
      } else if (window.AKRON_CATALOG && window.AKRON_CATALOG.products) {
        currentCatalog = window.AKRON_CATALOG;
      }
      renderCategoryPills();
      filterProducts();
      updateKpis();
    })
    .catch(err => {
      console.warn('Using local window.AKRON_CATALOG fallback:', err);
      if (window.AKRON_CATALOG && window.AKRON_CATALOG.products) {
        currentCatalog = window.AKRON_CATALOG;
        renderCategoryPills();
        filterProducts();
        updateKpis();
      }
    });
  };

  function updateKpis() {
    const prodCount = (currentCatalog.products || []).length;
    const catCount = (currentCatalog.categories || []).length || 8;
    
    const kpiP = document.getElementById('kpiProductCount');
    const kpiC = document.getElementById('kpiCategoryCount');
    const badgeP = document.getElementById('badgeProducts');

    if (kpiP) kpiP.textContent = prodCount;
    if (kpiC) kpiC.textContent = `${catCount} Active Categories`;
    if (badgeP) badgeP.textContent = prodCount;
  }

  window.filterProducts = function() {
    const q = (document.getElementById('prodSearchInput').value || '').trim().toLowerCase();

    let list = currentCatalog.products || [];
    if (activeCategory && activeCategory !== 'all') {
      list = list.filter(p => p.category === activeCategory);
    }
    if (q) {
      list = list.filter(p => 
        (p.name && p.name.toLowerCase().includes(q)) ||
        (p.ndc && p.ndc.toLowerCase().includes(q)) ||
        (p.brand && p.brand.toLowerCase().includes(q)) ||
        (p.itemNo && String(p.itemNo).toLowerCase().includes(q)) ||
        (p.specs && p.specs.toLowerCase().includes(q))
      );
    }

    renderProductsGrid(list);
    renderProductsTable(list);
  };

  // ----------------------------------------------------------------------------
  // RENDER: CATEGORY-WISE PRODUCT CARDS (User-Friendly Grid)
  // ----------------------------------------------------------------------------
  function renderProductsGrid(products) {
    const container = document.getElementById('productsGridContainer');
    if (!container) return;

    if (!products || products.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="background:#FFFFFF;border:1px solid #E2E8F0;border-radius:10px;padding:48px 24px;">
          <div class="empty-state-title">No products found</div>
          <div style="font-size:13px;color:#64748B;margin-top:4px;">Try searching for another keyword or select "All Products".</div>
        </div>
      `;
      return;
    }

    // If activeCategory is 'all', group by category sections!
    if (activeCategory === 'all') {
      let html = '';
      CATEGORY_META.forEach(cat => {
        if (cat.id === 'all') return;
        const catProducts = products.filter(p => p.category === cat.id);
        if (catProducts.length === 0) return;

        html += `
          <div class="category-section-block" style="margin-bottom:32px;">
            <div class="category-section-header">
              <div class="category-section-title">
                <span>${cat.icon}</span>
                <span>${cat.name}</span>
                <span class="chip-count" style="font-size:12px;background:#E2E8F0;padding:2px 8px;border-radius:9999px;">${catProducts.length} items</span>
              </div>
              <button type="button" class="btn-action" onclick="openAddProductModalForCategory('${cat.id}')">
                <span>+ Add to ${cat.name}</span>
              </button>
            </div>
            <div class="products-grid">
              ${catProducts.map(renderSingleProductCard).join('')}
            </div>
          </div>
        `;
      });

      // Also render any uncategorized
      const unassigned = products.filter(p => !CATEGORY_META.some(c => c.id === p.category));
      if (unassigned.length > 0) {
        html += `
          <div class="category-section-block" style="margin-bottom:32px;">
            <div class="category-section-header">
              <div class="category-section-title">
                <span>📦</span>
                <span>General / Uncategorized</span>
                <span class="chip-count">${unassigned.length} items</span>
              </div>
            </div>
            <div class="products-grid">
              ${unassigned.map(renderSingleProductCard).join('')}
            </div>
          </div>
        `;
      }

      container.innerHTML = html;
    } else {
      // Single Category View
      container.innerHTML = `
        <div class="products-grid">
          ${products.map(renderSingleProductCard).join('')}
        </div>
      `;
    }
  }

  function renderSingleProductCard(p) {
    const escId = escapeHtml(p.id);
    const escName = escapeHtml(p.name);
    const escBrand = escapeHtml(p.brand || 'Akron Generics');
    const escCatName = escapeHtml(p.categoryName || CATEGORY_NAMES[p.category] || p.category);
    const escNdc = escapeHtml(p.ndc || '--');
    const escSpecs = escapeHtml(p.specs || '--');
    const escImg = escapeHtml(p.image || 'src/assets/logo.png');

    const badgesHtml = (p.badges || []).map(b => 
      `<span class="badge-tag">${escapeHtml(b)}</span>`
    ).join('');

    return `
      <div class="product-card" data-id="${escId}">
        <div class="product-card-media">
          <img src="${escImg}" alt="${escName}" class="product-card-img" onerror="this.src='src/assets/logo.png'">
          
          <!-- Category badge overlay -->
          <span style="position:absolute;top:10px;left:10px;background:rgba(255,255,255,0.92);backdrop-filter:blur(4px);padding:3px 8px;border-radius:4px;font-size:10.5px;font-weight:700;color:#0B2240;border:1px solid rgba(0,0,0,0.06);">
            ${escCatName}
          </span>

          <!-- Quick change image overlay button -->
          <button type="button" class="btn-quick-img" data-id="${escId}" title="Quick change product image">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
            <span>Change Image</span>
          </button>
        </div>

        <div class="product-card-body">
          <div style="font-size:11.5px;font-weight:600;color:#64748B;text-transform:uppercase;margin-bottom:2px;">
            ${escBrand} &bull; SKU: ${escapeHtml(p.itemNo || p.id)}
          </div>
          <h3 class="product-card-title">${escName}</h3>

          <div style="display:flex;align-items:center;gap:6px;margin-bottom:8px;flex-wrap:wrap;">
            <span style="font-size:11px;font-weight:600;color:#475569;">NDC:</span>
            <code class="ndc-copy-tag" data-ndc="${escNdc}" title="Click to copy NDC">${escNdc}</code>
          </div>

          <div style="font-size:12px;color:#334155;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:6px 10px;margin-bottom:10px;">
            <strong>Specs:</strong> ${escSpecs}
          </div>

          <div style="margin-bottom:14px;min-height:22px;">
            ${badgesHtml || '<span style="font-size:11.5px;color:#94A3B8;">Standard Wholesale</span>'}
          </div>

          <div style="margin-top:auto;display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:12px;border-top:1px solid #F1F5F9;">
            <button type="button" class="btn-action btn-edit-prod" data-id="${escId}" style="flex:1;justify-content:center;">
              <span>Edit Details</span>
            </button>
            <button type="button" class="btn-action btn-action-danger btn-del-prod" data-id="${escId}" data-name="${escName}" title="Delete Product">
              <span>Delete</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ----------------------------------------------------------------------------
  // RENDER: COMPACT TABLE VIEW
  // ----------------------------------------------------------------------------
  function renderProductsTable(products) {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    if (!products || products.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="empty-state">
            <div class="empty-state-title">No products match your search</div>
            <div>Try adjusting your keyword or category filter.</div>
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = products.map(p => {
      const escId = escapeHtml(p.id);
      const escName = escapeHtml(p.name);
      const escBrand = escapeHtml(p.brand || 'Akron');
      const escCatName = escapeHtml(p.categoryName || CATEGORY_NAMES[p.category] || p.category);
      const escNdc = escapeHtml(p.ndc || '--');
      const escSpecs = escapeHtml(p.specs || '--');
      const escImg = escapeHtml(p.image || 'src/assets/logo.png');
      const badgesHtml = (p.badges || []).map(b => 
        `<span class="badge-tag">${escapeHtml(b)}</span>`
      ).join('');

      return `
        <tr>
          <td>
            <img src="${escImg}" alt="${escName}" class="prod-thumb" onerror="this.src='src/assets/logo.png'">
          </td>
          <td>
            <div style="font-weight:600;color:#0F172A;">${escName}</div>
            <div style="font-size:11.5px;color:#64748B;">${escBrand} &bull; SKU: ${escapeHtml(p.itemNo || p.id)}</div>
          </td>
          <td>
            <span class="cat-pill">${escCatName}</span>
          </td>
          <td>
            <code class="ndc-copy-tag" data-ndc="${escNdc}" title="Click to copy NDC">${escNdc}</code>
          </td>
          <td style="color:#475569;font-size:12.5px;">${escSpecs}</td>
          <td>${badgesHtml || '<span style="color:#94A3B8;font-size:11.5px;">--</span>'}</td>
          <td style="text-align:right;white-space:nowrap;">
            <button type="button" class="btn-action btn-edit-prod" data-id="${escId}">Edit</button>
            <button type="button" class="btn-action btn-action-danger btn-del-prod" data-id="${escId}" data-name="${escName}">Delete</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Delegated event listener for Products (Cards and Table)
  function initProductsEventDelegation() {
    const handleProductAction = function(e) {
      // 1. Edit product
      const editBtn = e.target.closest('.btn-edit-prod');
      if (editBtn) {
        window.openEditProductModal(editBtn.dataset.id);
        return;
      }

      // 2. Delete product
      const delBtn = e.target.closest('.btn-del-prod');
      if (delBtn) {
        window.confirmDeleteProduct(delBtn.dataset.id, delBtn.dataset.name);
        return;
      }

      // 3. Quick change image directly on card
      const imgBtn = e.target.closest('.btn-quick-img');
      if (imgBtn) {
        window.triggerQuickImageChange(imgBtn.dataset.id);
        return;
      }

      // 4. Click NDC to copy
      const ndcTag = e.target.closest('.ndc-copy-tag');
      if (ndcTag && ndcTag.dataset.ndc && ndcTag.dataset.ndc !== '--') {
        navigator.clipboard.writeText(ndcTag.dataset.ndc).then(() => {
          showToast(`NDC ${ndcTag.dataset.ndc} copied to clipboard!`);
        });
        return;
      }
    };

    const grid = document.getElementById('productsGridContainer');
    if (grid) grid.addEventListener('click', handleProductAction);

    const tbody = document.getElementById('productsTableBody');
    if (tbody) tbody.addEventListener('click', handleProductAction);
  }

  // ----------------------------------------------------------------------------
  // QUICK IMAGE UPLOAD TRIGGER ON CARD
  // ----------------------------------------------------------------------------
  let quickUploadTargetId = null;

  window.triggerQuickImageChange = function(productId) {
    quickUploadTargetId = productId;
    const fileInput = document.getElementById('quickImgFileInput');
    if (fileInput) fileInput.click();
  };

  window.handleQuickImageSelected = function(input) {
    const file = input.files && input.files[0];
    if (!file || !quickUploadTargetId) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('Selected file exceeds maximum limit of 15MB.');
      return;
    }

    const targetProduct = (currentCatalog.products || []).find(p => String(p.id) === String(quickUploadTargetId));
    if (!targetProduct) return;

    showToast(`Uploading image for "${targetProduct.name}"...`);

    const reader = new FileReader();
    reader.onload = function(e) {
      const dataUrl = e.target.result;

      fetch('/api/admin/upload-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify({ fileName: file.name, dataUrl: dataUrl })
      })
      .then(res => res.json())
      .then(resData => {
        if (resData.status === 'success' && resData.imagePath) {
          targetProduct.image = resData.imagePath;

          // Save catalog back
          fetch('/api/admin/products/save', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...getAuthHeader()
            },
            body: JSON.stringify(currentCatalog)
          })
          .then(saveRes => saveRes.json())
          .then(() => {
            showToast(`Product image updated for "${targetProduct.name}"!`);
            filterProducts();
          });
        } else {
          alert('Upload failed: ' + (resData.message || 'Unknown error'));
        }
      })
      .catch(err => {
        alert('Network upload error: ' + err);
      });
    };
    reader.readAsDataURL(file);
    input.value = '';
  };

  // ----------------------------------------------------------------------------
  // ADD & EDIT PRODUCT MODALS
  // ----------------------------------------------------------------------------
  window.openAddProductModal = function() {
    window.openAddProductModalForCategory(activeCategory === 'all' ? 'pen-needles' : activeCategory);
  };

  window.openAddProductModalForCategory = function(catId) {
    document.getElementById('modalProductTitle').textContent = 'Add New Product to Catalog';
    document.getElementById('editProdId').value = '';
    document.getElementById('editProdName').value = '';
    document.getElementById('editProdCategory').value = catId || 'pen-needles';
    document.getElementById('editProdItemNo').value = String(Date.now()).slice(-5);
    document.getElementById('editProdNdc').value = '';
    document.getElementById('editProdBrand').value = 'Akron Generics';
    document.getElementById('editProdSpecs').value = '';
    document.getElementById('editProdBadges').value = 'High AWP';
    document.getElementById('editProdDesc').value = '';
    document.getElementById('editProdImgPath').value = 'src/assets/products/quick-touch-safety-packaging.png';
    document.getElementById('editProdImgPreview').src = 'src/assets/products/quick-touch-safety-packaging.png';

    document.getElementById('productEditModal').classList.add('open');
  };

  window.openEditProductModal = function(id) {
    const p = (currentCatalog.products || []).find(x => String(x.id) === String(id) || String(x.itemNo) === String(id));
    if (!p) {
      alert('Product not found.');
      return;
    }

    document.getElementById('modalProductTitle').textContent = 'Edit Product: ' + p.name;
    document.getElementById('editProdId').value = p.id;
    document.getElementById('editProdName').value = p.name || '';
    document.getElementById('editProdCategory').value = p.category || 'all';
    document.getElementById('editProdItemNo').value = p.itemNo || p.id;
    document.getElementById('editProdNdc').value = p.ndc || '';
    document.getElementById('editProdBrand').value = p.brand || '';
    document.getElementById('editProdSpecs').value = p.specs || '';
    document.getElementById('editProdBadges').value = (p.badges || []).join(', ');
    document.getElementById('editProdDesc').value = p.description || '';
    document.getElementById('editProdImgPath').value = p.image || '';
    document.getElementById('editProdImgPreview').src = p.image || 'src/assets/logo.png';

    document.getElementById('productEditModal').classList.add('open');
  };

  window.closeProductModal = function() {
    document.getElementById('productEditModal').classList.remove('open');
  };

  window.updateImagePreviewFromInput = function(url) {
    const img = document.getElementById('editProdImgPreview');
    if (img) img.src = url || 'src/assets/logo.png';
  };

  window.handleImageFileSelected = function(input) {
    const file = input.files && input.files[0];
    if (!file) return;

    if (file.size > 15 * 1024 * 1024) {
      alert('Selected file exceeds maximum allowed limit of 15MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      const dataUrl = e.target.result;
      document.getElementById('editProdImgPreview').src = dataUrl;

      const uploadPayload = {
        fileName: file.name,
        dataUrl: dataUrl
      };

      fetch('/api/admin/upload-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(uploadPayload)
      })
      .then(res => res.json())
      .then(resData => {
        if (resData.status === 'success' && resData.imagePath) {
          document.getElementById('editProdImgPath').value = resData.imagePath;
          showToast(`Image uploaded successfully: ${resData.imagePath}`);
        } else {
          alert('Image upload failed: ' + (resData.message || 'Unknown error'));
        }
      })
      .catch(err => {
        console.error('Upload error:', err);
        document.getElementById('editProdImgPath').value = dataUrl;
        showToast('Image preview loaded locally.');
      });
    };
    reader.readAsDataURL(file);
  };

  window.saveCurrentProduct = function() {
    const id = document.getElementById('editProdId').value;
    const name = document.getElementById('editProdName').value.trim();
    const category = document.getElementById('editProdCategory').value;
    const itemNo = document.getElementById('editProdItemNo').value.trim() || id || String(Date.now()).slice(-5);
    const ndc = document.getElementById('editProdNdc').value.trim();
    const brand = document.getElementById('editProdBrand').value.trim();
    const specs = document.getElementById('editProdSpecs').value.trim();
    const badgesRaw = document.getElementById('editProdBadges').value.trim();
    const description = document.getElementById('editProdDesc').value.trim();
    const image = document.getElementById('editProdImgPath').value.trim();

    if (!name) {
      alert('Please enter a product name.');
      return;
    }

    const badges = badgesRaw ? badgesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];
    const categoryName = CATEGORY_NAMES[category] || 'Pharmaceutical Supplies';

    let products = [...(currentCatalog.products || [])];

    if (id) {
      const idx = products.findIndex(p => String(p.id) === String(id) || String(p.itemNo) === String(id));
      if (idx !== -1) {
        products[idx] = {
          ...products[idx],
          name,
          category,
          categoryName,
          itemNo,
          ndc,
          brand,
          specs,
          badges,
          description,
          image
        };
      }
    } else {
      const newId = String(Date.now()).slice(-6);
      products.unshift({
        id: newId,
        itemNo: itemNo || newId,
        name,
        category,
        categoryName,
        ndc,
        brand,
        specs,
        badges,
        description,
        image: image || 'src/assets/products/quick-touch-safety-packaging.png'
      });
    }

    currentCatalog.products = products;

    const saveBtn = document.getElementById('btnSaveProduct');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    fetch('/api/admin/products/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify(currentCatalog)
    })
    .then(res => res.json())
    .then(resData => {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      }
      if (resData.status === 'success') {
        showToast('Catalog updated and published to website!');
        window.closeProductModal();
        renderCategoryPills();
        filterProducts();
        updateKpis();
      } else {
        alert('Save failed: ' + (resData.message || 'Error occurred'));
      }
    })
    .catch(err => {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Save Changes';
      }
      console.warn('Save API error, updated locally in memory:', err);
      window.closeProductModal();
      renderCategoryPills();
      filterProducts();
      updateKpis();
      showToast('Updated locally (offline mode).');
    });
  };

  window.confirmDeleteProduct = function(id, name) {
    if (!confirm(`Are you sure you want to delete "${name}" from the catalog? This will remove it from all storefront pages.`)) {
      return;
    }

    currentCatalog.products = (currentCatalog.products || []).filter(p => String(p.id) !== String(id) && String(p.itemNo) !== String(id));

    fetch('/api/admin/products/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeader()
      },
      body: JSON.stringify({ id })
    })
    .then(res => res.json())
    .then(resData => {
      if (resData.status === 'success') {
        showToast(`Product "${name}" deleted.`);
        renderCategoryPills();
        filterProducts();
        updateKpis();
      } else {
        alert('Delete failed: ' + (resData.message || 'Unknown error'));
      }
    })
    .catch(() => {
      showToast(`Deleted "${name}" locally.`);
      renderCategoryPills();
      filterProducts();
      updateKpis();
    });
  };

  // ----------------------------------------------------------------------------
  // WHOLESALE PRICING REQUESTS
  // ----------------------------------------------------------------------------
  window.loadPricingRequests = function() {
    fetch('/api/pricing-requests', { headers: getAuthHeader() })
      .then(res => res.ok ? res.json() : [])
      .then(list => {
        allPricingRequests = list || [];
        renderPricingRequests(allPricingRequests);
        const kpi = document.getElementById('kpiPricingCount');
        const badge = document.getElementById('badgePricing');
        if (kpi) kpi.textContent = allPricingRequests.length;
        if (badge) badge.textContent = allPricingRequests.length;
      })
      .catch(() => {
        renderPricingRequests(allPricingRequests);
      });
  };

  window.filterPricingRequests = function() {
    const q = (document.getElementById('pricingSearchInput').value || '').trim().toLowerCase();
    let list = allPricingRequests;
    if (q) {
      list = list.filter(p => 
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.productName && p.productName.toLowerCase().includes(q)) ||
        (p.ndc && p.ndc.toLowerCase().includes(q))
      );
    }
    renderPricingRequests(list);
  };

  function renderPricingRequests(list) {
    const tbody = document.getElementById('pricingTableBody');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No wholesale pricing requests logged yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(item => {
      const escTime = escapeHtml(item.received_at || item.requestedAtFormatted || '--');
      const escProd = escapeHtml(item.productName || 'General Product');
      const escNdc = escapeHtml(item.ndc || '--');
      const escEmail = escapeHtml(item.email || '--');
      const escSource = escapeHtml(item.sourceUrl || '/products.html');

      return `
        <tr>
          <td style="color:#64748B;font-size:12px;">${escTime}</td>
          <td style="font-weight:600;color:#0F172A;">${escProd}</td>
          <td><code class="ndc-copy-tag" data-ndc="${escNdc}">${escNdc}</code></td>
          <td><a href="mailto:${escEmail}" style="color:#0D498F;text-decoration:none;font-weight:600;">${escEmail}</a></td>
          <td style="color:#64748B;font-size:12px;">${escSource}</td>
          <td style="text-align:right;">
            <a href="mailto:${escEmail}?subject=Akron%20Generics%20Wholesale%20Pricing%20Schedule&body=Hello,%0D%0A%0D%0AThank%20you%20for%20contacting%20Akron%20Generics." class="btn-action btn-action-primary" style="text-decoration:none;">Reply</a>
          </td>
        </tr>
      `;
    }).join('');
  }

  // ----------------------------------------------------------------------------
  // CONTACT INQUIRIES
  // ----------------------------------------------------------------------------
  window.loadContactInquiries = function() {
    fetch('/api/contact-inquiries', { headers: getAuthHeader() })
      .then(res => res.ok ? res.json() : [])
      .then(list => {
        allContactInquiries = list || [];
        renderContactInquiries(allContactInquiries);
        const kpi = document.getElementById('kpiContactCount');
        const badge = document.getElementById('badgeContact');
        if (kpi) kpi.textContent = allContactInquiries.length;
        if (badge) badge.textContent = allContactInquiries.length;
      })
      .catch(() => {
        renderContactInquiries(allContactInquiries);
      });
  };

  window.filterContactInquiries = function() {
    const q = (document.getElementById('contactSearchInput').value || '').trim().toLowerCase();
    let list = allContactInquiries;
    if (q) {
      list = list.filter(c => 
        (c.fullName && c.fullName.toLowerCase().includes(q)) ||
        (c.email && c.email.toLowerCase().includes(q)) ||
        (c.pharmacyName && c.pharmacyName.toLowerCase().includes(q)) ||
        (c.reason && c.reason.toLowerCase().includes(q))
      );
    }
    renderContactInquiries(list);
  };

  function renderContactInquiries(list) {
    const tbody = document.getElementById('contactTableBody');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No contact messages logged yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(item => {
      const escId = escapeHtml(item.id);
      const escTime = escapeHtml(item.received_at || item.submittedAtFormatted || '--');
      const escName = escapeHtml(item.fullName || ((item.firstName || '') + ' ' + (item.lastName || '')).trim() || 'Visitor');
      const escPharm = escapeHtml(item.pharmacyName || '--');
      const escReason = escapeHtml(item.reason || 'General Inquiry');
      const escEmail = escapeHtml(item.email || '--');
      const escPhone = escapeHtml(item.phone || '--');

      return `
        <tr>
          <td style="color:#64748B;font-size:12px;">${escTime}</td>
          <td style="font-weight:600;color:#0F172A;">${escName}</td>
          <td>${escPharm}</td>
          <td><span class="cat-pill">${escReason}</span></td>
          <td>
            <div><a href="mailto:${escEmail}" style="color:#0D498F;text-decoration:none;font-weight:600;">${escEmail}</a></div>
            <div style="font-size:11.5px;color:#64748B;">${escPhone}</div>
          </td>
          <td style="text-align:right;">
            <button type="button" class="btn-action btn-view-contact" data-id="${escId}">View Message</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function initContactTableDelegation() {
    const tbody = document.getElementById('contactTableBody');
    if (!tbody) return;

    tbody.addEventListener('click', function(e) {
      const btn = e.target.closest('.btn-view-contact');
      if (btn) {
        window.viewContactDetails(btn.dataset.id);
      }
    });
  }

  window.viewContactDetails = function(id) {
    const item = allContactInquiries.find(x => x.id === id);
    if (!item) return;

    const drawer = document.getElementById('drawerPanel');
    const overlay = document.getElementById('drawerOverlay');
    const title = document.getElementById('drawerTitle');
    const body = document.getElementById('drawerBody');

    title.textContent = `Inquiry: ${item.reason || 'Customer Message'}`;
    body.innerHTML = `
      <div class="drawer-field"><strong>From Contact:</strong>${escapeHtml(item.fullName || item.firstName || '')} (${escapeHtml(item.pharmacyName || 'N/A')})</div>
      <div class="drawer-field"><strong>Email Address:</strong><a href="mailto:${escapeHtml(item.email)}">${escapeHtml(item.email)}</a></div>
      <div class="drawer-field"><strong>Phone:</strong>${escapeHtml(item.phone || 'N/A')}</div>
      <div class="drawer-field"><strong>Role &amp; State:</strong>${escapeHtml(item.role || 'N/A')} &bull; ${escapeHtml(item.state || 'N/A')}</div>
      <div class="drawer-field"><strong>Timestamp:</strong>${escapeHtml(item.received_at || item.submittedAtFormatted || 'N/A')}</div>
      <div class="drawer-field" style="margin-top:20px;">
        <strong>Customer Message:</strong>
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:6px;padding:14px;white-space:pre-wrap;line-height:1.6;font-size:13.5px;margin-top:6px;">
          ${escapeHtml(item.message || '(No text content)')}
        </div>
      </div>
      <div style="margin-top:24px;">
        <a href="mailto:${escapeHtml(item.email)}?subject=Re:%20Akron%20Generics%20Inquiry%20-%20${encodeURIComponent(item.reason || '')}" class="btn-action btn-action-primary" style="text-decoration:none;">Reply via Email &rarr;</a>
      </div>
    `;

    overlay.classList.add('open');
    drawer.classList.add('open');
  };

  window.closeDrawer = function() {
    document.getElementById('drawerPanel').classList.remove('open');
    document.getElementById('drawerOverlay').classList.remove('open');
  };

  // ----------------------------------------------------------------------------
  // ADMIN API KEY MODAL
  // ----------------------------------------------------------------------------
  window.openApiKeyModal = function() {
    document.getElementById('adminKeyInput').value = localStorage.getItem('akron_admin_key') || '';
    document.getElementById('apiKeyModal').classList.add('open');
  };

  window.closeApiKeyModal = function() {
    document.getElementById('apiKeyModal').classList.remove('open');
  };

  window.saveApiKey = function() {
    const key = document.getElementById('adminKeyInput').value.trim();
    if (key) {
      localStorage.setItem('akron_admin_key', key);
      showToast('Admin API key saved to browser session.');
    } else {
      localStorage.removeItem('akron_admin_key');
      showToast('Using local development default access.');
    }
    window.closeApiKeyModal();
    window.loadCatalogProducts();
    window.loadPricingRequests();
    window.loadContactInquiries();
  };

  // ----------------------------------------------------------------------------
  // INITIALIZATION
  // ----------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function() {
    initCategoryPillsDelegation();
    initProductsEventDelegation();
    initContactTableDelegation();

    window.loadCatalogProducts();
    window.loadPricingRequests();
    window.loadContactInquiries();
  });
})();
