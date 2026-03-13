from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database.models import User, RouletteSession, RouletteSpin
from sqlalchemy import select, update, delete

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