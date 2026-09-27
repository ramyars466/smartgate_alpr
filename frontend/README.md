# SmartGate AI

# Role & Objective
You are an expert Full-Stack React & UI/UX Engineer. Your objective is to build "SmartGate ALPR" — a complete, fully interactive, multi-page enterprise web application for an AI-powered Automated License Plate Recognition (ALPR) system deployed in a smart residential society. 

The website must be 100% functional out-of-the-box using a robust mock state engine (React Context / Zustand), allowing every feature, toggle, upload, modal, chart, and alert to work interactively before connecting to a live FastAPI backend.

---

# Architecture & Design System

## Tech Stack
- Framework: React (Vite / Next.js) with React Router for multi-page navigation.
- Styling: Tailwind CSS (Dark Mode Slate/Navy `#0B0F17`), Lucide-React Icons, Glassmorphism cards (`bg-slate-900/80 backdrop-blur-md border border-slate-800`).
- Charts & Visualization: Recharts or Chart.js for security analytics.
- Sound & FX: Web Audio API / HTML5 Audio for real-time security alerts.

## Global Layout (Header & Sidebar)
- Header: Real-time clock (IST), Gate Selector (`Main Gate - Entry`, `North Gate - Exit`, `Service Gate`), Live Connection Status Indicator (`WebSocket: Connected (18 ms)`), Audio Alarm Toggle (Mute/Unmute), and Emergency Override Button.
- Sidebar Navigation:
  1. Live Gate Monitor & Scanner
  2. Visitor Pre-Approval & Pass Generator
  3. Vehicle Directory & Blacklist Manager
  4. Access Audit Logs & Reports
  5. Society Occupancy & Traffic Analytics
  6. System & Hardware API Configuration

---

# Detailed Page Specifications & Expected Outputs

## Page 1: Live Gate Monitor & Scanner (`/`)
This is the primary operational dashboard for security personnel.

### A. Dual Scanning Input Section
- Toggle Switch: `[Live RTSP Video Stream]` vs `[Manual File Upload]`.
- Live RTSP Stream View: A video player viewport simulating a live camera feed. Overlaid on the feed is an interactive canvas drawing a neon-blue bounding box around license plates as vehicles pass.
- Manual Upload View: Drag-and-drop file uploader accepting JPEG/PNG vehicle photos. Includes pre-loaded "Sample Test Images" (Resident Car, Visitor Car, Stolen Plate, Muddy/Damaged Plate) so the user can test the pipeline with one click.

### B. Output Panel (Real-Time AI Scan Results)
When an image is scanned or simulated, immediately render:
1. Status Banner:
   - Green (`#10B981`): "ACCESS GRANTED — RESIDENT" (Plays soft chime).
   - Amber (`#F59E0B`): "VISITOR GRANTED — Valid until 10:00 PM".
   - Red (`#EF4444`): "ACCESS DENIED — UNREGISTERED VEHICLE".
   - Pulsing Red + Audio Alarm: "CRITICAL ALERT: BLACKLISTED VEHICLE DETECTED".
2. Extracted Visuals & Data Grid:
   - Original Image with YOLOv8 Green Bounding Box overlay.
   - Cropped Plate Image Preview.
   - Large Monospace OCR Text Display (e.g., `KL 65 H 4383`).
   - Secondary AI Classification: Vehicle Make/Model/Color (e.g., "White Tata Altroz").
3. Advanced Edge-Case Modules (Must be visible when triggered):
   - Stolen Plate / Mismatch Alert: If plate `KL65H4383` is registered to a "White Hatchback" but the AI detects a "Black SUV", show a yellow warning banner: "Plate / Vehicle Type Mismatch Flagged".
   - Fuzzy Logic OCR Correction Prompt: If the OCR reads a muddy plate as `KL65H43B3`, display a card: "88% Match with Resident Plate KL65H4383" with a one-click `[Confirm & Grant Access]` button.
   - Performance Metrics: Badges showing `Detection Speed: 112 ms`, `YOLO Confidence: 98.4%`, `OCR Confidence: 94.2%`.
4. Gate Control Hardware Simulator: A visual status box showing "Physical Boom Barrier: OPEN" with a 5-second countdown timer to auto-close.

---

## Page 2: Visitor Pre-Approval & Gate Pass Generator (`/visitors`)
- Form Section: Residents can pre-register guests by entering: Guest Name, Guest Phone Number, Vehicle Plate Number, Expected Entry Date/Time, and Visiting Flat Number.
- Digital Pass Generator Card: On submission, render an instant downloadable/shareable "Digital Gate Pass Card" with a unique QR code, plate badge, and expiration timestamp.
- Active Visitor Passes Table: List of currently approved guests with an option to `[Revoke Pass]` or `[Extend Time]`.

---

## Page 3: Vehicle Directory & Blacklist Manager (`/directory`)
- Top Bar: Search input (by plate or owner name), filter by category (`All`, `Residents`, `Pre-Approved Visitors`, `Blacklisted`), and a `[+ Register New Vehicle]` modal.
- Vehicle Directory Table:
  - Columns: Owner Name, Flat Number, Plate Number Badge, Vehicle Make/Color, Category Badge, Registration Date, Actions (`Edit`, `Delete`, `Toggle Blacklist`).
- Blacklist Action: Toggling a vehicle to "Blacklisted" turns its row red and automatically adds it to the active security alarm trigger list.

---

## Page 4: Access Audit Logs & Reports (`/logs`)
- Interactive Search & Filter Bar: Date Range Picker, Filter by Gate ID, Filter by Access Status (`Granted`, `Denied`, `Blacklisted Alert`, `Overstay`), and Plate Search.
- CSV Report Exporter: A working `[Export CSV Report]` button that compiles the current table view into a downloadable `.csv` file.
- Audit Trail Table:
  - Columns: Timestamp, Gate Location, Snapshot Thumbnail, Cropped Plate, Extracted Text, Status Badge, Guard Notes.
  - Interactive Modal: Clicking any row opens a full "Incident Report Modal" showing high-resolution images, detailed AI confidence scores, and time spent inside the premises.

---

## Page 5: Society Occupancy & Traffic Analytics (`/analytics`)
- Top Metric Cards:
  - `Vehicles Currently Inside`: Live Counter (e.g., 142 / 200 slots filled).
  - `Total Entries Today`: Counter with percentage comparison to yesterday.
  - `Overstay Violations`: Active count of visitors who exceeded their 4-hour limit.
- Visual Charts (Using Recharts):
  - Hourly Traffic Flow (Line chart showing peak entry/exit hours).
  - Category Distribution (Donut chart showing Residents vs Visitors vs Delivery Vehicles).
- Overstay Alert List: Table listing vehicles currently violating time limits with a `[Notify Resident via WhatsApp]` simulation button.

---

## Page 6: System & Hardware API Config (`/config`)
- Live Hardware Settings:
  - FastAPI Endpoint Input (`http://localhost:8000/api/v1`).
  - RTSP Stream URL Input (`rtsp://192.168.1.100:554/stream1`).
  - WebSocket Status Monitor with ping/latency chart.
  - IoT Relay Test: A `[Test Relay Trigger]` button that simulates sending a signal to a physical Raspberry Pi / Servo Motor gate controller.

---

# Functional State Engine Requirements

Build a dedicated `src/context/ALPRContext.tsx` or `src/services/mockEngine.ts` that powers the web application out-of-the-box:

1. Interactive Simulation Controls: Add a persistent floating "Simulator Toolbar" at the bottom right of the screen with quick buttons:
   - `[Simulate Resident]` -> Triggers green access granted response.
   - `[Simulate Blacklist]` -> Triggers full-screen red security alert and audio alarm.
   - `[Simulate Fuzzy Match]` -> Triggers the OCR correction prompt.
   - `[Simulate Mismatch]` -> Triggers the stolen vehicle warning banner.
2. Complete State Persistence: Adding a vehicle on the Directory page instantly updates the database state so it can be scanned on the Live Monitor or searched in the Logs page.
3. FastAPI Backend Ready: All API calls should pass through `src/services/api.ts`. If the FastAPI backend is running, it fetches live data; if offline, it seamlessly falls back to the internal mock engine without breaking the UI.

---

# Execution Steps for Generation
1. Create the dark-mode layout with the Collapsible Sidebar, Header, and React Router navigation.
2. Build the `mockEngine` and `ALPRContext` containing pre-populated realistic Indian/International license plates, vehicles, and logs.
3. Build the Live Gate Monitor page with full bounding box canvas overlay, Edge-case alert cards, and simulation controls.
4. Build the Visitor Pre-Approval, Vehicle Directory, Access Logs (with working CSV exporter), Analytics, and Config pages.
5. Verify every button, tab, search filter, modal, and alert functions seamlessly in the browser.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://smartgate-guard.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/8006f368-93d9-484d-a229-c11fcc15be1f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
