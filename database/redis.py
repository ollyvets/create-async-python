import redis.asyncio as redis
from config import REDIS_URL

redis_client = redis.from_url(REDIS_URL, decode_responses=True)

def get_session_key(session_id: int) -> str:
    return f"roulette:session:{session_id}:spins"

def get_bj_state_key(session_id: int) -> str:
    return f"bj:session:{session_id}:state"

def get_bj_hands_key(session_id: int) -> str:
    return f"bj:session:{session_id}:hands"