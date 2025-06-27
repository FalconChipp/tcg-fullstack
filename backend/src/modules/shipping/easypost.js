import fetch from 'node-fetch';

const API_KEY = process.env.EASYPOST_API_KEY;
const BASE_URL = 'https://api.easypost.com/v2';

function getHeaders() {
  const auth = Buffer.from(`${API_KEY}:`).toString('base64');
  return {
    'Content-Type': 'application/json',
    Authorization: `Basic ${auth}`,
  };
}

async function api(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...getHeaders(), ...(options.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`EasyPost API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function createShipment(to, from, parcel) {
  return api('/shipments', {
    method: 'POST',
    body: JSON.stringify({ shipment: { to_address: to, from_address: from, parcel } }),
  });
}

export async function buyShipment(shipmentId, rateId) {
  return api(`/shipments/${shipmentId}/buy`, {
    method: 'POST',
    body: JSON.stringify({ rate: { id: rateId } }),
  });
}

export async function refundShipment(shipmentId) {
  return api(`/shipments/${shipmentId}/refund`, { method: 'POST' });
}
