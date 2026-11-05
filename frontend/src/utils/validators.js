// Validation Rules for Customer Form & Regulatory Fields
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim().toLowerCase());
}

export function isValidDea(dea) {
  return /^[A-Z]{2}\d{7}$/i.test(String(dea || '').trim());
}

export function isValidRouting(routing) {
  return /^\d{9}$/.test(String(routing || '').trim());
}

export function isValidCardNumber(num) {
  const clean = String(num || '').replace(/\D/g, '');
  return clean.length >= 15 && clean.length <= 16;
}
