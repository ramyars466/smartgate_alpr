from fastapi import FastAPI, UploadFile, File, Depends, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import datetime
import asyncio
import cv2
import io
import csv
import time
from thefuzz import process

from database import get_db, init_db, Vehicle, VisitorPass, AccessLog
from ml_pipeline import process_image

app = FastAPI(title="smart gate ai API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/api/v1/health")
def health_check():
    return {"status": "ok"}

# --- Schemas ---

class VehicleModel(BaseModel):
    id: str
    plate: str
    owner: str
    flat: str
    make: str
    color: str
    type: str
    category: str
    registeredAt: int

class VisitorPassModel(BaseModel):
    id: str
    guest: str
    phone: str
    plate: str
    flat: str
    entryAt: int
    expiresAt: int
    status: str
    enteredAt: Optional[int] = None

class AccessLogModel(BaseModel):
    id: str
    ts: int
    gate: str
    plate: str
    ocr: str
    status: str
    note: str
    make: str
    color: str
    type: str
    yolo: float
    ocrConf: float
    speed: int
    durationMin: Optional[int] = None
    imageUrl: Optional[str] = None

class LogNoteUpdate(BaseModel):
    note: str

# --- DB Helper functions ---
def add_db_log(db: Session, r: dict, status: str, note: str, gate: str):
    import time
    plate = r.get("plate", r.get("ocr", "UNKNOWN"))
    
    # Check for overstay (simplified for this demo logic)
    
    log = AccessLog(
        id=f"log_{int(time.time()*1000)}_{plate}",
        ts=int(time.time()*1000),
        gate=gate,
        plate=plate,
        ocr=r.get("ocr", ""),
        status=status,
        note=note,
        make=r.get("detected", {}).get("make", ""),
        color=r.get("detected", {}).get("color", ""),
        type=r.get("detected", {}).get("type", ""),
        yolo=r.get("yolo", 0.0),
        ocrConf=r.get("ocrConf", 0.0),
        speed=r.get("speed", 0),
        imageUrl=r.get("imageUrl")
    )
    db.add(log)
    db.commit()
    return log

# --- Endpoints for Vehicles ---
@app.get("/api/v1/vehicles", response_model=List[VehicleModel])
def get_vehicles(db: Session = Depends(get_db)):
    return db.query(Vehicle).order_by(Vehicle.registeredAt.desc()).all()

@app.post("/api/v1/vehicles", response_model=VehicleModel)
def create_vehicle(v: VehicleModel, db: Session = Depends(get_db)):
    db_veh = Vehicle(**v.dict())
    db.add(db_veh)
    db.commit()
    return db_veh

@app.put("/api/v1/vehicles/{id}", response_model=VehicleModel)
def update_vehicle(id: str, v: VehicleModel, db: Session = Depends(get_db)):
    db_veh = db.query(Vehicle).filter(Vehicle.id == id).first()
    if db_veh:
        for k, val in v.dict().items():
            setattr(db_veh, k, val)
        db.commit()
    return v

@app.delete("/api/v1/vehicles/{id}")
def delete_vehicle(id: str, db: Session = Depends(get_db)):
    db_veh = db.query(Vehicle).filter(Vehicle.id == id).first()
    if db_veh:
        db.delete(db_veh)
        db.commit()
    return {"ok": True}

# --- Endpoints for Passes ---
@app.get("/api/v1/passes", response_model=List[VisitorPassModel])
def get_passes(db: Session = Depends(get_db)):
    return db.query(VisitorPass).order_by(VisitorPass.entryAt.desc()).all()

@app.post("/api/v1/passes", response_model=VisitorPassModel)
def create_pass(p: VisitorPassModel, db: Session = Depends(get_db)):
    db_pass = VisitorPass(**p.dict())
    db.add(db_pass)
    db.commit()
    return db_pass

@app.put("/api/v1/passes/{id}", response_model=VisitorPassModel)
def update_pass(id: str, p: VisitorPassModel, db: Session = Depends(get_db)):
    db_pass = db.query(VisitorPass).filter(VisitorPass.id == id).first()
    if db_pass:
        for k, val in p.dict().items():
            setattr(db_pass, k, val)
        db.commit()
    return p

# --- Endpoints for Logs ---
@app.get("/api/v1/logs", response_model=List[AccessLogModel])
def get_logs(db: Session = Depends(get_db)):
    return db.query(AccessLog).order_by(AccessLog.ts.desc()).limit(500).all()

@app.put("/api/v1/logs/{id}")
def update_log_note(id: str, payload: LogNoteUpdate, db: Session = Depends(get_db)):
    log = db.query(AccessLog).filter(AccessLog.id == id).first()
    if log:
        log.note = payload.note
        db.commit()
    return {"ok": True}

# --- Core Scan Logic ---
@app.post("/api/v1/scan")
async def lovable_scan(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    ocr = data.get("ocr", "").upper().replace(" ", "")
    detected = data.get("detected", {"make": "Unknown", "color": "Unknown", "type": "sedan"})
    gate = data.get("gate", "Main Gate - Entry")
    image_url = data.get("imageUrl")
    
    # 1. Check blacklist & vehicles
    vehicles = db.query(Vehicle).all()
    passes = db.query(VisitorPass).filter(VisitorPass.status == "active").all()
    
    vehicle_match = next((v for v in vehicles if v.plate == ocr), None)
    
    base_res = {
        "id": f"scan_{int(time.time()*1000)}",
        "ocr": ocr,
        "plate": ocr,
        "detected": detected,
        "ts": int(time.time() * 1000),
        "yolo": 98.4,
        "ocrConf": 89.5,
        "speed": 12,
        "imageUrl": image_url
    }
    
    if vehicle_match:
        if vehicle_match.category == "blacklisted":
            base_res["kind"] = "blacklisted"
            base_res["vehicle"] = vehicle_match.__dict__
            add_db_log(db, base_res, "blacklisted", "BLACKLIST HIT - Security dispatched", gate)
            return base_res
            
        if vehicle_match.category == "resident":
            if vehicle_match.type != detected.get("type") or vehicle_match.color != detected.get("color"):
                base_res["kind"] = "mismatch"
                base_res["vehicle"] = vehicle_match.__dict__
                add_db_log(db, base_res, "denied", "Plate / vehicle type mismatch - possible cloned plate", gate)
                return base_res
                
            base_res["kind"] = "resident"
            base_res["vehicle"] = vehicle_match.__dict__
            add_db_log(db, base_res, "granted", "Resident auto-access", gate)
            return base_res
            
    # Check passes
    now = int(time.time() * 1000)
    pass_match = next((p for p in passes if p.plate == ocr and p.expiresAt > now), None)
    
    if pass_match or (vehicle_match and vehicle_match.category == "visitor"):
        base_res["kind"] = "visitor"
        if vehicle_match: base_res["vehicle"] = vehicle_match.__dict__
        if pass_match: 
            base_res["pass"] = pass_match.__dict__
            # mark entered
            if pass_match.enteredAt is None:
                pass_match.enteredAt = now
                db.commit()
                
        flat_dest = pass_match.flat if pass_match else (vehicle_match.flat if vehicle_match else "Unknown")
        add_db_log(db, base_res, "visitor", f"Visitor for {flat_dest}", gate)
        return base_res
        
    # Fuzzy match
    plates = [v.plate for v in vehicles if v.category != "blacklisted"]
    if plates:
        best_match, score = process.extractOne(ocr, plates)
        if score >= 80:
            best_veh = next((v for v in vehicles if v.plate == best_match), None)
            base_res["kind"] = "fuzzy"
            base_res["vehicle"] = best_veh.__dict__ if best_veh else None
            base_res["matchPct"] = score
            base_res["ocrConf"] = 71.3
            return base_res
            
    # Denied
    base_res["kind"] = "denied"
    add_db_log(db, base_res, "denied", "Unregistered vehicle", gate)
    return base_res

@app.post("/api/v1/scan-plate")
async def scan_plate(file: UploadFile = File(...), db: Session = Depends(get_db)):
    image_bytes = await file.read()
    results = process_image(image_bytes=image_bytes)
    extracted_text = results.get("extracted_text", "UNKNOWN")
    if extracted_text:
        extracted_text = "".join(c for c in extracted_text if c.isalnum()).upper()
    if not extracted_text:
        extracted_text = "UNKNOWN"
        
    detected = {"make": "Unknown", "color": "Unknown", "type": "sedan"}
    
    # Check blacklist & vehicles
    vehicles = db.query(Vehicle).all()
    passes = db.query(VisitorPass).filter(VisitorPass.status == "active").all()
    
    def norm(p):
        return "".join(c for c in (p or "") if c.isalnum()).upper()

    print(f"DEBUG - extracted_text: '{extracted_text}'")
    for v in vehicles:
        print(f"DEBUG - checking plate: '{v.plate}' -> norm: '{norm(v.plate)}' == '{extracted_text}' ? {norm(v.plate) == extracted_text}")

    vehicle_match = next((v for v in vehicles if norm(v.plate) == extracted_text), None)
    print(f"DEBUG - vehicle_match found: {vehicle_match is not None}")
    
    base_res = {
        "id": f"scan_{int(time.time()*1000)}",
        "ocr": extracted_text,
        "plate": extracted_text,
        "detected": detected,
        "ts": int(time.time() * 1000),
        "yolo": results.get("confidence", 98.4),
        "ocrConf": results.get("confidence", 89.5),
        "speed": 0,
        "imageUrl": "data:image/jpeg;base64," + results.get("annotated_image_base64", "")
    }
    
    if vehicle_match:
        if vehicle_match.category == "blacklisted":
            base_res["kind"] = "blacklisted"
            base_res["vehicle"] = vehicle_match.__dict__
            add_db_log(db, base_res, "blacklisted", "BLACKLIST HIT - Security dispatched", "Main Gate")
            return base_res
            
        if vehicle_match.category == "resident":
            base_res["kind"] = "resident"
            base_res["vehicle"] = vehicle_match.__dict__
            add_db_log(db, base_res, "granted", "Resident auto-access", "Main Gate")
            asyncio.create_task(trigger_relay(None))
            return base_res
            
    # Check passes
    now = int(time.time() * 1000)
    pass_match = next((p for p in passes if norm(p.plate) == extracted_text and p.expiresAt > now), None)
    
    if pass_match or (vehicle_match and vehicle_match.category == "visitor"):
        base_res["kind"] = "visitor"
        if vehicle_match: base_res["vehicle"] = vehicle_match.__dict__
        if pass_match: 
            base_res["pass"] = pass_match.__dict__
            if pass_match.enteredAt is None:
                pass_match.enteredAt = now
                db.commit()
                
        add_db_log(db, base_res, "visitor", "Visitor Access", "Main Gate")
        asyncio.create_task(trigger_relay(None))
        return base_res

    # Fuzzy match
    plates = [v.plate for v in vehicles if v.category != "blacklisted"]
    if plates:
        best_match, score = process.extractOne(extracted_text, plates)
        if score >= 80:
            best_veh = next((v for v in vehicles if v.plate == best_match), None)
            base_res["kind"] = "fuzzy"
            base_res["vehicle"] = best_veh.__dict__ if best_veh else None
            base_res["matchPct"] = score
            base_res["ocrConf"] = results.get("confidence", 89.5)
            # Log as denied because it needs guard approval
            add_db_log(db, base_res, "denied", "Fuzzy match - Guard approval needed", "Main Gate")
            return base_res
        
    # Denied
    base_res["kind"] = "denied"
    add_db_log(db, base_res, "denied", "Unregistered vehicle", "Main Gate")
    return base_res

@app.post("/api/v1/relay/trigger")
async def trigger_relay(request: Request = None):
    return {"ok": True, "mode": "live"}

@app.post("/api/v1/approve-partial")
async def approve_partial(request: Request, db: Session = Depends(get_db)):
    data = await request.json()
    scan_res = data.get("scanResult", {})
    add_db_log(db, scan_res, "granted", f"Guard confirmed OCR correction", scan_res.get("gate", "Gate"))
    return {"ok": True}

# Analytics
@app.get("/api/v1/analytics/counts")
def get_analytics(db: Session = Depends(get_db)):
    total = 45 # Mock for now
    return {
        "total_inside": total,
        "residents_inside": 30,
        "visitors_inside": 15,
        "traffic_history": [{"time": "10:00", "vehicles": 20}]
    }

# Live Feed Mock for WebSocket
@app.websocket("/api/v1/ws/live-feed")
async def ws_live_feed(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            await asyncio.sleep(1)
    except WebSocketDisconnect:
        pass
