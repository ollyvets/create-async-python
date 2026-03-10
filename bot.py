import asyncio
import logging
from aiogram import Bot, Dispatcher
from config import BOT_TOKEN, CRYPTO_PAY_TOKEN
from handlers import router
from database.db import async_session
from aiocryptopay import AioCryptoPay, Networks

class DbMiddleware:
    async def __call__(self, handler, event, data):
        async with async_session() as session:
            data['session'] = session
            return await handler(event, data)

async def main():
    logging.basicConfig(level=logging.INFO)
    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher()
    
    # Инициализируем CryptoPay внутри запущенного event loop
    crypto = AioCryptoPay(token=CRYPTO_PAY_TOKEN, network=Networks.MAIN_NET)
    
    # Подключаем Middleware для базы данных
    dp.message.middleware(DbMiddleware())
    dp.callback_query.middleware(DbMiddleware())
    
    # DI (Внедрение зависимостей): прокидываем crypto во все хэндлеры
    dp["crypto"] = crypto
    
    dp.include_router(router)
    
    await bot.delete_webhook(drop_pending_updates=True)
    
    try:
        await dp.start_polling(bot)
    finally:
        # Безопасно закрываем сессию крипто-бота при остановке скрипта
        await crypto.close()

if __name__ == "__main__":
    asyncio.run(main())