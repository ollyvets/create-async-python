import os
from dotenv import load_dotenv

load_dotenv()

BOT_TOKEN = os.getenv("BOT_TOKEN")
DATABASE_URL = os.getenv("DATABASE_URL")
POSTBACK_SECRET = os.getenv("POSTBACK_SECRET")
CRYPTO_PAY_TOKEN = os.getenv("CRYPTO_PAY_TOKEN")
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")