from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete

from database.db import get_session  # Исправлено: get_session вместо get_db
from database.crud import (
    create_roulette_session, add_roulette_spin, 
    add_roulette_spins_bulk, get_roulette_session_history,
    delete_old_free_sessions, check_vip_status
)
from database.models import User, RouletteSession
from engine.roulette_analyzer import RouletteAnalyzer
from security import get_current_user

router = APIRouter(prefix="/api/roulette", tags=["Roulette"])

# Утилита для очистки старых сессий VIP (можно вынести в crud.py позже)
async def cleanup_vip_sessions(db: AsyncSession, telegram_id: int):
    result = await db.execute(
        select(RouletteSession.id)
        .where(RouletteSession.telegram_id == telegram_id)
        .order_by(RouletteSession.created_at.desc())
        .offset(10)
    )
    old_session_ids = result.scalars().all()
    if old_session_ids:
        await db.execute(
            delete(RouletteSession).where(RouletteSession.id.in_(old_session_ids))
        )
        await db.commit()

class RouletteSyncRequest(BaseModel):
    session_id: int
    numbers: List[int]

class RouletteSpinRequest(BaseModel):
    session_id: int
    number: int

@router.post("/session")
async def start_session(
    user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_session)
):
    is_vip = await check_vip_status(user)
    
    if is_vip:
        await cleanup_vip_sessions(db, user.telegram_id)
    else:
        await delete_old_free_sessions(db, user.telegram_id)

    session = await create_roulette_session(db, user.telegram_id)
    return {"session_id": session.id, "is_vip": is_vip}

@router.post("/sync")
async def sync_history(
    req: RouletteSyncRequest, 
    user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_session)
):
    is_vip = await check_vip_status(user)
    
    await add_roulette_spins_bulk(db, req.session_id, req.numbers)
    history = await get_roulette_session_history(db, req.session_id)
    
    analyzer = RouletteAnalyzer(history)
    analysis = analyzer.analyze()
    
    if not is_vip:
        analysis.pop("streaks", None)
        analysis.pop("sectors", None)
        
    return analysis

@router.post("/spin")
async def add_spin(
    req: RouletteSpinRequest, 
    user: User = Depends(get_current_user), 
    db: AsyncSession = Depends(get_session)
):
    is_vip = await check_vip_status(user)
    
    history = await get_roulette_session_history(db, req.session_id)
    next_index = len(history)
    
    await add_roulette_spin(db, req.session_id, req.number, next_index)
    history.append(req.number)
    
    analyzer = RouletteAnalyzer(history)
    analysis = analyzer.analyze()
    
    if not is_vip:
        analysis.pop("streaks", None)
        analysis.pop("sectors", None)
        
    return analysis