import json

from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database.models import User, RouletteSession, RouletteSpin, GameSession, HandHistory
from sqlalchemy import select, update, delete
from database.redis import redis_client, get_session_key, get_bj_state_key, get_bj_hands_key

async def get_or_create_user(session: AsyncSession, telegram_id: int, username: str | None) -> User:
    result = await session.execute(select(User).where(User.telegram_id == telegram_id))
    user = result.scalar_one_or_none()

    if not user:
        user = User(
            telegram_id=telegram_id,
            username=username,
            is_vip=False,
            sub1_click_id=f"hash_{telegram_id}_{int(datetime.utcnow().timestamp())}"
        )
        session.add(user)
        await session.commit()
        await session.refresh(user)
    
    return user

async def check_vip_status(user: User) -> bool:
    if user.is_vip:
        if user.vip_until and user.vip_until < datetime.utcnow():
            return False
        return True
    
    if user.trial_started_at:
        trial_end = user.trial_started_at + timedelta(hours=3)
        if datetime.utcnow() < trial_end:
            return True
            
    return False

async def create_roulette_session(session: AsyncSession, telegram_id: int) -> RouletteSession:
    await session.execute(
        update(RouletteSession)
        .where(RouletteSession.telegram_id == telegram_id, RouletteSession.is_active == True)
        .values(is_active=False, ended_at=datetime.utcnow())
    )
    
    new_session = RouletteSession(telegram_id=telegram_id)
    session.add(new_session)
    await session.commit()
    await session.refresh(new_session)
    return new_session

async def add_roulette_spin(session: AsyncSession, session_id: int, number: int, order_index: int) -> RouletteSpin:
    spin = RouletteSpin(session_id=session_id, number=number, order_index=order_index)
    session.add(spin)
    await session.commit()
    return spin

async def add_roulette_spins_bulk(session: AsyncSession, session_id: int, numbers: list[int], start_index: int = 0):
    spins = [
        RouletteSpin(session_id=session_id, number=num, order_index=start_index + i)
        for i, num in enumerate(numbers)
    ]
    session.add_all(spins)
    await session.commit()

async def get_roulette_session_history(session: AsyncSession, session_id: int) -> list[int]:
    result = await session.execute(
        select(RouletteSpin.number)
        .where(RouletteSpin.session_id == session_id)
        .order_by(RouletteSpin.order_index)
    )
    return list(result.scalars().all())

async def end_roulette_session(session: AsyncSession, session_id: int):
    await session.execute(
        update(RouletteSession)
        .where(RouletteSession.id == session_id)
        .values(is_active=False, ended_at=datetime.utcnow())
    )
    await session.commit()

async def delete_old_free_sessions(session: AsyncSession, telegram_id: int):
    await session.execute(
        delete(RouletteSession)
        .where(RouletteSession.telegram_id == telegram_id, RouletteSession.is_active == False)
    )
    await session.commit()

async def flush_session_to_db(db: AsyncSession, session_id: int) -> bool:
    """Сбрасывает спины из Redis в PostgreSQL и закрывает сессию"""
    redis_key = get_session_key(session_id)
    
    # Забираем все спины из Redis
    spins_str = await redis_client.lrange(redis_key, 0, -1)
    if not spins_str:
        # Сессия пустая, просто пометим как закрытую
        await db.execute(
            update(RouletteSession)
            .where(RouletteSession.id == session_id)
            .values(is_active=False, ended_at=datetime.utcnow())
        )
        await db.commit()
        return True

    # Формируем объекты для массовой вставки
    spins_to_insert = [
        RouletteSpin(session_id=session_id, number=int(num), order_index=idx)
        for idx, num in enumerate(spins_str)
    ]
    
    db.add_all(spins_to_insert)
    
    # Закрываем сессию
    await db.execute(
        update(RouletteSession)
        .where(RouletteSession.id == session_id)
        .values(is_active=False, ended_at=datetime.utcnow())
    )
    
    await db.commit()
    
    # Удаляем ключ из Redis
    await redis_client.delete(redis_key)
    return True

async def get_active_session_for_user(db: AsyncSession, telegram_id: int):
    """Ищет активную сессию юзера в БД"""
    result = await db.execute(
        select(RouletteSession)
        .where(RouletteSession.telegram_id == telegram_id, RouletteSession.is_active == True)
        .order_by(RouletteSession.created_at.desc())
    )
    return result.scalars().first()

async def flush_bj_session_to_db(db: AsyncSession, session_id: int) -> bool:
    """Сбрасывает раздачи Блэкджека из Redis в PostgreSQL и закрывает сессию"""
    state_key = get_bj_state_key(session_id)
    hands_key = get_bj_hands_key(session_id)
    
    state = await redis_client.hgetall(state_key)
    hands_str = await redis_client.lrange(hands_key, 0, -1)
    
    if not state:
        # Сессия уже закрыта или пуста
        await db.execute(
            update(GameSession)
            .where(GameSession.id == session_id)
            .values(is_active=False, ended_at=datetime.utcnow())
        )
        await db.commit()
        return True

    # Обновляем финальные данные сессии
    await db.execute(
        update(GameSession)
        .where(GameSession.id == session_id)
        .values(
            current_balance=float(state.get("balance", 0)),
            running_count=float(state.get("running_count", 0)),
            cards_dealt=int(state.get("cards_dealt", 0)),
            is_active=False,
            ended_at=datetime.utcnow()
        )
    )
    
    # Формируем объекты раздач для массовой вставки
    if hands_str:
        hands_to_insert = []
        for h_str in hands_str:
            h_data = json.loads(h_str)
            hands_to_insert.append(HandHistory(
                session_id=session_id,
                player_cards=h_data["player_cards"],
                dealer_upcard=h_data["dealer_upcard"],
                true_count=h_data["true_count"],
                action_taken=h_data["action_taken"],
                action_recommended=h_data["action_recommended"],
                is_correct=h_data["is_correct"],
                actual_bet=h_data["actual_bet"],
                recommended_bet=h_data["recommended_bet"],
                profit=h_data["profit"]
            ))
        db.add_all(hands_to_insert)
        
    await db.commit()
    
    await redis_client.delete(state_key, hands_key)
    return True