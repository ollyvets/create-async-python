from datetime import datetime
from typing import Optional, Any
from sqlalchemy import BigInteger, String, Boolean, DateTime, JSON, ForeignKey
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    username: Mapped[Optional[str]] = mapped_column(String)
    
   
    trial_started_at: Mapped[Optional[datetime]] = mapped_column(DateTime)
    has_used_trial: Mapped[bool] = mapped_column(Boolean, default=False) 
    
   
    is_vip: Mapped[bool] = mapped_column(Boolean, default=False)
    vip_until: Mapped[Optional[datetime]] = mapped_column(DateTime)
    
    registered_casino: Mapped[Optional[str]] = mapped_column(String)
    sub1_click_id: Mapped[Optional[str]] = mapped_column(String, unique=True, index=True)

class Transaction(Base):
    __tablename__ = "transactions"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.telegram_id"))
    amount: Mapped[int] = mapped_column()
    currency: Mapped[str] = mapped_column(String)
    status: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class PostbackLog(Base):
    __tablename__ = "postbacks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    sub1: Mapped[Optional[str]] = mapped_column(String, index=True)
    
    
    transaction_id: Mapped[Optional[str]] = mapped_column(String, unique=True, index=True) 
    
    raw_data: Mapped[dict[str, Any]] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String, default="processed") 
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)