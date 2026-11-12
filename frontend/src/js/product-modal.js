/**
 * Akron Generics - Seed-Style Product Preview Modal
 * Full-bleed edge-to-edge product photography with floating lime badge.
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
          <div class="product-modal-media-card" style="position:relative;width:100%;height:100%;min-height:440px;border-radius:20px;overflow:hidden;padding:0;margin:0;background:#EBEBEB;display:flex;">
            <!-- Seed-Style Lime Green Pill Badge floating directly over image -->
            <div class="seed-modal-badge" id="pModalBadge" style="position:absolute;top:14px;left:14px;background:#D8F8C8;color:#163B1D;border-radius:9999px;padding:5px 12px;font-size:11px;font-weight:700;display:inline-flex;align-items:center;gap:6px;z-index:10;pointer-events:none;box-shadow:0 2px 8px rgba(0,0,0,0.12);">
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

          <!-- Right Column: Editorial Typography & Actions -->
          <div class="product-modal-content">
            <div class="seed-modal-eyebrow" id="pModalCategory">PEN NEEDLES</div>
            <h2 class="seed-modal-title" id="pModalTitle">Product Name</h2>
            <p class="seed-modal-subtitle" id="pModalSpecs">Specification Details</p>

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
            <div class="seed-modal-action-wrap">
              <div class="seed-input-box">
                <input type="email" id="seedModalEmail" placeholder="Enter pharmacy email for instant pricing sheet" aria-label="Pharmacy Email Address">
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
    if (specsEl) specsEl.textContent = product.specs || product.description || '';

    // Attributes
    var ndcEl = document.getElementById('pModalNdc');
    if (ndcEl) ndcEl.textContent = product.ndc || 'Pending / Inquire';

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

  window.handleSeedModalSubmit = function() {
    var emailInput = document.getElementById('seedModalEmail');
    var emailVal = emailInput ? emailInput.value.trim() : '';
    
    var destination = 'become-a-customer.html';
    if (emailVal && emailVal.indexOf('@') > 0) {
      destination += '?email=' + encodeURIComponent(emailVal);
    }
    window.location.href = destination;
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
