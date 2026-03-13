from datetime import datetime
from typing import List, Literal

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
from pydantic import BaseModel

from database.db import get_session
from database.models import User, GameSession, HandHistory
from database.crud import check_vip_status
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

@blackjack_router.get("/session/active")
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

@blackjack_router.post("/session")
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
    
    is_active_vip = await check_vip_status(user)
    keep_limit = 10 if is_active_vip else 1
    
    keep_sessions_query = select(GameSession.id).where(
        GameSession.telegram_id == user.telegram_id
    ).order_by(GameSession.id.desc()).limit(keep_limit)
    
    keep_sessions_result = await session.execute(keep_sessions_query)
    keep_session_ids = keep_sessions_result.scalars().all()
    
    if keep_session_ids:
        await session.execute(
            delete(HandHistory)
            .where(
                HandHistory.session_id.in_(
                    select(GameSession.id).where(GameSession.telegram_id == user.telegram_id)
                )
            )
            .where(HandHistory.session_id.not_in(keep_session_ids))
        )
        await session.execute(
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
    session.add(new_session)
    await session.commit()
    await session.refresh(new_session)
    
    return {"session_id": new_session.id, "balance": new_session.current_balance}

@blackjack_router.post("/analyze")
async def analyze_hand(
    req: AnalyzeRequest, 
    user: User = Depends(get_current_user), 
    session: AsyncSession = Depends(get_session)
):
    result = await session.execute(select(GameSession).where(GameSession.id == req.session_id))
    game_session = result.scalar_one_or_none()
    
    if not game_session or game_session.telegram_id != user.telegram_id or not game_session.is_active:
        raise HTTPException(status_code=400, detail="Invalid or inactive session")

    game_session.running_count = req.running_count
    game_session.cards_dealt = req.cards_dealt
    await session.commit()

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
async def record_result(
    req: ResultRequest, 
    user: User = Depends(get_current_user), 
    session: AsyncSession = Depends(get_session)
):
    result = await session.execute(select(GameSession).where(GameSession.id == req.session_id))
    game_session = result.scalar_one_or_none()
    
    if not game_session or game_session.telegram_id != user.telegram_id or not game_session.is_active:
        raise HTTPException(status_code=400, detail="Invalid session")

    profit = 0.0
    if req.outcome == 'WIN':
        profit = req.actual_bet
    elif req.outcome == 'LOSS':
        profit = -req.actual_bet

    user.virtual_balance = max(0.0, user.virtual_balance + profit)
    game_session.current_balance = max(0.0, game_session.current_balance + profit)
    
    game_session.running_count = req.running_count
    game_session.cards_dealt = req.cards_dealt
    
    analyzer = BlackjackAnalyzer()
    true_count = analyzer.get_true_count(req.running_count, req.cards_dealt)

    hand_history = HandHistory(
        session_id=game_session.id,
        player_cards=req.player_cards,
        dealer_upcard=req.dealer_upcard,
        true_count=true_count,
        action_taken=req.action_taken,
        action_recommended=req.action_recommended,
        is_correct=(req.action_taken == req.action_recommended),
        actual_bet=req.actual_bet,
        recommended_bet=req.recommended_bet,
        profit=profit
    )
    
    session.add(hand_history)
    await session.commit()
    
    return {
        "status": "recorded", 
        "new_balance": game_session.current_balance,
        "new_running_count": game_session.running_count
    }

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