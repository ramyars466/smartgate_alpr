from fastapi import FastAPI, UploadFile, File, Depends, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import datetime
import asyncio
import cv2
import io
import csv
from thefuzz import process

from database import get_db, init_db, RegisteredVehicle, AccessLog, VehicleCategory, Direction
from ml_pipeline import process_image

app = FastAPI(title="SmartGate ALPR API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"], 
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
class ScanResponse(BaseModel):
    extracted_text: str
    access_status: str
    cropped_image_base64: Optional[str] = None
    annotated_image_base64: Optional[str] = None
    inference_time_ms: int
    confidence: float
    suggested_plate: Optional[str] = None
    similarity_score: Optional[int] = None

class VehicleCreate(BaseModel):
    plate_number: str
    owner_name: str
    category: str = VehicleCategory.RESIDENT.value

class LogResponse(BaseModel):
    id: int
    plate_number: str
    status: str
    direction: Optional[str] = None
    timestamp: datetime.datetime
    class Config:
        from_attributes = True

class AnalyticsResponse(BaseModel):
    total_inside: int
    residents_inside: int
    visitors_inside: int

# --- Hardware Trigger Mock ---
async def trigger_boom_barrier():
    print("HARDWARE TRIGGER: Sending GPIO HIGH to open boom barrier...")
    await asyncio.sleep(5)
    print("HARDWARE TRIGGER: Sending GPIO LOW to close boom barrier...")

# --- Debounce State for Video ---
last_scanned_plates = {}

# --- Helper Logic ---
def handle_plate_logic(db: Session, plate_text: str):
    vehicle = db.query(RegisteredVehicle).filter(RegisteredVehicle.plate_number == plate_text).first()
    suggested_plate = None
    similarity = None
    
    if vehicle:
        if vehicle.category == VehicleCategory.BLACKLISTED.value:
            status = "Blacklist Alert"
            direction = None
        else:
            status = "Access Granted"
            if vehicle.is_inside:
                direction = Direction.EXIT.value
                vehicle.is_inside = False
            else:
                direction = Direction.ENTRY.value
                vehicle.is_inside = True
                vehicle.last_entry_time = datetime.datetime.utcnow()
            db.commit()
    else:
        # Fuzzy Matching Logic
        all_vehicles = db.query(RegisteredVehicle).all()
        plate_list = [v.plate_number for v in all_vehicles]
        
        if plate_list:
            best_match, score = process.extractOne(plate_text, plate_list)
            if score >= 85:
                status = "Partial Match"
                direction = None
                suggested_plate = best_match
                similarity = score
            else:
                status = "Access Denied"
                direction = None
        else:
            status = "Access Denied"
            direction = None
            
    log_entry = AccessLog(plate_number=plate_text, status=status, direction=direction)
    db.add(log_entry)
    db.commit()
    db.refresh(log_entry)
    
    return status, log_entry, suggested_plate, similarity

# --- API Endpoints ---

from fastapi import Request

@app.post("/api/v1/scan")
async def lovable_scan(request: Request, db: Session = Depends(get_db)):
    import time
    data = await request.json()
    ocr = data.get("ocr", "UNKNOWN")
    detected = data.get("detected", {"make": "Unknown", "color": "Unknown", "type": "sedan"})
    
    # Process logic
    status, _, suggested, _ = handle_plate_logic(db, ocr)
    
    kind = "denied"
    if status == "Access Granted":
        kind = "resident"
    elif status == "Blacklist Alert":
        kind = "blacklisted"
    elif status == "Partial Match":
        kind = "fuzzy"
        
    return {
        "id": "scan_" + str(int(time.time())),
        "kind": kind,
        "ocr": ocr,
        "plate": ocr,
        "detected": detected,
        "yolo": 98.2,
        "ocrConf": 91.5,
        "speed": 12,
        "ts": int(time.time() * 1000)
    }

@app.post("/api/v1/relay/trigger")
async def lovable_relay_trigger():
    await trigger_boom_barrier()
    return {"ok": True, "mode": "live"}

@app.post("/api/v1/scan-plate", response_model=ScanResponse)
async def scan_plate(file: UploadFile = File(...), db: Session = Depends(get_db)):
    image_bytes = await file.read()
    results = process_image(image_bytes=image_bytes)
    extracted_text = results["extracted_text"]
    
    suggested_plate = None
    similarity_score = None

    if extracted_text:
        status, _, suggested_plate, similarity_score = handle_plate_logic(db, extracted_text)
        if status == "Access Granted":
            asyncio.create_task(trigger_boom_barrier())
    else:
        extracted_text = "UNKNOWN"
        status = "Access Denied"
        log_entry = AccessLog(plate_number=extracted_text, status=status)
        db.add(log_entry)
        db.commit()
    
    return ScanResponse(
        extracted_text=extracted_text,
        access_status=status,
        cropped_image_base64=results["cropped_image_base64"],
        annotated_image_base64=results["annotated_image_base64"],
        inference_time_ms=results["inference_time_ms"],
        confidence=results["confidence"],
        suggested_plate=suggested_plate,
        similarity_score=similarity_score
    )

@app.post("/api/v1/approve-partial")
async def approve_partial(data: dict, db: Session = Depends(get_db)):
    plate_number = data.get("plate_number")
    # Log it properly as if it was scanned perfectly
    status, _, _, _ = handle_plate_logic(db, plate_number)
    if status == "Access Granted":
        asyncio.create_task(trigger_boom_barrier())
    return {"message": "Partial match approved and gate opened", "status": status}

@app.websocket("/api/v1/ws/live-feed")
async def video_endpoint(websocket: WebSocket, db: Session = Depends(get_db)):
    await websocket.accept()
    cap = cv2.VideoCapture(0)
    
    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                await asyncio.sleep(0.1)
                continue
                
            results = process_image(img=frame)
            plate_text = results["extracted_text"]
            status = "Scanning..."
            suggested = None
            sim_score = None
            
            if plate_text:
                now = datetime.datetime.now()
                if plate_text not in last_scanned_plates or (now - last_scanned_plates[plate_text]).total_seconds() > 10:
                    status, _, suggested, sim_score = handle_plate_logic(db, plate_text)
                    last_scanned_plates[plate_text] = now
                    
                    if status == "Access Granted":
                        asyncio.create_task(trigger_boom_barrier())
                else:
                    status = "Already Scanned (Debounced)"
            
            await websocket.send_json({
                "frame": results["annotated_image_base64"],
                "plate_text": plate_text,
                "status": status,
                "confidence": results["confidence"],
                "inference_time_ms": results["inference_time_ms"],
                "suggested_plate": suggested,
                "similarity_score": sim_score
            })
            await asyncio.sleep(0.1)
    except WebSocketDisconnect:
        print("WebSocket disconnected")
    finally:
        cap.release()

@app.post("/api/v1/override")
async def force_open_gate():
    asyncio.create_task(trigger_boom_barrier())
    db = next(get_db())
    log_entry = AccessLog(plate_number="MANUAL_OVERRIDE", status="Access Granted", direction="ENTRY")
    db.add(log_entry)
    db.commit()
    return {"message": "Gate forced open."}

@app.post("/api/v1/vehicles")
def add_vehicle(vehicle: VehicleCreate, db: Session = Depends(get_db)):
    db_vehicle = db.query(RegisteredVehicle).filter(RegisteredVehicle.plate_number == vehicle.plate_number).first()
    if db_vehicle:
        return {"message": "Vehicle already registered"}
    
    new_vehicle = RegisteredVehicle(
        plate_number=vehicle.plate_number, 
        owner_name=vehicle.owner_name,
        category=vehicle.category
    )
    db.add(new_vehicle)
    db.commit()
    return {"message": "Vehicle added successfully"}

@app.get("/api/v1/vehicles")
def get_vehicles(db: Session = Depends(get_db)):
    return db.query(RegisteredVehicle).all()

@app.get("/api/v1/logs", response_model=List[LogResponse])
def get_logs(db: Session = Depends(get_db)):
    return db.query(AccessLog).order_by(AccessLog.timestamp.desc()).limit(50).all()

class AnalyticsResponseV2(BaseModel):
    total_inside: int
    residents_inside: int
    visitors_inside: int
    traffic_history: List[dict]

@app.get("/api/v1/analytics/counts", response_model=AnalyticsResponseV2)
def get_analytics(db: Session = Depends(get_db)):
    vehicles_inside = db.query(RegisteredVehicle).filter(RegisteredVehicle.is_inside == True).all()
    total = len(vehicles_inside)
    residents = sum(1 for v in vehicles_inside if v.category == VehicleCategory.RESIDENT.value)
    visitors = total - residents
    
    # Calculate real 24h traffic from logs
    traffic_data = []
    now = datetime.datetime.utcnow()
    # Let's generate 6 buckets for the last 24 hours
    for i in range(6):
        start_time = now - datetime.timedelta(hours=24 - (i * 4))
        end_time = now - datetime.timedelta(hours=24 - ((i + 1) * 4))
        count = db.query(AccessLog).filter(AccessLog.timestamp >= start_time, AccessLog.timestamp < end_time).count()
        # Format time label
        time_label = end_time.strftime("%H:00")
        traffic_data.append({"time": time_label, "vehicles": count})
    
    return AnalyticsResponseV2(
        total_inside=total,
        residents_inside=residents,
        visitors_inside=visitors,
        traffic_history=traffic_data
    )

@app.get("/api/v1/logs/export")
def export_logs(db: Session = Depends(get_db)):
    logs = db.query(AccessLog).order_by(AccessLog.timestamp.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Timestamp", "Plate Number", "Status", "Direction"])
    
    for log in logs:
        writer.writerow([log.id, log.timestamp.isoformat(), log.plate_number, log.status, log.direction or "N/A"])
        
    output.seek(0)
    
    headers = {
        'Content-Disposition': 'attachment; filename="smartgate_audit_logs.csv"'
    }
    
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers=headers)
