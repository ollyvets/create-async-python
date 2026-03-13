from fastapi import APIRouter, Depends
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

class RouletteSyncRequest(BaseModel):
    session_id: int
    numbers: List[int]

class RouletteSpinRequest(BaseModel):
    session_id: int
    number: int

class RouletteCloseRequest(BaseModel):
    session_id: int

@router.post("/session")
async def start_session(
    user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_session)
):
    is_vip = await check_vip_status(user)
    
    # Проверяем, есть ли зависшая активная сессия. Если да - сбрасываем ее в БД.
    active_session = await get_active_session_for_user(db, user.telegram_id)
    if active_session:
        await flush_session_to_db(db, active_session.id)
    
    # Очистка старых данных
    if not is_vip:
        await delete_old_free_sessions(db, user.telegram_id)
    # VIP сессии пока не трогаем, пусть висят в истории

    # Создаем новую запись в БД
    session = await create_roulette_session(db, user.telegram_id)
    
    # Очищаем возможный старый ключ в Redis на всякий случай
    await redis_client.delete(get_session_key(session.id))
    
    return {"session_id": session.id, "is_vip": is_vip}

@router.post("/sync")
async def sync_history(
    req: RouletteSyncRequest, 
    user: User = Depends(get_current_user)
):
    is_vip = await check_vip_status(user)
    redis_key = get_session_key(req.session_id)
    
    # Очищаем Redis и заливаем новую пачку (sync перезаписывает историю)
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
    is_vip = await check_vip_status(user)
    redis_key = get_session_key(req.session_id)
    
    # Добавляем в конец списка в Redis
    await redis_client.rpush(redis_key, req.number)
    
    # Читаем всю историю из Redis
    history_str = await redis_client.lrange(redis_key, 0, -1)
    history = [int(n) for n in history_str]
    
    # Здесь можно добавить оптимизацию в будущем: если len(history) > 200, 
    # передавать в анализатор только срез history[-200:], чтобы не грузить CPU
    analyzer = RouletteAnalyzer(history)
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
    await flush_session_to_db(db, req.session_id)
    return {"status": "ok"}