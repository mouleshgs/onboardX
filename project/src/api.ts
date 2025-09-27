// Lightweight API client to centralize backend URL resolution
export const API_BASE = (typeof (import.meta as any) !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_BASE)
  ? (import.meta as any).env.VITE_API_BASE
  : (window && window.location && window.location.hostname === 'localhost' ? 'http://localhost:3000' : '');

async function request(path: string, opts?: RequestInit) {
  const url = (API_BASE ? API_BASE : '') + path;
  const res = await fetch(url, opts);
  return res;
}

export async function uploadContract(formData: FormData) {
  return request('/api/vendor/upload', { method: 'POST', body: formData });
}

export async function getContracts() {
  return request('/api/contracts');
}

export async function getVendorContracts(query = '') {
  return request(`/api/vendor/contracts${query ? ('?' + query) : ''}`);
}

export async function getContract(id: string) {
  return request(`/api/contract/${encodeURIComponent(id)}`);
}

export async function signContract(payload: any) {
  return request('/api/sign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

export async function getAccess(id: string) {
  return request(`/api/contract/${encodeURIComponent(id)}/access`);
}

export async function postEvent(id: string, event: string) {
  return request(`/api/contract/${encodeURIComponent(id)}/event`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event }) });
}

export async function postNudge(id: string, body: any) {
  return request(`/api/contract/${encodeURIComponent(id)}/nudge`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

export async function postIdentify(idToken: string, role: string) {
  return request('/api/user/identify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken, role }) });
}

export async function checkSlack(id: string) {
  return request(`/api/contract/${encodeURIComponent(id)}/check-slack`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
}

export async function checkNotion(id: string) {
  return request(`/api/contract/${encodeURIComponent(id)}/check-notion`);
}

export default {
  uploadContract,
  getContracts,
  getVendorContracts,
  getContract,
  signContract,
  getAccess,
  postNudge,
  postIdentify,
  postEvent,
  checkSlack,
  checkNotion
};
