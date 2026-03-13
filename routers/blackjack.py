import json
from datetime import datetime
from typing import List, Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from pydantic import BaseModel

from database.db import get_session
from database.models import User, GameSession, HandHistory
from database.crud import check_vip_status, flush_bj_session_to_db
from database.redis import redis_client, get_bj_state_key, get_bj_hands_key
from engine.bj_types import GameState
from engine.analyzer import BlackjackAnalyzer
from security import get_current_user

blackjack_router = APIRouter(prefix="/api/bj", tags=["Blackjack"])

class SessionStartRequest(BaseModel):
    total_decks: int
    deposit: float
    currency: str = "USD"

class AnalyzeRequest(BaseModel):
    session_id: int
    player_cards: List[str]
    dealer_upcard: str
    running_count: float 
    cards_dealt: int

class ResultRequest(BaseModel):
    session_id: int
    player_cards: List[str]
    dealer_upcard: str
    action_taken: str
    action_recommended: str
    actual_bet: float
    recommended_bet: float
    outcome: Literal['WIN', 'LOSS', 'PUSH']
    running_count: float  
    cards_dealt: int

class CloseSessionRequest(BaseModel):
    session_id: int

@blackjack_router.get("/session/active")
async def get_active_session(
    user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_session)
):
    result = await db.execute(
        select(GameSession)
        .where(GameSession.telegram_id == user.telegram_id, GameSession.is_active == True)
    )
    game_session = result.scalar_one_or_none()
    
    if not game_session:
        return {"has_active": False}
        
    # Данные берем из Redis, так как они самые свежие
    state_key = get_bj_state_key(game_session.id)
    state = await redis_client.hgetall(state_key)
    
    balance = float(state.get("balance", game_session.current_balance)) if state else game_session.current_balance
    running_count = float(state.get("running_count", game_session.running_count)) if state else game_session.running_count
    cards_dealt = int(state.get("cards_dealt", game_session.cards_dealt)) if state else game_session.cards_dealt

    return {
        "has_active": True,
        "session_id": game_session.id,
        "balance": balance,
        "running_count": running_count,
        "cards_dealt": cards_dealt,
        "started_at": game_session.started_at.isoformat() + "Z" if game_session.started_at else None
    }

@blackjack_router.post("/session")
async def start_session(
    req: SessionStartRequest, 
    user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_session)
):
    # Ищем зависшую сессию и сбрасываем ее в БД
    result = await db.execute(
        select(GameSession)
        .where(GameSession.telegram_id == user.telegram_id, GameSession.is_active == True)
    )
    active_session = result.scalar_one_or_none()
    if active_session:
        await flush_bj_session_to_db(db, active_session.id)
    
    # Очистка старых сессий (оставляем логику как было)
    is_active_vip = await check_vip_status(user)
    keep_limit = 10 if is_active_vip else 1
    
    keep_sessions_query = select(GameSession.id).where(
        GameSession.telegram_id == user.telegram_id
    ).order_by(GameSession.id.desc()).limit(keep_limit)
    
    keep_session_ids = (await db.execute(keep_sessions_query)).scalars().all()
    
    if keep_session_ids:
        await db.execute(
            delete(HandHistory)
            .where(HandHistory.session_id.in_(
                select(GameSession.id).where(GameSession.telegram_id == user.telegram_id)
            ))
            .where(HandHistory.session_id.not_in(keep_session_ids))
        )
        await db.execute(
            delete(GameSession)
            .where(GameSession.telegram_id == user.telegram_id)
            .where(GameSession.id.not_in(keep_session_ids))
        )
    
    new_session = GameSession(
        telegram_id=user.telegram_id,
        start_balance=req.deposit,
        current_balance=req.deposit,
        running_count=0,
        cards_dealt=0,
        is_active=True,
        currency=req.currency
    )
    db.add(new_session)
    await db.commit()
    await db.refresh(new_session)
    
    # Инициализируем Redis state
    state_key = get_bj_state_key(new_session.id)
    await redis_client.hset(state_key, mapping={
        "balance": float(req.deposit),
        "running_count": 0.0,
        "cards_dealt": 0
    })
    await redis_client.delete(get_bj_hands_key(new_session.id))
    
    return {"session_id": new_session.id, "balance": req.deposit}

@blackjack_router.post("/analyze")
async def analyze_hand(req: AnalyzeRequest):
    # Теперь анализатор не дергает базу данных вообще
    analyzer = BlackjackAnalyzer(total_decks=6) 
    decks_remaining = 6.0 - (req.cards_dealt / 52.0)
    
    state = GameState(
        player_cards=req.player_cards,
        dealer_upcard=req.dealer_upcard,
        running_count=req.running_count,
        decks_remaining=max(0.1, decks_remaining)
    )
    
    recommendation = analyzer.get_recommendation(state)
    return recommendation.model_dump()

@blackjack_router.post("/result")
async def record_result(req: ResultRequest):
    state_key = get_bj_state_key(req.session_id)
    state = await redis_client.hgetall(state_key)
    
    if not state:
        raise HTTPException(status_code=400, detail="Session expired or invalid")

    # Жесткий расчет профита сервером, а не доверие фронту
    profit = 0.0
    actual_bet = abs(float(req.actual_bet)) # Защита от отрицательных ставок
    
    if req.outcome == 'WIN':
        profit = actual_bet
    elif req.outcome == 'LOSS':
        profit = -actual_bet

    current_balance = float(state.get("balance", 0))
    new_balance = max(0.0, current_balance + profit)
    
    # Сохраняем новое состояние
    await redis_client.hset(state_key, mapping={
        "balance": new_balance,
        "running_count": float(req.running_count),
        "cards_dealt": int(req.cards_dealt)
    })
    
    analyzer = BlackjackAnalyzer()
    true_count = analyzer.get_true_count(req.running_count, req.cards_dealt)

    # Формируем запись раздачи и пушим в Redis List
    hand_record = {
        "player_cards": req.player_cards,
        "dealer_upcard": req.dealer_upcard,
        "true_count": true_count,
        "action_taken": req.action_taken,
        "action_recommended": req.action_recommended,
        "is_correct": (req.action_taken == req.action_recommended),
        "actual_bet": actual_bet,
        "recommended_bet": req.recommended_bet,
        "profit": profit
    }
    
    await redis_client.rpush(get_bj_hands_key(req.session_id), json.dumps(hand_record))
    
    return {
        "status": "recorded", 
        "new_balance": new_balance,
        "new_running_count": req.running_count
    }

@blackjack_router.post("/close")
async def close_session(
    req: CloseSessionRequest,
    db: AsyncSession = Depends(get_session)
    ):
    await flush_bj_session_to_db(db, req.session_id)
    return {"status": "ok"}

@blackjack_router.get("/analytics")
async def get_analytics(
    user: User = Depends(get_current_user), 
    session: AsyncSession = Depends(get_session)
):
    is_active_vip = await check_vip_status(user)
    limit = 10 if is_active_vip else 1
    
    result = await session.execute(
        select(GameSession)
        .where(GameSession.telegram_id == user.telegram_id)
        .order_by(GameSession.started_at.desc())
        .limit(limit)
    )
    sessions = result.scalars().all()
    
    analytics_data = []
    for s in sessions:
        hands_result = await session.execute(
            select(HandHistory)
            .where(HandHistory.session_id == s.id)
            .order_by(HandHistory.created_at.asc())
        )
        hands = hands_result.scalars().all()
        
        chart_data = [{
            "hand_num": 0, 
            "balance": s.start_balance, 
            "theo_balance": s.start_balance,
            "profit": 0,
            "theo_profit": 0
        }]
        
        curr_bal = s.start_balance
        curr_theo_bal = s.start_balance

        for idx, hand in enumerate(hands, 1):
            multiplier = 0
            if hand.actual_bet > 0:
                multiplier = hand.profit / hand.actual_bet
            
            theo_profit = multiplier * hand.recommended_bet
            
            curr_bal += hand.profit
            curr_theo_bal += theo_profit
            
            chart_data.append({
                "hand_num": idx,
                "profit": hand.profit,
                "theo_profit": theo_profit,
                "balance": curr_bal,
                "theo_balance": curr_theo_bal,
                "is_correct": hand.is_correct
            })
            
        analytics_data.append({
            "session_id": s.id,
            "is_active": s.is_active,
            "currency": s.currency,
            "started_at": s.started_at.isoformat() + "Z" if s.started_at else None,
            "start_balance": s.start_balance,
            "end_balance": s.current_balance,
            "theo_end_balance": curr_theo_bal,
            "total_hands": len(hands),
            "chart_data": chart_data
        })
        
    return {"sessions": analytics_data}