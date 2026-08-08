const BASE_URL = 'http://localhost:3001';

async function request(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API ${options.method || 'GET'} ${path} failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  getSystem:      () => request('/system'),
  getSensors:     () => request('/sensors'),
  getPump:        () => request('/pump'),
  getSprinklers:  () => request('/sprinklers'),
  getEventLog:    () => request('/eventLog?_sort=id&_order=desc&_limit=8'),

  patchSystem:    (body) => request('/system', { method: 'PATCH', body: JSON.stringify(body) }),
  patchSensors:   (body) => request('/sensors', { method: 'PATCH', body: JSON.stringify(body) }),
  patchPump:      (body) => request('/pump', { method: 'PATCH', body: JSON.stringify(body) }),
  patchSprinkler: (id, body) => request(`/sprinklers/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),

  postEvent: (entry) => request('/eventLog', { method: 'POST', body: JSON.stringify(entry) }),

  async getSnapshot() {
    const [system, sensors, pump, sprinklers, eventLog] = await Promise.all([
      this.getSystem(),
      this.getSensors(),
      this.getPump(),
      this.getSprinklers(),
      this.getEventLog(),
    ]);
    return { system, sensors, pump, sprinklers, eventLog };
  },
};
