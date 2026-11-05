/**
 * Akron Generics - Interactive UI Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Accordion FAQ logic
  const faqItems = document.querySelectorAll('.faq-accordion-item');
  faqItems.forEach(item => {
    const trigger = item.querySelector('.faq-accordion-trigger');
    if (!trigger) return;

    trigger.addEventListener('click', () => {
      const isActive = item.classList.contains('active');
      
      // Close all others (optional single-open behavior)
      faqItems.forEach(other => {
        if (other !== item) {
          other.classList.remove('active');
          const otherTrigger = other.querySelector('.faq-accordion-trigger');
          if (otherTrigger) otherTrigger.setAttribute('aria-expanded', 'false');
        }
      });

      // Toggle current
      item.classList.toggle('active', !isActive);
      trigger.setAttribute('aria-expanded', String(!isActive));
    });
  });

  // Open first FAQ by default
  if (faqItems.length > 0) {
    faqItems[0].classList.add('active');
    const firstTrigger = faqItems[0].querySelector('.faq-accordion-trigger');
    if (firstTrigger) firstTrigger.setAttribute('aria-expanded', 'true');
  }

  // 2. Interactive NDC strip
  const ndcItems = document.querySelectorAll('.ndc-col-item');
  ndcItems.forEach(item => {
    item.addEventListener('click', () => {
      ndcItems.forEach(el => el.classList.remove('active'));
      item.classList.add('active');
    });
  });

  // 3. Mobile Navigation Menu Toggle
  const menuToggle = document.querySelector('.mobile-menu-toggle');
  const navLinks = document.querySelector('.nav-links');
  if (menuToggle && navLinks) {
    menuToggle.addEventListener('click', () => {
      navLinks.classList.toggle('active');
      const expanded = navLinks.classList.contains('active');
      menuToggle.setAttribute('aria-expanded', String(expanded));
    });
  }
});
