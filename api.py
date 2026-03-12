import hmac
import hashlib
import json
import time
from datetime import datetime, timedelta
from urllib.parse import parse_qsl

from fastapi import FastAPI, Request, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from aiogram import Bot
from pydantic import BaseModel
from typing import List

from config import BOT_TOKEN, POSTBACK_SECRET, CRYPTO_PAY_TOKEN
from database.db import get_session
from database.models import User, PostbackLog, GameSession, HandHistory
from database.crud import check_vip_status
from engine.bj_types import GameState, Recommendation
from engine.analyzer import BlackjackAnalyzer

app = FastAPI()
bot = Bot(token=BOT_TOKEN)

class SessionStartRequest(BaseModel):
    total_decks: int
    deposit: float

class AnalyzeRequest(BaseModel):
    session_id: int
    player_cards: List[str]
    dealer_upcard: str

class ResultRequest(BaseModel):
    session_id: int
    player_cards: List[str]
    dealer_upcard: str
    action_taken: str
    action_recommended: str
    profit: float
    new_running_count: int
    new_cards_dealt: int

def verify_telegram_data(init_data: str) -> dict | bool:
    try:
        parsed_data = dict(parse_qsl(init_data))
        hash_value = parsed_data.pop('hash', None)
        
        auth_date = int(parsed_data.get('auth_date', 0))
        if time.time() - auth_date > 86400:
            return False

        data_check_string = "\n".join([f"{k}={v}" for k, v in sorted(parsed_data.items())])
        secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
        calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
        
        if calculated_hash == hash_value:
            return json.loads(parsed_data['user'])
        return False
    except Exception:
        return False

async def get_current_user(x_tg_init_data: str = Header(...), session: AsyncSession = Depends(get_session)) -> User:
    tg_data = verify_telegram_data(x_tg_init_data)
    if not tg_data:
        raise HTTPException(status_code=401, detail="Unauthorized or expired initData")
    
    result = await session.execute(select(User).where(User.telegram_id == tg_data['id']))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return user

@app.get("/api/bj/session/active")
async def get_active_session(
    user: User = Depends(get_current_user), 
    session: AsyncSession = Depends(get_session)
):
    result = await session.execute(
        select(GameSession)
        .where(GameSession.telegram_id == user.telegram_id)
        .where(GameSession.is_active == True)
    )
    game_session = result.scalar_one_or_none()
    
    if not game_session:
        return {"has_active": False}
        
    return {
        "has_active": True,
        "session_id": game_session.id,
        "balance": game_session.current_balance,
        "running_count": game_session.running_count,
        "cards_dealt": game_session.cards_dealt,
        "started_at": game_session.started_at.isoformat() + "Z" if game_session.started_at else None
    }

@app.post("/api/bj/session")
async def start_session(
    req: SessionStartRequest, 
    user: User = Depends(get_current_user), 
    session: AsyncSession = Depends(get_session)
):
    await session.execute(
        update(GameSession)
        .where(GameSession.telegram_id == user.telegram_id)
        .where(GameSession.is_active == True)
        .values(is_active=False, ended_at=datetime.utcnow())
    )
    
    if not user.is_vip:
        subquery = select(GameSession.id).where(GameSession.telegram_id == user.telegram_id)
        await session.execute(
            delete(HandHistory).where(HandHistory.session_id.in_(subquery))
        )
    
    new_session = GameSession(
        telegram_id=user.telegram_id,
        start_balance=req.deposit,
        current_balance=req.deposit,
        running_count=0,
        cards_dealt=0,
        is_active=True
    )
    session.add(new_session)
    await session.commit()
    await session.refresh(new_session)
    
    return {"session_id": new_session.id, "balance": new_session.current_balance}

@app.post("/api/bj/analyze")
async def analyze_hand(
    req: AnalyzeRequest, 
    user: User = Depends(get_current_user), 
    session: AsyncSession = Depends(get_session)
):
    result = await session.execute(select(GameSession).where(GameSession.id == req.session_id))
    game_session = result.scalar_one_or_none()
    
    if not game_session or game_session.telegram_id != user.telegram_id or not game_session.is_active:
        raise HTTPException(status_code=400, detail="Invalid or inactive session")

    analyzer = BlackjackAnalyzer(total_decks=6)
    
    decks_remaining = 6.0 - (game_session.cards_dealt / 52.0)
    
    state = GameState(
        player_cards=req.player_cards,
        dealer_upcard=req.dealer_upcard,
        running_count=game_session.running_count,
        decks_remaining=max(0.1, decks_remaining)
    )
    
    recommendation = analyzer.get_recommendation(state)
    
    return recommendation.model_dump()

@app.post("/api/bj/result")
async def record_result(
    req: ResultRequest, 
    user: User = Depends(get_current_user), 
    session: AsyncSession = Depends(get_session)
):
    result = await session.execute(select(GameSession).where(GameSession.id == req.session_id))
    game_session = result.scalar_one_or_none()
    
    if not game_session or game_session.telegram_id != user.telegram_id or not game_session.is_active:
        raise HTTPException(status_code=400, detail="Invalid session")

    # ЗАЩИТА ОТ МИНУСА
    user.virtual_balance = max(0.0, user.virtual_balance + req.profit)
    game_session.current_balance = max(0.0, game_session.current_balance + req.profit)
    
    game_session.running_count = req.new_running_count
    game_session.cards_dealt = req.new_cards_dealt
    
    analyzer = BlackjackAnalyzer()
    decks_remaining = 6.0 - (req.new_cards_dealt / 52.0)
    true_count = analyzer.get_true_count(req.new_running_count, req.new_cards_dealt)

    hand_history = HandHistory(
        session_id=game_session.id,
        player_cards=req.player_cards,
        dealer_upcard=req.dealer_upcard,
        true_count=true_count,
        action_taken=req.action_taken,
        action_recommended=req.action_recommended,
        is_correct=(req.action_taken == req.action_recommended),
        profit=req.profit
    )
    
    session.add(hand_history)
    await session.commit()
    
    return {"status": "recorded", "new_balance": game_session.current_balance}

@app.get("/api/postback")
async def handle_postback(
    request: Request,
    sub1: str,
    action: str = None,
    transaction_id: str = None, 
    secret: str = None,
    session: AsyncSession = Depends(get_session)
):
    if secret != POSTBACK_SECRET:
        raise HTTPException(status_code=403, detail="Forbidden")

    raw_data = dict(request.query_params)
    
    if transaction_id:
        existing_log = await session.execute(
            select(PostbackLog).where(PostbackLog.transaction_id == transaction_id)
        )
        if existing_log.scalar_one_or_none():
            return {"status": "success", "detail": "Already processed"}

    try:
        if action == "deposit":
            tg_id = int(sub1)
            result = await session.execute(select(User).where(User.telegram_id == tg_id))
            user = result.scalar_one_or_none()
            
            if user:
                if not user.has_used_trial:
                    user.trial_started_at = datetime.utcnow()
                    user.has_used_trial = True
                    text = "✅ Депозит подтвержден! Вам выдан тестовый VIP-доступ на 3 часа.\nОткройте Анализатор в главном меню!"
                    await bot.send_message(chat_id=tg_id, text=text)
        
        log_entry = PostbackLog(sub1=sub1, transaction_id=transaction_id, raw_data=raw_data, status="processed")
        session.add(log_entry)
        await session.commit()
        
    except ValueError:
        await session.rollback()
        raise HTTPException(status_code=400, detail="Invalid sub1 format")
    except Exception:
        await session.rollback()
        raise HTTPException(status_code=500, detail="Internal Server Error")

    return {"status": "success", "user_updated": True if action == "deposit" and user and not user.has_used_trial else False}

@app.post("/api/crypto-webhook")
async def crypto_webhook(
    request: Request, 
    crypto_pay_api_signature: str = Header(None), 
    session: AsyncSession = Depends(get_session)
):
    body = await request.body()
    secret = hashlib.sha256(CRYPTO_PAY_TOKEN.encode('utf-8')).digest()
    calc_signature = hmac.new(secret, body, hashlib.sha256).hexdigest()
    
    if calc_signature != crypto_pay_api_signature:
        raise HTTPException(status_code=403, detail="Invalid signature")
        
    data = await request.json()
    
    if data.get('update_type') == 'invoice_paid':
        invoice = data['payload']
        payload_data = invoice.get('payload', '')
        
        try:
            tg_id_str, duration = payload_data.split('_')
            tg_id = int(tg_id_str)
            days = 30 if duration == '1m' else 90
            
            result = await session.execute(select(User).where(User.telegram_id == tg_id))
            user = result.scalar_one_or_none()
            
            if user:
                if user.is_vip and user.vip_until and user.vip_until > datetime.utcnow():
                    user.vip_until = user.vip_until + timedelta(days=days)
                else:
                    user.is_vip = True
                    user.vip_until = datetime.utcnow() + timedelta(days=days)
                    
                await session.commit()
                
                await bot.send_message(
                    chat_id=tg_id, 
                    text=f"✅ **Оплата успешно получена!**\n\nТвой VIP-доступ активирован на {days} дней. Приятного использования Анализатора!",
                    parse_mode="Markdown"
                )
        except Exception:
            await session.rollback()
            
    return {"ok": True}

@app.post("/api/validate")
async def validate_user(request: Request, session: AsyncSession = Depends(get_session)):
    body = await request.json()
    init_data = body.get("initData")
    
    tg_user = verify_telegram_data(init_data)
    if not tg_user:
        raise HTTPException(status_code=403, detail="Invalid or expired data")
    
    result = await session.execute(select(User).where(User.telegram_id == tg_user['id']))
    user = result.scalar_one_or_none()
    
    if user and await check_vip_status(user):
        return {"is_vip": True, "user": tg_user}
    
    return {"is_vip": False}