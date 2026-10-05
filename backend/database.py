import time
from sqlalchemy import create_engine, Column, String, Integer, Float, Boolean
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = "sqlite:///./smartgate.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Vehicle(Base):
    __tablename__ = "vehicles"
    id = Column(String, primary_key=True, index=True)
    plate = Column(String, index=True, unique=True)
    owner = Column(String)
    flat = Column(String)
    make = Column(String)
    color = Column(String)
    type = Column(String) # hatchback, sedan, suv, van
    category = Column(String) # resident, visitor, blacklisted
    registeredAt = Column(Integer)

class VisitorPass(Base):
    __tablename__ = "visitor_passes"
    id = Column(String, primary_key=True, index=True)
    guest = Column(String)
    phone = Column(String)
    plate = Column(String, index=True)
    flat = Column(String)
    entryAt = Column(Integer)
    expiresAt = Column(Integer)
    status = Column(String) # active, revoked
    enteredAt = Column(Integer, nullable=True)
    exitedAt = Column(Integer, nullable=True)

class AccessLog(Base):
    __tablename__ = "access_logs"
    id = Column(String, primary_key=True, index=True)
    ts = Column(Integer)
    gate = Column(String)
    plate = Column(String, index=True)
    ocr = Column(String)
    status = Column(String) # granted, visitor, denied, blacklisted, overstay
    note = Column(String)
    make = Column(String)
    color = Column(String)
    type = Column(String)
    yolo = Column(Float)
    ocrConf = Column(Float)
    speed = Column(Integer)
    durationMin = Column(Integer, nullable=True)
    imageUrl = Column(String, nullable=True)

def init_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Seed test vehicles for realistic simulation buttons
        if db.query(Vehicle).count() == 0:
            import uuid
            now = int(time.time() * 1000)
            
            # Resident: KL65H4383
            db.add(Vehicle(id=str(uuid.uuid4()), plate="KL65H4383", owner="John Doe", flat="A-101", make="Tata Altroz", color="White", type="hatchback", category="resident", registeredAt=now))
            # Blacklisted: UP16DX0666
            db.add(Vehicle(id=str(uuid.uuid4()), plate="UP16DX0666", owner="Unknown", flat="", make="Toyota Fortuner", color="Black", type="suv", category="blacklisted", registeredAt=now))
            # Visitor pass for KL11BB2020
            db.add(VisitorPass(id=str(uuid.uuid4()), guest="Alice", phone="555-0101", plate="KL11BB2020", flat="B-202", entryAt=now, expiresAt=now + 86400000, status="active"))
            db.commit()
    except Exception as e:
        print(f"Error seeding DB: {e}")
    finally:
        db.close()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
