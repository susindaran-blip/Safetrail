// Demo data around Munnar, Kerala. Change the coordinates to your demo location.
require('dotenv').config();
const mongoose = require('mongoose');
const { Zone, Responder, HelpPoint, DarkZone } = require('./models');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([Zone.deleteMany(), Responder.deleteMany(), HelpPoint.deleteMany(), DarkZone.deleteMany()]);

  await Zone.insertMany([
    { name: 'Landslide-prone slope', category: 'disaster', level: 3, lat: 10.0950, lng: 77.0700, radius: 1200, description: 'Heavy rain landslides' },
    { name: 'Wild elephant corridor', category: 'wildlife', level: 2, lat: 10.0700, lng: 77.0400, radius: 1500, description: 'Avoid after dusk' },
    { name: 'Market pickpocket area', category: 'crime', level: 1, lat: 10.0889, lng: 77.0595, radius: 500, description: 'Crowded, watch belongings' },
    { name: 'Restricted forest reserve', category: 'restricted', level: 3, lat: 10.1100, lng: 77.0300, radius: 2000, description: 'Entry without permit prohibited' },
  ]);

  await Responder.insertMany([
    { name: 'Police Unit 1', type: 'police', lat: 10.0880, lng: 77.0610 },
    { name: 'Ambulance 1', type: 'medical', lat: 10.0920, lng: 77.0650 },
    { name: 'Forest Rescue Team', type: 'rescue', lat: 10.0780, lng: 77.0500 },
  ]);

  await HelpPoint.insertMany([
    { name: 'Government Hospital', type: 'hospital', lat: 10.0905, lng: 77.0620, phone: '108' },
    { name: 'Munnar Police Station', type: 'police', lat: 10.0870, lng: 77.0590, phone: '100' },
    { name: 'Pharmacy Central', type: 'pharmacy', lat: 10.0895, lng: 77.0580, phone: '' },
  ]);

  await DarkZone.insertMany([
    { key: '10.080,77.045', lat: 10.080, lng: 77.045, hits: 5 },
    { key: '10.105,77.035', lat: 10.105, lng: 77.035, hits: 8 },
  ]);

  console.log('Seed complete');
  process.exit(0);
})();