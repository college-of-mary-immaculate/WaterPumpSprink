const DB = {
  system: { id: 1, targetLevel: 78, targetPressure: 65, mode: 'AUTO' },
  sensors: { id: 1, smoke: 3, heat: 12, pressure: 41, tankLevel: 62 },
  pump: { id: 1, speed: 0, rpm: 0, status: 'IDLE' },
  sprinklers: [
    { id: 1, zone: 'Zone A \u2014 Warehouse Floor', valve: 0, status: 'CLOSED' },
    { id: 2, zone: 'Zone B \u2014 Server Room', valve: 0, status: 'CLOSED' },
    { id: 3, zone: 'Zone C \u2014 Loading Dock', valve: 0, status: 'CLOSED' },
    { id: 4, zone: 'Zone D \u2014 Office Wing', valve: 0, status: 'CLOSED' },
  ],
  eventLog: [{ id: 1, t: '00:00:00', msg: 'SYSTEM BOOT \u2014 offline mock API (json-server unreachable)', level: 'WARN' }],
};

const wait = () => new Promise((r) => setTimeout(r, 15));

export const localApi = {
  async getSystem() { await wait(); return { ...DB.system }; },
  async getSensors() { await wait(); return { ...DB.sensors }; },
  async getPump() { await wait(); return { ...DB.pump }; },
  async getSprinklers() { await wait(); return DB.sprinklers.map((s) => ({ ...s })); },
  async getEventLog() { await wait(); return [...DB.eventLog].sort((a, b) => b.id - a.id).slice(0, 8); },

  async patchSystem(body) { await wait(); Object.assign(DB.system, body); return { ...DB.system }; },
  async patchSensors(body) { await wait(); Object.assign(DB.sensors, body); return { ...DB.sensors }; },
  async patchPump(body) { await wait(); Object.assign(DB.pump, body); return { ...DB.pump }; },
  async patchSprinkler(id, body) {
    await wait();
    const s = DB.sprinklers.find((x) => x.id === id);
    Object.assign(s, body);
    return { ...s };
  },
  async postEvent(entry) {
    await wait();
    const id = DB.eventLog.length ? Math.max(...DB.eventLog.map((e) => e.id)) + 1 : 1;
    const record = { id, ...entry };
    DB.eventLog.push(record);
    if (DB.eventLog.length > 40) DB.eventLog.shift();
    return record;
  },

  async patchTelemetry(sensors, pump, sprinklers) {
    await wait();
    Object.assign(DB.sensors, sensors);
    Object.assign(DB.pump, pump);
    sprinklers.forEach((z) => {
      const s = DB.sprinklers.find((x) => x.id === z.id);
      if (s) Object.assign(s, { valve: z.valve, status: z.status });
    });
  },

  async getSnapshot() {
    const [system, sensors, pump, sprinklers, eventLog] = await Promise.all([
      this.getSystem(), this.getSensors(), this.getPump(), this.getSprinklers(), this.getEventLog(),
    ]);
    return { system, sensors, pump, sprinklers, eventLog };
  },
};
