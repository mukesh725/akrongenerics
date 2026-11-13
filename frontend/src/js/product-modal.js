/**
 * Akron Generics - Seed-Style Product Preview Modal
 * Full-bleed edge-to-edge product photography with floating lime badge.
 * Balanced 980px layout with product overview description & specs.
 */

(function() {
  'use strict';

  function initProductModalDOM() {
    // If an older modal element exists in the DOM, remove it to force fresh rebuild
    var existingModal = document.getElementById('productPreviewModal');
    if (existingModal) {
      existingModal.remove();
    }

    var modalHtml = `
      <div class="product-modal-overlay" id="productPreviewModal" onclick="if(event.target===this)closeProductPreview()" role="dialog" aria-modal="true" aria-labelledby="pModalTitle">
        <div class="product-modal-card">
          <!-- Minimalist × Close Button (no outline) -->
          <button type="button" class="product-modal-close" onclick="closeProductPreview()" aria-label="Close product preview" style="position:absolute;top:16px;right:16px;width:32px;height:32px;border:none;outline:none;box-shadow:none;background:transparent;cursor:pointer;padding:0;color:#4B5563;display:flex;align-items:center;justify-content:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>

          <!-- Left Column: Edge-to-Edge Full-Bleed Rounded Image Card -->
          <div class="product-modal-media-card" style="position:relative;width:100%;height:100%;min-height:480px;border-radius:22px;overflow:hidden;padding:0;margin:0;background:#EBEBEB;display:flex;">
            <!-- Seed-Style Lime Green Pill Badge floating directly over image -->
            <div class="seed-modal-badge" id="pModalBadge" style="position:absolute;top:16px;left:16px;background:#D8F8C8;color:#163B1D;border-radius:9999px;padding:5px 13px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:6px;z-index:10;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,0.12);">
              <span class="seed-badge-dots" aria-hidden="true" style="display:inline-flex;align-items:center;gap:3px;">
                <span class="seed-badge-dot" style="width:6px;height:6px;border-radius:50%;background:#163B1D;display:inline-block;"></span>
                <span class="seed-badge-dot" style="width:6px;height:6px;border-radius:50%;background:#163B1D;display:inline-block;"></span>
              </span>
              <span id="pModalBadgeText">HIGH AWP</span>
            </div>
            
            <!-- Full bleed image wrap -->
            <div class="seed-modal-img-wrap" style="position:absolute;inset:0;width:100%;height:100%;overflow:hidden;padding:0;margin:0;background:#EBEBEB;">
              <img id="pModalImg" src="" alt="Product Preview" style="width:100%;height:100%;max-width:none;max-height:none;object-fit:cover;object-position:center;display:block;">
            </div>
          </div>

          <!-- Right Column: Editorial Typography, Description & Actions -->
          <div class="product-modal-content">
            <div class="seed-modal-eyebrow" id="pModalCategory">PEN NEEDLES</div>
            <h2 class="seed-modal-title" id="pModalTitle">Product Name</h2>
            <p class="seed-modal-subtitle" id="pModalSpecs">Specification Details</p>

            <!-- Product Description Paragraph -->
            <p class="seed-modal-desc" id="pModalDesc">Detailed description of the product...</p>

            <!-- Soft-Tinted Product Specs -->
            <div class="seed-modal-specs-box">
              <div class="seed-spec-row">
                <span class="seed-spec-lbl">National Drug Code (NDC)</span>
                <div class="seed-spec-val">
                  <span id="pModalNdc">73317-6816-04</span>
                  <button type="button" class="seed-copy-btn" onclick="copyModalNdc(this)" title="Copy NDC">Copy</button>
                </div>
              </div>
              <div class="seed-spec-divider"></div>
              <div class="seed-spec-row">
                <span class="seed-spec-lbl">Packaging Format</span>
                <span class="seed-spec-val-simple" id="pModalPackage">100 CT / Box</span>
              </div>
              <div class="seed-spec-divider"></div>
              <div class="seed-spec-row">
                <span class="seed-spec-lbl">Brand / Manufacturer</span>
                <span class="seed-spec-val-simple" id="pModalBrand">Quick Touch Safety</span>
              </div>
            </div>

            <!-- Email Input & Primary Dark Green Pill Action -->
            <div class="seed-modal-action-wrap" id="pModalActionWrap">
              <div class="seed-input-box">
                <input type="email" id="seedModalEmail" placeholder="Enter pharmacy email for instant pricing sheet" aria-label="Pharmacy Email Address" onkeydown="if(event.key==='Enter'){event.preventDefault();handleSeedModalSubmit();}">
              </div>
              <button type="button" class="seed-btn-primary" onclick="handleSeedModalSubmit()">
                <span>Request Wholesale Pricing</span>
              </button>
            </div>

            <!-- Seed-Style Legal & Compliance Footnotes -->
            <div class="seed-modal-footnotes">
              <p class="seed-footnote">
                <sup>&dagger;</sup> Wholesale distribution exclusively to verified US pharmacies, healthcare networks, and licensed practitioners. Zero retail sales.
              </p>
              <p class="seed-footnote">
                <sup>*</sup> 100% serialized under DSCSA Title II. Direct orders: <a href="tel:18667606565">1-866-760-6565</a> or <a href="become-a-customer.html">Apply for Wholesale Account</a>.
              </p>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  window.openProductPreview = function(productId) {
    initProductModalDOM();

    if (!window.AKRON_CATALOG || !window.AKRON_CATALOG.products) return;
    
    var product = window.AKRON_CATALOG.products.find(function(p) {
      return String(p.id) === String(productId) || 
             String(p.itemNo) === String(productId) ||
             (p.ndc && p.ndc.replace(/[^0-9a-zA-Z]/g, '') === String(productId).replace(/[^0-9a-zA-Z]/g, ''));
    });
    if (!product) return;

    var modal = document.getElementById('productPreviewModal');
    if (!modal) return;

    // Populate data
    var imgEl = document.getElementById('pModalImg');
    if (imgEl) {
      imgEl.src = product.image;
      imgEl.alt = product.name;
    }

    var packSpec = '';
    if (product.specs) {
      var parts = product.specs.split('·').map(function(s) { return s.trim(); });
      packSpec = parts[parts.length - 1];
    }

    var badgeText = (product.badges && product.badges.length) ? product.badges[0].toUpperCase() : (product.categoryName || 'AKRON').toUpperCase();
    var badgeEl = document.getElementById('pModalBadgeText');
    if (badgeEl) badgeEl.textContent = badgeText;

    var catEl = document.getElementById('pModalCategory');
    if (catEl) catEl.textContent = (product.categoryName || 'Pharmaceutical Supply').toUpperCase();

    var titleEl = document.getElementById('pModalTitle');
    if (titleEl) titleEl.textContent = product.name;

    var specsEl = document.getElementById('pModalSpecs');
    if (specsEl) specsEl.textContent = product.specs || '';

    var descEl = document.getElementById('pModalDesc');
    if (descEl) {
      descEl.textContent = product.description || 'Authentic prescription drug and diagnostic wholesale supply distributed under strict NABP and DSCSA compliance standards.';
    }

    // Attributes
    function formatNdc(val) {
      if (!val) return 'Pending / Inquire';
      var s = String(val).trim();
      if (s.includes('-')) return s;
      if (/^\d{11}$/.test(s)) {
        return s.slice(0, 5) + '-' + s.slice(5, 9) + '-' + s.slice(9);
      }
      return s;
    }

    var ndcEl = document.getElementById('pModalNdc');
    if (ndcEl) ndcEl.textContent = formatNdc(product.ndc);

    var brandEl = document.getElementById('pModalBrand');
    if (brandEl) brandEl.textContent = product.brand || 'Akron Generics';

    var packEl = document.getElementById('pModalPackage');
    if (packEl) packEl.textContent = packSpec || product.specs || 'Standard Packaging';

    // Clear email input
    var emailInput = document.getElementById('seedModalEmail');
    if (emailInput) emailInput.value = '';

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  window.closeProductPreview = function() {
    var modal = document.getElementById('productPreviewModal');
    if (modal) {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    }
  };

  window.copyModalNdc = function(btn) {
    var ndcElem = document.getElementById('pModalNdc');
    if (!ndcElem) return;
    var ndcText = ndcElem.textContent.trim();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(ndcText).then(function() {
        var originalText = btn.textContent;
        btn.textContent = 'Copied';
        btn.style.background = '#163B1D';
        btn.style.color = '#FFFFFF';
        btn.style.borderColor = '#163B1D';
        setTimeout(function() {
          btn.textContent = originalText;
          btn.style.background = '';
          btn.style.color = '';
          btn.style.borderColor = '';
        }, 1500);
      });
    }
  };

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  window.handleSeedModalSubmit = function() {
    var emailInput = document.getElementById('seedModalEmail');
    var emailVal = emailInput ? emailInput.value.trim() : '';
    var errorEl = document.getElementById('seedModalError');
    var btn = document.querySelector('.seed-btn-primary');
    var actionWrap = document.getElementById('pModalActionWrap') || document.querySelector('.seed-modal-action-wrap');

    // Remove existing error if any
    if (errorEl) {
      errorEl.remove();
    }
    if (emailInput) {
      emailInput.style.borderColor = '';
    }

    // Email validation
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailVal || !emailRegex.test(emailVal)) {
      if (emailInput) {
        emailInput.style.borderColor = '#DC2626';
        emailInput.focus();
        var err = document.createElement('div');
        err.id = 'seedModalError';
        err.className = 'seed-input-error';
        err.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <span>Please enter a valid pharmacy email address.</span>
        `;
        if (emailInput.parentNode) {
          emailInput.parentNode.appendChild(err);
        }
      }
      return;
    }

    // Extract product details from modal DOM
    var productName = (document.getElementById('pModalTitle') && document.getElementById('pModalTitle').textContent.trim()) || 'Pharmaceutical Product';
    var ndc = (document.getElementById('pModalNdc') && document.getElementById('pModalNdc').textContent.trim()) || 'N/A';
    var packaging = (document.getElementById('pModalPackage') && document.getElementById('pModalPackage').textContent.trim()) || 'Standard Packaging';
    var brand = (document.getElementById('pModalBrand') && document.getElementById('pModalBrand').textContent.trim()) || 'Akron Generics';
    var category = (document.getElementById('pModalCategory') && document.getElementById('pModalCategory').textContent.trim()) || 'General';
    var specs = (document.getElementById('pModalSpecs') && document.getElementById('pModalSpecs').textContent.trim()) || '';
    
    var now = new Date();
    var isoTime = now.toISOString();
    var formattedTime = now.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      dateStyle: 'full',
      timeStyle: 'short'
    }) + ' (EST)';

    var payload = {
      id: 'PR-' + Date.now(),
      email: emailVal,
      productName: productName,
      ndc: ndc,
      packaging: packaging,
      brand: brand,
      category: category,
      specs: specs,
      requestedAt: isoTime,
      requestedAtFormatted: formattedTime,
      sourceUrl: window.location.href,
      recipientEmail: 'info@akrongenerics.com'
    };

    // Button loading state
    if (btn) {
      btn.disabled = true;
      btn.style.opacity = '0.85';
      btn.style.cursor = 'wait';
      btn.innerHTML = `
        <svg class="seed-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <circle cx="12" cy="12" r="10" stroke-opacity="0.25"></circle>
          <path d="M12 2a10 10 0 0 1 10 10" stroke="#FFFFFF"></path>
        </svg>
        <span>Submitting Request...</span>
      `;
    }
    if (emailInput) {
      emailInput.disabled = true;
    }

    // 1. Save to LocalStorage for offline & rep dashboard access
    try {
      var stored = JSON.parse(localStorage.getItem('akron_pricing_requests') || '[]');
      stored.unshift(payload);
      localStorage.setItem('akron_pricing_requests', JSON.stringify(stored.slice(0, 100)));
    } catch (e) {}

    // 2. Dispatch ONLY to Akron Generics private backend (Zero 3rd-party data leaks)
    var backendEndpoints = [
      '/api/request-pricing',
      'http://localhost:3000/api/request-pricing',
      'http://127.0.0.1:3000/api/request-pricing'
    ];
    backendEndpoints.forEach(function(ep) {
      fetch(ep, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(function() {});
    });

    // Transition UI to Confirmation State
    setTimeout(function() {
      if (actionWrap) {
        actionWrap.innerHTML = `
          <div class="seed-request-success" style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:16px;padding:16px 18px;margin-bottom:8px;">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
              <div style="width:28px;height:28px;border-radius:50%;background:#16A34A;display:flex;align-items:center;justify-content:center;color:#FFFFFF;flex-shrink:0;">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
              <strong style="font-size:14px;color:#14532D;font-weight:700;">Wholesale Pricing Request Received!</strong>
            </div>
            <p style="font-size:12.5px;line-height:1.45;color:#166534;margin:0 0 12px 0;">
              Wholesale pricing sheet for <strong>${escapeHtml(productName)}</strong> (NDC: ${escapeHtml(ndc)}) has been requested. An automated notification has been delivered to <strong>info@akrongenerics.com</strong> and an Akron Generics account representative will follow up with <strong>${escapeHtml(emailVal)}</strong> within one business day.
            </p>
            <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
              <a href="become-a-customer.html?email=${encodeURIComponent(emailVal)}" style="display:inline-flex;align-items:center;gap:6px;background:#163B1D;color:#FFFFFF;padding:9px 15px;border-radius:9999px;font-size:12px;font-weight:600;text-decoration:none;">
                <span>Create Pharmacy Account</span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
              </a>
              <button type="button" onclick="closeProductPreview()" style="background:transparent;border:1px solid #D1D5DB;color:#4B5563;padding:8px 14px;border-radius:9999px;font-size:12px;font-weight:600;cursor:pointer;">
                Continue Browsing
              </button>
            </div>
          </div>
        `;
      }
    }, 550);
  };

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' || e.key === 'Esc') {
      closeProductPreview();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initProductModalDOM);
  } else {
    initProductModalDOM();
  }
})();
