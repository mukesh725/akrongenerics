// Base API Service for Akron Generics & AIRO Group
const API_BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

export async function fetchApplications() {
  const response = await fetch(`${API_BASE_URL}/api/applications`);
  if (!response.ok) {
    throw new Error(`Failed to fetch applications: ${response.statusText}`);
  }
  return response.json();
}

export async function submitApplication(payload) {
  const response = await fetch(`${API_BASE_URL}/api/become-a-customer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    throw new Error(`Submission failed: ${response.statusText}`);
  }
  return response.json();
}

export function getOfficialPdfUrl(refId) {
  return `${API_BASE_URL}/api/download-official-pdf?id=${encodeURIComponent(refId)}`;
}
