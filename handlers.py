from aiogram import Router, F
from aiogram.types import Message, CallbackQuery, InlineKeyboardMarkup, InlineKeyboardButton
from sqlalchemy.ext.asyncio import AsyncSession
from database.crud import get_or_create_user, check_vip_status
from keyboards import get_main_keyboard, get_payment_keyboard, get_back_keyboard
from aiocryptopay import AioCryptoPay

router = Router()

@router.message(F.text == "/start")
async def cmd_start(message: Message, session: AsyncSession):
    user = await get_or_create_user(session, message.from_user.id, message.from_user.username)
    has_access = await check_vip_status(user)
    
    if user.is_vip and has_access:
        status_text = "💎 VIP (Активен)"
    elif user.trial_started_at and has_access:
        status_text = "⏳ VIP-тест (Активен 3 часа)"
    else:
        status_text = "❌ Доступ отсутствует"
    
    text = (
        f"Привет, {message.from_user.first_name}!\n\n"
        f"Это аналитический инструмент для iGaming.\n"
        f"Твой статус доступа: {status_text}\n\n"
        f"Выбери действие ниже:"
    )
    await message.answer(text, reply_markup=get_main_keyboard(has_access, user.has_used_trial))

@router.callback_query(F.data == "buy_vip")
async def process_buy_vip(callback: CallbackQuery, session: AsyncSession):
    user = await get_or_create_user(session, callback.from_user.id, callback.from_user.username)
    
    if user.has_used_trial:
        
        text = (
            "💎 **VIP Доступ**\n\n"
            "Твой статус: 🟢 **Партнер**\n"
            "📉 *Скидка до 35% активирована навсегда!*\n\n"
            "Выбери тарифный план:"
        )
    else:
        
        text = (
            "💎 **VIP Доступ**\n\n"
            "Твой статус: ⚪️ Базовый\n\n"
            "💡 *Лайфхак: хочешь цены ниже? Вернись назад, нажми «🎁 VIP бесплатно» и стань Партнером.*\n\n"
            "Выбери тарифный план:"
        )
        
    await callback.message.edit_text(text, parse_mode="Markdown", reply_markup=get_payment_keyboard(user.has_used_trial))

@router.callback_query(F.data == "get_vip_free")
async def process_get_vip_free(callback: CallbackQuery):
    tg_id = callback.from_user.id
    ref_link = f"https://1w.com/ref?sub1={tg_id}"
    
    text = (
        f"🎁 **Получить VIP на 3 часа бесплатно**\n\n"
        f"Чтобы протестировать Анализатор, зарегистрируйся по ссылке ниже "
        f"и внеси первый депозит (любая сумма).\n\n"
        f"🔗 Твоя персональная ссылка:\n{ref_link}\n\n"
        f"⚡️ После депозита система автоматически выдаст тебе полный доступ на 3 часа.\n\n"
        f"💎 *Бонус: Ты получишь статус партнера и навсегда закрепишь за собой сниженные цены на подписку!*"
    )
    # Здесь просто кнопка назад, чтобы не мешать цены и рефералку
    await callback.message.edit_text(text, parse_mode="Markdown", reply_markup=get_back_keyboard())

@router.callback_query(F.data == "back_to_main")
async def process_back_to_main(callback: CallbackQuery, session: AsyncSession):
    user = await get_or_create_user(session, callback.from_user.id, callback.from_user.username)
    has_access = await check_vip_status(user)
    
    if user.is_vip and has_access:
        status_text = "💎 VIP (Активен)"
    elif user.trial_started_at and has_access:
        status_text = "⏳ VIP-тест (Активен 3 часа)"
    else:
        status_text = "❌ Доступ отсутствует"
    
    text = (
        f"Главное меню.\n"
        f"Твой статус доступа: {status_text}"
    )
    await callback.message.edit_text(text, reply_markup=get_main_keyboard(has_access, user.has_used_trial))

@router.callback_query(F.data.in_(["pay_crypto_1m", "pay_crypto_3m"]))
async def process_crypto_payment(callback: CallbackQuery, session: AsyncSession, crypto: AioCryptoPay):
    user = await get_or_create_user(session, callback.from_user.id, callback.from_user.username)
    is_partner = user.has_used_trial
    
    if callback.data == "pay_crypto_1m":
        price = 10 if is_partner else 15
        payload_data = f"{callback.from_user.id}_1m"
        desc = "VIP подписка на 1 месяц"
    else:
        price = 25 if is_partner else 39
        payload_data = f"{callback.from_user.id}_3m"
        desc = "VIP подписка на 3 месяца"
        
    try:
        invoice = await crypto.create_invoice(
            asset='USDT',
            amount=price,
            description=desc,
            payload=payload_data
        )
        
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text="🔗 Оплатить счет", url=invoice.bot_invoice_url)],
            [InlineKeyboardButton(text="◀️ Назад", callback_data="buy_vip")]
        ])
        
        await callback.message.edit_text(
            f"🧾 **Счет создан!**\n\n"
            f"Сумма к оплате: **{price} USDT**\n"
            f"План: {desc}\n\n"
            f"Нажми на кнопку ниже, чтобы перейти к безопасной оплате через CryptoBot. "
            f"После успешной транзакции подписка активируется автоматически.",
            parse_mode="Markdown",
            reply_markup=keyboard
        )
    except Exception as e:
        await callback.message.answer("❌ Ошибка при создании счета. Попробуй позже.")
        print(f"CryptoPay Error: {e}")
    