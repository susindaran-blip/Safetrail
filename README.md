# SafeTrail: Smart Tourist Safety Monitoring and Incident Response

SafeTrail protects tourists before, during and after a trip, and helps authorities respond fast.

**Predict risk -> Prepare offline -> Detect danger -> Alert automatically -> Help authorities respond**

One website with two logins: **Tourist** and **Authority**.

## Problem
Tourists visiting hill stations and remote areas face weather risks, unsafe zones and patchy mobile networks. When something goes wrong, authorities have no real-time visibility and tourists may be unable to ask for help.

## Features

### Tourist
- Registration with name, phone, emergency contact, preferred language and optional medical info
- Permissions for location, motion sensors and notifications
- Destination selection (demo: Kodaikanal)
- **Safety Pack download** (PDF plus offline copy): risk score, danger and restricted zones, nearby hospitals and police stations, emergency numbers, emergency phrases (English, Tamil, Hindi), safety tips
- **Risk score** from live weather and terrain factors, with a written reason for every factor
- **Trek Mode** with faster location updates and an expected return time
- **Geofencing**: early warning before entering a high-risk area
- **Distress Sense** (simulated): impact, movement, sudden stop, loud sound and inactivity combine into a distress score
- **"Are you OK?"** 20-second prompt, then an automatic **Silent Alert** with no SOS button
- Offline alert queue: alerts are stored and sent when the connection returns

### Authority
- Dashboard counts: tourists on trip, Trek Mode, active alerts, tourists at risk, resolved today
- Live map with tourists, risk zones, police stations and hospitals
- Incident notifications; click one for full tourist details, medical ID, emergency contact, distress signals and location
- **Assign and inform** the nearest police station, or the nearest hospital for medical emergencies
- Response tracking: Received -> Assigned -> On the way -> Reached -> Resolved

## Tech Stack
| Layer | Technology |
|---|---|
| Frontend | React (Vite), React Router, Leaflet maps |
| Backend | Node.js, Express |
| Database | MongoDB Atlas (Mongoose) |
| Auth | JWT, bcrypt |
| PDF | PDFKit |
| Weather | Open-Meteo API (free, no key) |

## Architecture
```
Tourist App (React)  ->  Node.js + Express API  ->  MongoDB Atlas
                                  ^
Authority Dashboard (React)  -----+
```
The tourist never talks to the dashboard directly. Alerts go Tourist -> Backend -> Database -> Dashboard.

## Setup

**Requirements:** Node.js 18+, a free MongoDB Atlas cluster.

1. Install packages
   ```
   npm run install:all
   ```
2. Create `server/.env` (copy from `server/.env.example`)
   ```
   PORT=5000
   MONGODB_URI=mongodb+srv://<username>:<password>@<cluster>.mongodb.net/safetrail?retryWrites=true&w=majority
   JWT_SECRET=your_long_random_secret
   SEED_AUTHORITY_EMAIL=authority@safetrail.com
   SEED_AUTHORITY_PASSWORD=Admin@123
   ```
3. Optional demo data
   ```
   npm run seed
   ```
4. Start the app
   ```
   npm run dev
   ```
5. Open http://localhost:5173

## Demo Logins
| Role | Email | Password |
|---|---|---|
| Authority | authority@safetrail.com | Admin@123 |
| Tourist (after seed) | arjun@demo.com | Tourist@123 |

## Demo Flow
1. Register as a tourist and allow permissions.
2. Choose Kodaikanal and download the Safety Pack (a PDF is saved).
3. View the risk score and the reasons behind it.
4. Open the Live map, start Trek Mode, and run the simulated walk to a danger zone to see the geofence warning.
5. Open Distress Sense, trigger the signals, and let the "Are you OK?" countdown expire to send a silent alert.
6. Log in as Authority in another window, open the incident, assign the nearest hospital and police station, and move the status to Resolved.

## Data Sources
- **Weather:** live from Open-Meteo. If it is unreachable, the app falls back to simulated weather.
- **Risk score:** rule-based model combining weather (rain, fog, wind, temperature) with terrain and seasonal factors. Every factor adds points and a plain-language reason.
- **Safety data** (zones, hospitals, police, coordinates): prototype dataset for Kodaikanal with approximate coordinates. In production, this would come from official tourism, forest and police departments.
- **Emergency numbers:** national numbers (112, 100, 108, 101, 1363).

## What Is Real and What Is Simulated
| Real | Simulated |
|---|---|
| Registration, login, roles | Distress Sense sensor signals |
| Safety Pack PDF and offline copy | Kodaikanal zone and facility coordinates |
| Live-weather risk score | Authority "inform" (recorded, no real SMS or call) |
| Geofence warnings and incidents | |
| Offline alert queue | |
| Authority dashboard and assignment | |

## Folder Structure
```
safetrail/
  server/
    server.js
    models/        User.js, Alert.js
    routes/        auth, safety, tourist, authority
    data/          destinations.js
    utils/         risk.js, pdf.js, geo.js
    seed.js
  client/src/
    pages/         Login, TouristApp, Authority
    components/    Permissions, DestinationStep, Overview, LiveMap, Distress, PackView
    hooks.js       tracking, geofence, distress logic
```

## Future Scope
- Real sensor-based Distress Sense (accelerometer and microphone level)
- SMS and Bluetooth relay fallback for no-network areas
- Real-time updates with Socket.io
- Official government data feeds for zones and facilities
- Crowd-sourced dark-zone (no network) map
- Mobile app with React Native
- More destinations
