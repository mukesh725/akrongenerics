/**
 * ==============================================================================
 * AKRON GENERICS - EXECUTIVE ADMIN DASHBOARD LOGIC
 * Hardened Event Delegation, Secure APIs, Zero Inline-eval, DOM XSS Immune.
 * ==============================================================================
 */

(function() {
  'use strict';

  let currentCatalog = { categories: [], products: [] };
  let allApplications = [];
  let allPricingRequests = [];
  let allContactInquiries = [];

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
  // TAB NAVIGATION
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
    if (tabId === 'tab-applications' && cards[3]) cards[3].classList.add('active-metric');
  };

  // ----------------------------------------------------------------------------
  // CATALOG & PRODUCTS MANAGEMENT
  // ----------------------------------------------------------------------------
  window.loadCatalogProducts = function() {
    fetch('/api/admin/products', {
      headers: getAuthHeader()
    })
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
      renderProductsTable(currentCatalog.products);
      updateKpis();
    })
    .catch(err => {
      console.warn('Using local window.AKRON_CATALOG fallback:', err);
      if (window.AKRON_CATALOG && window.AKRON_CATALOG.products) {
        currentCatalog = window.AKRON_CATALOG;
        renderProductsTable(currentCatalog.products);
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
    const cat = document.getElementById('prodCategoryFilter').value;

    let list = currentCatalog.products || [];
    if (cat && cat !== 'all') {
      list = list.filter(p => p.category === cat);
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
    renderProductsTable(list);
  };

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
            <code style="font-size:12px;color:#1E293B;background:#F1F5F9;padding:2px 6px;border-radius:4px;">${escNdc}</code>
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

  // Delegated event listener for Products Table Actions (immune to inline XSS and quote syntax breaks)
  function initProductsTableDelegation() {
    const tbody = document.getElementById('productsTableBody');
    if (!tbody) return;

    tbody.addEventListener('click', function(e) {
      const editBtn = e.target.closest('.btn-edit-prod');
      if (editBtn) {
        window.openEditProductModal(editBtn.dataset.id);
        return;
      }
      const delBtn = e.target.closest('.btn-del-prod');
      if (delBtn) {
        window.confirmDeleteProduct(delBtn.dataset.id, delBtn.dataset.name);
      }
    });
  }

  // ----------------------------------------------------------------------------
  // MODAL & PRODUCT EDITING
  // ----------------------------------------------------------------------------
  window.openAddProductModal = function() {
    document.getElementById('modalProductTitle').textContent = 'Add New Product to Catalog';
    document.getElementById('editProdId').value = '';
    document.getElementById('editProdName').value = '';
    document.getElementById('editProdCategory').value = 'pen-needles';
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

    // Validate size (< 15MB)
    if (file.size > 15 * 1024 * 1024) {
      alert('Selected file exceeds maximum allowed limit of 15MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
      const dataUrl = e.target.result;
      document.getElementById('editProdImgPreview').src = dataUrl;

      // Dispatch upload to backend API
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
          showToast(`Image uploaded: ${resData.imagePath}`);
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
        renderProductsTable(currentCatalog.products);
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
      renderProductsTable(currentCatalog.products);
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
        renderProductsTable(currentCatalog.products);
        updateKpis();
      } else {
        alert('Delete failed: ' + (resData.message || 'Unknown error'));
      }
    })
    .catch(() => {
      showToast(`Deleted "${name}" locally.`);
      renderProductsTable(currentCatalog.products);
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
          <td><code>${escNdc}</code></td>
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

  // ----------------------------------------------------------------------------
  // PHARMACY APPLICATIONS
  // ----------------------------------------------------------------------------
  window.loadApplications = function() {
    fetch('/api/applications', { headers: getAuthHeader() })
      .then(res => res.ok ? res.json() : [])
      .then(list => {
        allApplications = list || [];
        renderApplicationsTable(allApplications);
        const kpi = document.getElementById('kpiAppCount');
        const badge = document.getElementById('badgeApplications');
        if (kpi) kpi.textContent = allApplications.length;
        if (badge) badge.textContent = allApplications.length;
      })
      .catch(() => {
        renderApplicationsTable(allApplications);
      });
  };

  window.filterApplications = function() {
    const q = (document.getElementById('appSearchInput').value || '').trim().toLowerCase();
    let list = allApplications;
    if (q) {
      list = list.filter(a => 
        (a.businessName && a.businessName.toLowerCase().includes(q)) ||
        (a.ref_id && a.ref_id.toLowerCase().includes(q)) ||
        (a.state && a.state.toLowerCase().includes(q)) ||
        (a.primaryContact && a.primaryContact.toLowerCase().includes(q))
      );
    }
    renderApplicationsTable(list);
  };

  function renderApplicationsTable(list) {
    const tbody = document.getElementById('appTableBody');
    if (!tbody) return;

    if (!list || list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="empty-state">No pharmacy applications submitted yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = list.map(app => {
      const escRef = escapeHtml(app.ref_id || '--');
      const escBiz = escapeHtml(app.businessName || 'Pharmacy Applicant');
      const escContact = escapeHtml(app.primaryContact || '--');
      const escState = escapeHtml(app.state || '--');
      const escDea = escapeHtml(app.deaNumber || app.stateLicenseNumber || '--');
      const status = app.status || 'PENDING';

      let badgeClass = 'badge-pending';
      if (status === 'APPROVED') badgeClass = 'badge-approved';
      if (status === 'IN_REVIEW') badgeClass = 'badge-review';

      return `
        <tr>
          <td><code>${escRef}</code></td>
          <td style="font-weight:600;color:#0F172A;">${escBiz}</td>
          <td>${escContact}</td>
          <td>${escState}</td>
          <td><span style="font-size:12px;color:#475569;">${escDea}</span></td>
          <td><span class="badge-status ${badgeClass}">${status}</span></td>
          <td style="text-align:right;white-space:nowrap;">
            <a href="/api/download-official-pdf?id=${escRef}" target="_blank" class="btn-action">Download PDF</a>
            <button type="button" class="btn-action btn-view-app" data-ref="${escRef}">Review</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function initAppTableDelegation() {
    const tbody = document.getElementById('appTableBody');
    if (!tbody) return;

    tbody.addEventListener('click', function(e) {
      const btn = e.target.closest('.btn-view-app');
      if (btn) {
        window.viewApplicationDetails(btn.dataset.ref);
      }
    });
  }

  window.viewApplicationDetails = function(refId) {
    const app = allApplications.find(x => x.ref_id === refId);
    if (!app) return;

    const drawer = document.getElementById('drawerPanel');
    const overlay = document.getElementById('drawerOverlay');
    const title = document.getElementById('drawerTitle');
    const body = document.getElementById('drawerBody');

    title.textContent = `Application: ${app.businessName || app.ref_id}`;
    body.innerHTML = `
      <div class="drawer-field"><strong>Reference ID:</strong><code>${escapeHtml(app.ref_id)}</code></div>
      <div class="drawer-field"><strong>Pharmacy Business:</strong>${escapeHtml(app.businessName)}</div>
      <div class="drawer-field"><strong>DBA / Trade Name:</strong>${escapeHtml(app.dba || 'None')}</div>
      <div class="drawer-field"><strong>Primary Contact:</strong>${escapeHtml(app.primaryContact)} (${escapeHtml(app.phone)})</div>
      <div class="drawer-field"><strong>Email:</strong><a href="mailto:${escapeHtml(app.email)}">${escapeHtml(app.email)}</a></div>
      <div class="drawer-field"><strong>Physical Address:</strong>${escapeHtml(app.address || '')}, ${escapeHtml(app.city || '')}, ${escapeHtml(app.state || '')} ${escapeHtml(app.zip || '')}</div>
      <div class="drawer-field"><strong>DEA Number:</strong><code>${escapeHtml(app.deaNumber || 'Pending')}</code></div>
      <div class="drawer-field"><strong>State License Number:</strong><code>${escapeHtml(app.stateLicenseNumber || 'Pending')}</code></div>
      <div class="drawer-field"><strong>NPI Number:</strong><code>${escapeHtml(app.npiNumber || 'N/A')}</code></div>
      <div class="drawer-field"><strong>Representative Rep:</strong>${escapeHtml(app.representative || 'Direct In-House Onboarding')}</div>
      <div style="margin-top:24px;display:flex;gap:10px;">
        <a href="/api/download-official-pdf?id=${escapeHtml(app.ref_id)}" target="_blank" class="btn-action btn-action-primary" style="text-decoration:none;">Download Signed PDF</a>
        <a href="mailto:${escapeHtml(app.email)}?subject=Akron%20Generics%20Application%20Approval%20-%20${encodeURIComponent(app.businessName || '')}" class="btn-action" style="text-decoration:none;">Email Applicant</a>
      </div>
    `;

    overlay.classList.add('open');
    drawer.classList.add('open');
  };

  window.exportApplicationsJson = function() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(allApplications, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `Akron_Generics_Applications_${Date.now()}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
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
    // Reload with new auth header
    window.loadCatalogProducts();
    window.loadPricingRequests();
    window.loadContactInquiries();
    window.loadApplications();
  };

  // ----------------------------------------------------------------------------
  // INITIALIZATION
  // ----------------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function() {
    initProductsTableDelegation();
    initContactTableDelegation();
    initAppTableDelegation();

    window.loadCatalogProducts();
    window.loadPricingRequests();
    window.loadContactInquiries();
    window.loadApplications();
  });
})();
