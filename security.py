import hmac
import hashlib
import json
import time
from urllib.parse import parse_qsl

from fastapi import Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from config import BOT_TOKEN
from database.db import get_session
from database.models import User

# Константа времени жизни токена (2 часа = 7200 секунд)
AUTH_VALID_DURATION = 7200 

def verify_telegram_data(init_data: str) -> dict | bool:
    try:
        parsed_data = dict(parse_qsl(init_data))
        hash_value = parsed_data.pop('hash', None)
        
        auth_date = int(parsed_data.get('auth_date', 0))
        # Проверка срока годности токена
        if time.time() - auth_date > AUTH_VALID_DURATION:
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