require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const { Tourist, Alert, Zone, Responder, HelpPoint, DarkZone, STATUSES } = require('./models');
const { computeRisk, haversine } = require('./risk');

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ---------- auth (dashboard only) ----------
function requireAuth(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  try { jwt.verify(token, process.env.JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Unauthorized' }); }
}

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  if (username === process.env.ADMIN_USER && password === process.env.ADMIN_PASS) {
    return res.json({ token: jwt.sign({ role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '12h' }) });
  }
  res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date() }));

// ---------- tourists ----------
app.post('/api/tourists/register', async (req, res) => {
  const { name, phone, nationality, language, contacts, medical } = req.body;
  if (!name || !phone) return res.status(400).json({ error: 'name and phone required' });
  const t = await Tourist.findOneAndUpdate(
    { phone },
    { name, phone, nationality, language, contacts, medical },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  res.json(t);
});

app.get('/api/tourists', requireAuth, async (req, res) => {
  res.json(await Tourist.find({ active: true }));
});

// heartbeat: sent regularly by the app while online
app.post('/api/heartbeat', async (req, res) => {
  const { touristId, lat, lng, battery, trekMode, returnBy } = req.body;
  const t = await Tourist.findByIdAndUpdate(touristId, {
    lastSeen: new Date(),
    lastLocation: { lat, lng },
    battery,
    trekMode: !!trekMode,
    returnBy: returnBy ? new Date(returnBy) : null,
  }, { new: true });
  if (!t) return res.status(404).json({ error: 'Tourist not found' });
  io.emit('tourist:update', t);
  res.json({ ok: true });
});

// ---------- risk + safety pack ----------
app.get('/api/risk', async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'lat,lng required' });
  res.json(await computeRisk(lat, lng));
});

// everything the app needs offline for a destination
app.get('/api/safety-pack', async (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  const radiusKm = Number(req.query.radiusKm) || 30;
  const within = (o) => haversine(lat, lng, o.lat, o.lng) <= radiusKm * 1000;
  const [zones, help, dark, risk] = await Promise.all([
    Zone.find(), HelpPoint.find(), DarkZone.find(), computeRisk(lat, lng),
  ]);
  res.json({
    center: { lat, lng },
    radiusKm,
    risk,
    zones: zones.filter(within),
    helpPoints: help.filter(within),
    darkZones: dark.filter(within),
    downloadedAt: new Date(),
  });
});

// ---------- zones ----------
app.get('/api/zones', async (req, res) => res.json(await Zone.find()));
app.post('/api/zones', requireAuth, async (req, res) => {
  const z = await Zone.create(req.body);
  io.emit('zone:update');
  res.json(z);
});
app.delete('/api/zones/:id', requireAuth, async (req, res) => {
  await Zone.findByIdAndDelete(req.params.id);
  io.emit('zone:update');
  res.json({ ok: true });
});

// ---------- dark zones (network coverage holes) ----------
app.post('/api/darkzones', async (req, res) => {
  const points = req.body.points || [];
  for (const p of points) {
    const key = `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
    await DarkZone.findOneAndUpdate(
      { key },
      { $setOnInsert: { lat: p.lat, lng: p.lng }, $inc: { hits: 1 } },
      { upsert: true }
    );
  }
  res.json({ ok: true, count: points.length });
});
app.get('/api/darkzones', async (req, res) => res.json(await DarkZone.find()));

// ---------- alerts ----------
async function createAlert({ tourist, type, lat, lng, battery, note, clientId, deviceTime }) {
  if (clientId) {
    const existing = await Alert.findOne({ clientId });
    if (existing) return existing; // already synced
  }
  const risk = await computeRisk(lat, lng);
  const alert = await Alert.create({
    clientId, tourist, type, note, lat, lng, battery,
    riskScore: risk.score, riskLevel: risk.level,
    deviceTime: deviceTime ? new Date(deviceTime) : new Date(),
    timeline: [{ status: 'received', at: new Date(), note: note || type }],
  });
  const full = await Alert.findById(alert._id).populate('tourist responder');
  io.emit('alert:new', full);
  return full;
}

app.post('/api/alerts', async (req, res) => {
  const b = req.body;
  if (!b.touristId || !b.type) return res.status(400).json({ error: 'touristId and type required' });
  res.json(await createAlert({ ...b, tourist: b.touristId }));
});

// sync alerts that were stored while offline
app.post('/api/alerts/bulk', async (req, res) => {
  const out = [];
  for (const b of req.body.alerts || []) out.push(await createAlert({ ...b, tourist: b.touristId }));
  res.json({ synced: out.length });
});

app.get('/api/alerts', requireAuth, async (req, res) => {
  const q = req.query.open ? { status: { $ne: 'resolved' } } : {};
  res.json(await Alert.find(q).sort({ createdAt: -1 }).limit(200).populate('tourist responder'));
});

// the tourist app polls this to show response status
app.get('/api/alerts/:id/status', async (req, res) => {
  const a = await Alert.findById(req.params.id).populate('responder');
  if (!a) return res.status(404).json({ error: 'Not found' });
  res.json({ status: a.status, responder: a.responder, timeline: a.timeline });
});

app.get('/api/alerts/:id/nearest-responders', requireAuth, async (req, res) => {
  const a = await Alert.findById(req.params.id);
  const list = await Responder.find({ available: true });
  const sorted = list
    .map((r) => ({ responder: r, distanceM: Math.round(haversine(a.lat, a.lng, r.lat, r.lng)) }))
    .sort((x, y) => x.distanceM - y.distanceM);
  res.json(sorted);
});

async function setStatus(id, status, extra = {}) {
  const a = await Alert.findById(id);
  if (!a) return null;
  a.status = status;
  Object.assign(a, extra);
  a.timeline.push({ status, at: new Date() });
  await a.save();
  if (status === 'resolved') {
    if (a.responder) await Responder.findByIdAndUpdate(a.responder, { available: true });
    // reset silence timer so a resolved heartbeat alert does not immediately repeat
    if (a.type === 'heartbeat') await Tourist.findByIdAndUpdate(a.tourist, { lastSeen: new Date() });
  }
  const full = await Alert.findById(id).populate('tourist responder');
  io.emit('alert:update', full);
  return full;
}

app.patch('/api/alerts/:id/assign', requireAuth, async (req, res) => {
  const { responderId } = req.body;
  await Responder.findByIdAndUpdate(responderId, { available: false });
  res.json(await setStatus(req.params.id, 'assigned', { responder: responderId }));
});

app.patch('/api/alerts/:id/status', requireAuth, async (req, res) => {
  if (!STATUSES.includes(req.body.status)) return res.status(400).json({ error: 'Bad status' });
  res.json(await setStatus(req.params.id, req.body.status));
});

// ---------- responders ----------
app.get('/api/responders', requireAuth, async (req, res) => res.json(await Responder.find()));
app.post('/api/responders', requireAuth, async (req, res) => res.json(await Responder.create(req.body)));

// ---------- broadcast safety warnings ----------
app.post('/api/broadcast', requireAuth, (req, res) => {
  const payload = { ...req.body, sentAt: new Date() }; // {title, message, lat, lng, radiusKm}
  io.emit('broadcast', payload);
  res.json({ ok: true });
});

// ---------- Heartbeat Guard: server-side silence detection ----------
setInterval(async () => {
  try {
    const now = Date.now();
    const limit = (Number(process.env.HEARTBEAT_LIMIT_MIN) || 10) * 60000;
    const tourists = await Tourist.find({ active: true, lastSeen: { $ne: null } });
    for (const t of tourists) {
      const silentMs = now - t.lastSeen.getTime();
      const overdue = t.trekMode && t.returnBy && now > t.returnBy.getTime();
      if (silentMs < limit && !overdue) continue;
      const open = await Alert.findOne({ tourist: t._id, type: 'heartbeat', status: { $ne: 'resolved' } });
      if (open) continue;
      const note = overdue
        ? 'Trek return time missed'
        : `No heartbeat for ${Math.round(silentMs / 60000)} min (last-known location)`;
      await createAlert({
        tourist: t._id, type: 'heartbeat', note,
        lat: t.lastLocation?.lat, lng: t.lastLocation?.lng, battery: t.battery,
      });
    }
  } catch (e) { console.error('Heartbeat monitor error:', e.message); }
}, 30000);

// ---------- start ----------
const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI)
  .then(() => server.listen(PORT, '0.0.0.0', () => console.log(`SafeTrail API running on port ${PORT}`)))
  .catch((e) => { console.error('MongoDB connection failed:', e.message); process.exit(1); });