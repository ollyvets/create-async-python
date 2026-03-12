from enum import Enum
from pydantic import BaseModel
from typing import List

class Action(str, Enum):
    HIT = "HIT"
    STAND = "STAND"
    DOUBLE = "DOUBLE"
    SPLIT = "SPLIT"
    SURRENDER = "SURRENDER"

class GameState(BaseModel):
    player_cards: List[str]
    dealer_upcard: str
    running_count: int
    decks_remaining: float

class Recommendation(BaseModel):
    action: Action
    win_prob: float
    loss_prob: float
    push_prob: float
    expected_value: float