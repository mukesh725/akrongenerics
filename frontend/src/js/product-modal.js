/**
 * Akron Generics - Seed-Style Product Preview Modal
 * Minimalist luxury pharma layout:
 * - Warm neutral rounded media card
 * - Seed-style lime pill badge
 * - High-clarity product photography
 * - Editorial typography & soft-tinted spec box
 * - Dark forest green pill CTA & fine-print legal footnotes
 */

(function() {
  'use strict';

  function initProductModalDOM() {
    if (document.getElementById('productPreviewModal')) return;

    var modalHtml = `
      <div class="product-modal-overlay" id="productPreviewModal" onclick="if(event.target===this)closeProductPreview()" role="dialog" aria-modal="true" aria-labelledby="pModalTitle">
        <div class="product-modal-card">
          <!-- Minimalist × Close Button -->
          <button type="button" class="product-modal-close" onclick="closeProductPreview()" aria-label="Close product preview">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>

          <!-- Left Column: Edge-to-Edge Full-Bleed Rounded Image Card -->
          <div class="product-modal-media-card">
            <div class="seed-modal-badge" id="pModalBadge">
              <span class="seed-badge-dots" aria-hidden="true">
                <span class="seed-badge-dot"></span>
                <span class="seed-badge-dot"></span>
              </span>
              <span id="pModalBadgeText">HIGH AWP</span>
            </div>
            
            <div class="seed-modal-img-wrap">
              <img id="pModalImg" src="" alt="Product Preview">
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

    var itemTag = document.getElementById('pModalItemTag');
    if (itemTag) itemTag.textContent = 'ITEM #' + (product.itemNo || product.id || 'AKRON');

    var brandEl = document.getElementById('pModalBrand');
    if (brandEl) brandEl.textContent = product.brand || 'Akron Generics';

    var packEl = document.getElementById('pModalPackage');
    if (packEl) packEl.textContent = packSpec || product.specs || 'Standard Packaging';

    // Clear email input if previously entered
    var emailInput = document.getElementById('seedModalEmail');
    if (emailInput) emailInput.value = '';

    // Show modal
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    setTimeout(function() {
      var closeBtn = modal.querySelector('.product-modal-close');
      if (closeBtn) closeBtn.focus();
    }, 50);
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
