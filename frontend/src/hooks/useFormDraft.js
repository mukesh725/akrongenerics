// Form Draft Synchronization Hook & Utilities
export function saveFormDraft(formId, draftKey = 'akron_app_draft') {
  const form = document.getElementById(formId);
  if (!form) return;
  const formData = new FormData(form);
  const data = {};
  formData.forEach((val, key) => {
    data[key] = val;
  });
  try {
    localStorage.setItem(draftKey, JSON.stringify(data));
  } catch (e) {
    console.warn('Draft save error:', e);
  }
}

export function loadFormDraft(formId, draftKey = 'akron_app_draft') {
  const form = document.getElementById(formId);
  if (!form) return;
  const raw = localStorage.getItem(draftKey);
  if (!raw) return;
  try {
    const data = JSON.parse(raw);
    Object.keys(data).forEach(key => {
      const field = form.elements[key];
      if (field) {
        if (field.type === 'checkbox') {
          field.checked = Boolean(data[key]);
        } else if (field.type === 'radio') {
          if (field.value === data[key]) field.checked = true;
        } else {
          field.value = data[key];
        }
      }
    });
  } catch (err) {
    console.warn('Draft load error:', err);
  }
}

export function clearFormDraft(draftKey = 'akron_app_draft') {
  localStorage.removeItem(draftKey);
}
