import cv2
import easyocr
import numpy as np
import base64
import re
import time
from ultralytics import YOLO

try:
    model = YOLO("license_plate_yolov8n.pt")
except Exception as e:
    print(f"Warning: Custom YOLOv8 model not found, falling back to default: {e}")
    model = YOLO("yolov8n.pt") 

reader = easyocr.Reader(['en'], gpu=False)

def clean_text(text: str) -> str:
    text = text.upper()
    return re.sub(r'[^A-Z0-9]', '', text)

def process_image(image_bytes: bytes = None, img: np.ndarray = None):
    """
    Processes an image, returns extracted text, base64 cropped plate, 
    base64 original image with bounding box, inference time, and confidence.
    """
    start_time = time.time()
    
    if img is None:
        nparr = np.frombuffer(image_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    original_img_draw = img.copy()

    results = model(img)
    
    cropped_base64 = None
    extracted_text = ""
    confidence = 0.0
    
    # Try YOLOv8 First
    if len(results) > 0 and len(results[0].boxes) > 0:
        box = results[0].boxes[0].xyxy[0].cpu().numpy().astype(int)
        conf = float(results[0].boxes[0].conf[0].cpu().numpy())
        x1, y1, x2, y2 = box
        cropped_img = img[y1:y2, x1:x2]
        
        _, buffer = cv2.imencode('.jpg', cropped_img)
        cropped_base64 = base64.b64encode(buffer).decode('utf-8')
        
        ocr_results = reader.readtext(cropped_img)
        raw_text = " ".join([res[1] for res in ocr_results])
        extracted_text = clean_text(raw_text)
        
        if extracted_text:
            confidence = conf * 100
            # Draw bounding box
            cv2.rectangle(original_img_draw, (x1, y1), (x2, y2), (0, 255, 0), 3)
            cv2.putText(original_img_draw, extracted_text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)

    # FALLBACK: EasyOCR on full image
    if not extracted_text:
        ocr_results = reader.readtext(img)
        if ocr_results:
            raw_text = " ".join([res[1] for res in ocr_results])
            extracted_text = clean_text(raw_text)
            
            best_box = ocr_results[0][0] 
            conf = ocr_results[0][2]
            confidence = conf * 100
            
            x_coords = [int(p[0]) for p in best_box]
            y_coords = [int(p[1]) for p in best_box]
            
            x1, x2 = min(x_coords), max(x_coords)
            y1, y2 = min(y_coords), max(y_coords)
            
            h, w, _ = img.shape
            x1, y1 = max(0, x1-10), max(0, y1-10)
            x2, y2 = min(w, x2+10), min(h, y2+10)
            
            cropped_img = img[y1:y2, x1:x2]
            _, buffer = cv2.imencode('.jpg', cropped_img)
            cropped_base64 = base64.b64encode(buffer).decode('utf-8')
            
            # Draw bounding box
            cv2.rectangle(original_img_draw, (x1, y1), (x2, y2), (0, 255, 0), 3)
            cv2.putText(original_img_draw, extracted_text, (x1, y1 - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2)

    _, orig_buffer = cv2.imencode('.jpg', original_img_draw)
    annotated_img_base64 = base64.b64encode(orig_buffer).decode('utf-8')

    inference_time = int((time.time() - start_time) * 1000)

    return {
        "extracted_text": extracted_text,
        "cropped_image_base64": cropped_base64,
        "annotated_image_base64": annotated_img_base64,
        "inference_time_ms": inference_time,
        "confidence": round(confidence, 1)
    }
