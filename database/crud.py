from datetime import datetime, timedelta
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from database.models import User

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