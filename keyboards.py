from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.types.web_app_info import WebAppInfo

WEB_APP_URL = "https://unstringed-in-perplexed.ngrok-free.dev" 

def get_main_keyboard(has_access: bool = False, has_used_trial: bool = False) -> InlineKeyboardMarkup:
    buttons = []
    
    if has_access:
        buttons.append([InlineKeyboardButton(text="🚀 Открыть Анализатор", web_app=WebAppInfo(url=WEB_APP_URL))])
    
    bottom_row = [InlineKeyboardButton(text="💎 Купить VIP", callback_data="buy_vip")]
    
    if not has_used_trial:
        bottom_row.append(InlineKeyboardButton(text="🎁 VIP бесплатно", callback_data="get_vip_free"))
        
    buttons.append(bottom_row)
    
    return InlineKeyboardMarkup(inline_keyboard=buttons)

def get_payment_keyboard(is_partner: bool) -> InlineKeyboardMarkup:
    # Динамическое ценообразование
    price_1m = 10 if is_partner else 15
    price_3m = 25 if is_partner else 39
    
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(text=f"💳 1 Месяц — ${price_1m} (Crypto)", callback_data="pay_crypto_1m")
            ],
            [
                InlineKeyboardButton(text=f"💳 3 Месяца — ${price_3m} (Crypto)", callback_data="pay_crypto_3m")
            ],
            [
                InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_main")
            ]
        ]
    )

def get_back_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_main")]
        ]
    )