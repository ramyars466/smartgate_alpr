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

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
