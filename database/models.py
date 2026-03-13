from datetime import datetime
from typing import Optional, Any
from sqlalchemy import BigInteger, String, Boolean, DateTime, JSON, ForeignKey, Float, Integer
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
    
    virtual_balance: Mapped[float] = mapped_column(Float, default=1000.0)

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

class GameSession(Base):
    __tablename__ = "game_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.telegram_id"))
    start_balance: Mapped[float] = mapped_column(Float)
    current_balance: Mapped[float] = mapped_column(Float)
    running_count: Mapped[int] = mapped_column(Integer, default=0)
    cards_dealt: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime)

class HandHistory(Base):
    __tablename__ = "hand_history"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    session_id: Mapped[int] = mapped_column(Integer, ForeignKey("game_sessions.id"))
    player_cards: Mapped[list[Any]] = mapped_column(JSON)
    dealer_upcard: Mapped[str] = mapped_column(String)
    true_count: Mapped[float] = mapped_column(Float)
    action_taken: Mapped[Optional[str]] = mapped_column(String)
    action_recommended: Mapped[str] = mapped_column(String)
    is_correct: Mapped[Optional[bool]] = mapped_column(Boolean)
    actual_bet: Mapped[float] = mapped_column(Float, default=0.0)
    recommended_bet: Mapped[float] = mapped_column(Float, default=0.0)
    profit: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)