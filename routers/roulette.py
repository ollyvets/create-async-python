from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession

from database.db import get_session
from database.crud import (
    create_roulette_session, delete_old_free_sessions, 
    check_vip_status, flush_session_to_db, get_active_session_for_user
)
from database.models import User
from database.redis import redis_client, get_session_key
from engine.roulette_analyzer import RouletteAnalyzer
from security import get_current_user

router = APIRouter(prefix="/api/roulette", tags=["Roulette"])

MAX_SPINS_PER_SESSION = 1000

class RouletteSyncRequest(BaseModel):
    session_id: int
    numbers: List[int]

class RouletteSpinRequest(BaseModel):
    session_id: int
    number: int

class RouletteCloseRequest(BaseModel):
    session_id: int

async def check_rate_limit(session_id: int):
    """Простой Rate Limiter: макс 3 запроса в секунду для сессии"""
    rl_key = f"rl:roulette:{session_id}"
    req_count = await redis_client.incr(rl_key)
    if req_count == 1:
        await redis_client.expire(rl_key, 1) # Окно в 1 секунду
    
    if req_count > 3:
        raise HTTPException(status_code=429, detail="Too many requests. Please slow down.")

@router.post("/session")
async def start_session(
    user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_session)
):
    is_vip = await check_vip_status(user)
    
    active_session = await get_active_session_for_user(db, user.telegram_id)
    if active_session:
        await flush_session_to_db(db, active_session.id)
    
    if not is_vip:
        await delete_old_free_sessions(db, user.telegram_id)

    session = await create_roulette_session(db, user.telegram_id)
    
    await redis_client.delete(get_session_key(session.id))
    
    return {"session_id": session.id, "is_vip": is_vip}

@router.post("/sync")
async def sync_history(
    req: RouletteSyncRequest, 
    user: User = Depends(get_current_user)
):
    await check_rate_limit(req.session_id)
    
    if req.numbers and len(req.numbers) > MAX_SPINS_PER_SESSION:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot sync more than {MAX_SPINS_PER_SESSION} numbers. Please start a new session."
        )

    is_vip = await check_vip_status(user)
    redis_key = get_session_key(req.session_id)
    
    await redis_client.delete(redis_key)
    if req.numbers:
        await redis_client.rpush(redis_key, *req.numbers)
    
    analyzer = RouletteAnalyzer(req.numbers)
    analysis = analyzer.analyze()
    
    if not is_vip:
        analysis.pop("streaks", None)
        analysis.pop("sectors", None)
        
    return analysis

@router.post("/spin")
async def add_spin(
    req: RouletteSpinRequest, 
    user: User = Depends(get_current_user)
):
    await check_rate_limit(req.session_id)
    
    redis_key = get_session_key(req.session_id)
    
    # Защита от переполнения списка в Redis и БД
    current_length = await redis_client.llen(redis_key)
    if current_length >= MAX_SPINS_PER_SESSION:
        raise HTTPException(
            status_code=400, 
            detail=f"Maximum limit of {MAX_SPINS_PER_SESSION} spins reached. Please close this session and start a new one."
        )

    is_vip = await check_vip_status(user)
    
    await redis_client.rpush(redis_key, req.number)
    
    history_str = await redis_client.lrange(redis_key, 0, -1)
    history = [int(n) for n in history_str]
    
    # Оптимизация: для анализатора берем только последние 200 спинов, 
    # чтобы не грузить CPU при длинных сессиях
    analyze_history = history[-200:] if len(history) > 200 else history
    analyzer = RouletteAnalyzer(analyze_history)
    analysis = analyzer.analyze()
    
    if not is_vip:
        analysis.pop("streaks", None)
        analysis.pop("sectors", None)
        
    return analysis

@router.post("/close")
async def close_session(
    req: RouletteCloseRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    await check_rate_limit(req.session_id)
    await flush_session_to_db(db, req.session_id)
    return {"status": "ok"}