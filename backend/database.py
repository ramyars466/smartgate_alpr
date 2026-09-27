from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, Enum
from sqlalchemy.orm import declarative_base, sessionmaker
from datetime import datetime, timedelta
import enum

DATABASE_URL = "sqlite:///./smartgate.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class VehicleCategory(str, enum.Enum):
    RESIDENT = "Resident"
    VISITOR = "Pre-Approved Visitor"
    BLACKLISTED = "Blacklisted"

class Direction(str, enum.Enum):
    ENTRY = "ENTRY"
    EXIT = "EXIT"

class RegisteredVehicle(Base):
    __tablename__ = "registered_vehicles"
    plate_number = Column(String, primary_key=True, index=True)
    owner_name = Column(String)
    category = Column(String, default=VehicleCategory.RESIDENT.value)
    is_inside = Column(Boolean, default=False)
    last_entry_time = Column(DateTime, nullable=True)

class AccessLog(Base):
    __tablename__ = "access_logs"
    id = Column(Integer, primary_key=True, index=True)
    plate_number = Column(String, index=True)
    status = Column(String) # "Access Granted" or "Access Denied" or "Blacklist Alert"
    direction = Column(String) # ENTRY or EXIT
    timestamp = Column(DateTime, default=datetime.utcnow)

def init_db():
    # We will drop and recreate for this prototype to ensure schema changes apply cleanly
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    
    if db.query(RegisteredVehicle).count() == 0:
        db.add_all([
            RegisteredVehicle(plate_number="KA01MG5678", owner_name="John Doe", category=VehicleCategory.RESIDENT.value),
            RegisteredVehicle(plate_number="KL65H4383", owner_name="Alice Smith", category=VehicleCategory.RESIDENT.value),
            RegisteredVehicle(plate_number="MH12AB1234", owner_name="Delivery Man", category=VehicleCategory.VISITOR.value),
            RegisteredVehicle(plate_number="DL8CX9876", owner_name="Unknown Suspect", category=VehicleCategory.BLACKLISTED.value)
        ])
        db.commit()
    db.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

if __name__ == "__main__":
    init_db()
    print("Database models updated and re-initialized.")
