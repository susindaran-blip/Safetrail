const { Zone, Alert, DarkZone } = require('./models');

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a)); // meters
}

// penalty by zone category and level (1..3)
const PENALTY = {
  crime: [8, 15, 25],
  disaster: [10, 20, 35],
  restricted: [15, 25, 40],
  wildlife: [5, 10, 18],
};

async function weatherPenalty(lat, lng) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&current=precipitation,wind_speed_10m,weather_code`;
    const res = await fetch(url, { signal: AbortSignal.timeout(2500) });
    const c = (await res.json()).current || {};
    if (c.weather_code >= 95) return { p: 25, r: 'Thunderstorm in the area' };
    if (c.precipitation >= 5) return { p: 15, r: 'Heavy rain' };
    if (c.wind_speed_10m >= 40) return { p: 10, r: 'Strong winds' };
  } catch (e) { /* offline or slow: ignore weather */ }
  return null;
}

async function computeRisk(lat, lng) {
  let score = 100;
  const reasons = [];

  const zones = await Zone.find();
  for (const z of zones) {
    if (haversine(lat, lng, z.lat, z.lng) <= z.radius) {
      const p = PENALTY[z.category][z.level - 1];
      score -= p;
      reasons.push(`${z.name} (${z.category}, level ${z.level})`);
    }
  }

  const hour = new Date().getHours();
  if (hour >= 22 || hour < 5) { score -= 15; reasons.push('Night time'); }

  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const recent = await Alert.find({ createdAt: { $gte: since } });
  const near = recent.filter((a) => haversine(lat, lng, a.lat, a.lng) <= 1000).length;
  if (near) { score -= Math.min(25, near * 5); reasons.push(`${near} recent incident(s) nearby`); }

  const darks = await DarkZone.find();
  if (darks.some((d) => haversine(lat, lng, d.lat, d.lng) <= 1000)) {
    score -= 10; reasons.push('No network coverage nearby');
  }

  const w = await weatherPenalty(lat, lng);
  if (w) { score -= w.p; reasons.push(w.r); }

  score = Math.max(0, Math.min(100, score));
  const level = score >= 70 ? 'low' : score >= 40 ? 'medium' : 'high';
  return { score, level, reasons };
}

module.exports = { computeRisk, haversine };