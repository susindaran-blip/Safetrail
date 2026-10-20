const mongoose = require('mongoose');
const { Schema } = mongoose;

const Tourist = mongoose.model('Tourist', new Schema({
  name: String,
  phone: { type: String, unique: true },
  nationality: String,
  language: { type: String, default: 'en' },
  contacts: [{ name: String, phone: String }],
  medical: { bloodGroup: String, allergies: String, notes: String },
  lastSeen: Date,
  lastLocation: { lat: Number, lng: Number },
  battery: Number,
  trekMode: { type: Boolean, default: false },
  returnBy: Date,
  active: { type: Boolean, default: true },
}, { timestamps: true }));

const STATUSES = ['received', 'assigned', 'on_the_way', 'reached', 'resolved'];

const Alert = mongoose.model('Alert', new Schema({
  clientId: { type: String, unique: true, sparse: true }, // dedupe for offline sync
  tourist: { type: Schema.Types.ObjectId, ref: 'Tourist' },
  type: { type: String, enum: ['distress', 'sos', 'silent', 'heartbeat'], required: true },
  note: String,
  lat: Number,
  lng: Number,
  battery: Number,
  riskScore: Number,
  riskLevel: { type: String, enum: ['low', 'medium', 'high'] },
  status: { type: String, enum: STATUSES, default: 'received' },
  responder: { type: Schema.Types.ObjectId, ref: 'Responder' },
  timeline: [{ status: String, at: Date, note: String }],
  deviceTime: Date,
}, { timestamps: true }));

const Zone = mongoose.model('Zone', new Schema({
  name: String,
  category: { type: String, enum: ['crime', 'disaster', 'restricted', 'wildlife'] },
  level: { type: Number, min: 1, max: 3, default: 2 },
  lat: Number,
  lng: Number,
  radius: Number, // meters
  description: String,
}));

const Responder = mongoose.model('Responder', new Schema({
  name: String,
  type: { type: String, enum: ['police', 'medical', 'rescue'] },
  lat: Number,
  lng: Number,
  available: { type: Boolean, default: true },
}));

const HelpPoint = mongoose.model('HelpPoint', new Schema({
  name: String,
  type: { type: String, enum: ['hospital', 'police', 'embassy', 'pharmacy'] },
  lat: Number,
  lng: Number,
  phone: String,
}));

const DarkZone = mongoose.model('DarkZone', new Schema({
  key: { type: String, unique: true }, // rounded lat,lng (~110 m cell)
  lat: Number,
  lng: Number,
  hits: { type: Number, default: 1 },
}, { timestamps: true }));

module.exports = { Tourist, Alert, Zone, Responder, HelpPoint, DarkZone, STATUSES };