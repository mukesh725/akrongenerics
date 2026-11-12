/**
 * Akron Generics - Product Preview Modal
 * Provides interactive quick-view modal with full product intelligence,
 * high-res imagery, NDC copying, and direct pharmacy ordering pathways.
 */

(function() {
  'use strict';

  function initProductModalDOM() {
    if (document.getElementById('productPreviewModal')) return;

    var modalHtml = `
      <div class="product-modal-overlay" id="productPreviewModal" onclick="if(event.target===this)closeProductPreview()" role="dialog" aria-modal="true" aria-labelledby="pModalTitle">
        <div class="product-modal-card">
          <button type="button" class="product-modal-close" onclick="closeProductPreview()" aria-label="Close product preview">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>

          <!-- Left Media Column -->
          <div class="product-modal-media">
            <span class="product-modal-badge-floating" id="pModalBadge">HIGH AWP</span>
            <div class="product-modal-img-wrap">
              <img id="pModalImg" src="" alt="Product Preview">
            </div>
            <div class="product-modal-caption">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              <span>100% Authentic &bull; Serialized DSCSA Track &amp; Trace</span>
            </div>
          </div>

          <!-- Right Information Column -->
          <div class="product-modal-info">
            <div class="product-modal-eyebrow" id="pModalCategory">PEN NEEDLES</div>
            <h2 class="product-modal-title" id="pModalTitle">Product Name</h2>
            <div class="product-modal-specs-sub" id="pModalSpecs">Specification Details</div>

            <div class="product-modal-tags" id="pModalTags">
              <span class="product-modal-tag tag-accent">High AWP</span>
              <span class="product-modal-tag">NABP Accredited</span>
            </div>

            <!-- Attributes Grid -->
            <div class="product-modal-grid">
              <div class="product-modal-attr">
                <span class="product-modal-attr-lbl">National Drug Code (NDC)</span>
                <span class="product-modal-attr-val">
                  <span id="pModalNdc">73317-6816-04</span>
                  <button type="button" class="product-modal-copy-ndc" onclick="copyModalNdc(this)" title="Copy NDC to clipboard">Copy</button>
                </span>
              </div>
              <div class="product-modal-attr">
                <span class="product-modal-attr-lbl">Akron Item Number</span>
                <span class="product-modal-attr-val" id="pModalItemNo">18366</span>
              </div>
              <div class="product-modal-attr">
                <span class="product-modal-attr-lbl">Brand / Manufacturer</span>
                <span class="product-modal-attr-val" id="pModalBrand">Quick Touch Safety</span>
              </div>
              <div class="product-modal-attr">
                <span class="product-modal-attr-lbl">Packaging Format</span>
                <span class="product-modal-attr-val" id="pModalPackage">100 CT / Box</span>
              </div>
            </div>

            <!-- Clinical / Product Description -->
            <div class="product-modal-desc-heading">Product Overview &amp; Specifications</div>
            <p class="product-modal-desc" id="pModalDesc">Detailed description of the product...</p>

            <!-- Action Buttons -->
            <div class="product-modal-actions">
              <a href="become-a-customer.html" class="product-modal-btn-primary">
                <span>Request Wholesale Pricing</span>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>
              <a href="tel:18667606565" class="product-modal-btn-secondary">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                <span>1-866-760-6565</span>
              </a>
            </div>

            <!-- Compliance Note -->
            <div class="product-modal-assurance">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              <span>NABP Drug Distributor Accredited &bull; DSCSA T3 Pedigree Verified</span>
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
    var badgeEl = document.getElementById('pModalBadge');
    if (badgeEl) badgeEl.textContent = badgeText;

    var catEl = document.getElementById('pModalCategory');
    if (catEl) catEl.textContent = (product.categoryName || 'Pharmaceutical Supply').toUpperCase();

    var titleEl = document.getElementById('pModalTitle');
    if (titleEl) titleEl.textContent = product.name;

    var specsEl = document.getElementById('pModalSpecs');
    if (specsEl) specsEl.textContent = product.specs || '';

    // Tags
    var tagsContainer = document.getElementById('pModalTags');
    if (tagsContainer) {
      var tagsHtml = '';
      if (product.badges && product.badges.length) {
        product.badges.forEach(function(b) {
          tagsHtml += '<span class="product-modal-tag tag-accent">' + b + '</span>';
        });
      }
      tagsHtml += '<span class="product-modal-tag">NABP Accredited</span>';
      tagsHtml += '<span class="product-modal-tag">DSCSA Verified</span>';
      tagsContainer.innerHTML = tagsHtml;
    }

    // Attributes
    var ndcEl = document.getElementById('pModalNdc');
    if (ndcEl) ndcEl.textContent = product.ndc || 'Pending / Inquire';

    var itemEl = document.getElementById('pModalItemNo');
    if (itemEl) itemEl.textContent = product.itemNo || product.id || 'N/A';

    var brandEl = document.getElementById('pModalBrand');
    if (brandEl) brandEl.textContent = product.brand || 'Akron Generics';

    var packEl = document.getElementById('pModalPackage');
    if (packEl) packEl.textContent = packSpec || product.specs || 'Standard Packaging';

    // Description
    var descEl = document.getElementById('pModalDesc');
    if (descEl) {
      descEl.textContent = product.description || 'Authentic prescription drug and diagnostic wholesale supply distributed under strict NABP and DSCSA compliance standards.';
    }

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
        btn.textContent = 'Copied!';
        btn.style.background = '#059669';
        btn.style.color = '#FFFFFF';
        setTimeout(function() {
          btn.textContent = originalText;
          btn.style.background = '';
          btn.style.color = '';
        }, 1500);
      });
    }
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
