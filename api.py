import hmac
import hashlib
import json
import time
from datetime import datetime
from urllib.parse import parse_qsl

from fastapi import FastAPI, Request, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from aiogram import Bot

from config import BOT_TOKEN, POSTBACK_SECRET
from database.db import get_session
from database.models import User, PostbackLog
from database.crud import check_vip_status

from fastapi import Request, Depends, HTTPException, Header
from datetime import timedelta

app = FastAPI()
bot = Bot(token=BOT_TOKEN)

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
                else:
                    
                    pass 
        
       
        log_entry = PostbackLog(sub1=sub1, transaction_id=transaction_id, raw_data=raw_data, status="processed")
        session.add(log_entry)
        await session.commit()
        
    except ValueError:
       
        await session.rollback()
        raise HTTPException(status_code=400, detail="Invalid sub1 format")
    except Exception as e:
       
        await session.rollback()
        print(f"Postback Error: {e}") 
        raise HTTPException(status_code=500, detail="Internal Server Error")

    return {"status": "success", "user_updated": True if action == "deposit" and user and not user.has_used_trial else False}

from config import CRYPTO_PAY_TOKEN

@app.post("/api/crypto-webhook")
async def crypto_webhook(
    request: Request, 
    crypto_pay_api_signature: str = Header(None), 
    session: AsyncSession = Depends(get_session)
):
    body = await request.body()
    
    # 1. Жесткая защита: Проверяем криптографическую подпись CryptoBot
    # Это гарантирует, что запрос прислал именно CryptoBot, а не хакер
    secret = hashlib.sha256(CRYPTO_PAY_TOKEN.encode('utf-8')).digest()
    calc_signature = hmac.new(secret, body, hashlib.sha256).hexdigest()
    
    if calc_signature != crypto_pay_api_signature:
        raise HTTPException(status_code=403, detail="Invalid signature")
        
    data = await request.json()
    
    # 2. Обрабатываем только успешные оплаты
    if data.get('update_type') == 'invoice_paid':
        invoice = data['payload']
        payload_data = invoice.get('payload', '') # Достаем то, что спрятали (ID_СРОК)
        
        try:
            tg_id_str, duration = payload_data.split('_')
            tg_id = int(tg_id_str)
            days = 30 if duration == '1m' else 90
            
            # 3. Ищем юзера и обновляем базу
            result = await session.execute(select(User).where(User.telegram_id == tg_id))
            user = result.scalar_one_or_none()
            
            if user:
                # Если у юзера УЖЕ есть активный VIP, мы просто прибавляем дни к остатку!
                if user.is_vip and user.vip_until and user.vip_until > datetime.utcnow():
                    user.vip_until = user.vip_until + timedelta(days=days)
                else:
                    user.is_vip = True
                    user.vip_until = datetime.utcnow() + timedelta(days=days)
                    
                await session.commit()
                
                # 4. Радуем юзера сообщением в Телеграм!
                await bot.send_message(
                    chat_id=tg_id, 
                    text=f"✅ **Оплата успешно получена!**\n\nТвой VIP-доступ активирован на {days} дней. Приятного использования Анализатора!",
                    parse_mode="Markdown"
                )
        except Exception as e:
            print(f"Error processing invoice: {e}")
            await session.rollback()
            
    # CryptoBot ждет ответа 200 OK, чтобы понять, что мы всё обработали
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