from typing import List, Tuple
from .bj_types import Action, GameState, Recommendation
from .strategy import HARD_STRATEGY, SOFT_STRATEGY, SPLIT_STRATEGY, ILLUSTRIOUS_18

class BlackjackAnalyzer:
    def __init__(self, total_decks: int = 6):
        self.total_decks = total_decks

    def _get_card_value(self, card: str) -> int:
        if card in ['J', 'Q', 'K']:
            return 10
        if card == 'A':
            return 11
        return int(card)

    def _parse_hand(self, cards: List[str]) -> Tuple[int, bool, bool]:
        total = 0
        aces = 0
        is_split = False
        if len(cards) == 2 and self._get_card_value(cards[0]) == self._get_card_value(cards[1]):
            is_split = True
        for card in cards:
            val = self._get_card_value(card)
            if val == 11:
                aces += 1
            total += val
        while total > 21 and aces > 0:
            total -= 10
            aces -= 1
        is_soft = aces > 0 and total <= 21
        return total, is_soft, is_split

    def get_true_count(self, running_count: int, cards_dealt: int) -> float:
        decks_remaining = self.total_decks - (cards_dealt / 52.0)
        if decks_remaining <= 0:
            return 0.0
        return running_count / decks_remaining

    def _calculate_probabilities(self, action: Action, player_total: int, dealer_val: int) -> Tuple[float, float, float]:
        base_win = 42.0
        base_loss = 49.0
        base_push = 9.0

        if action == Action.STAND:
            if player_total >= 19:
                base_win = 75.0 - (dealer_val * 1.5)
            elif player_total >= 17:
                base_win = 50.0 - (dealer_val * 2.0)
            else:
                base_win = 30.0 - (dealer_val * 1.5)
        elif action == Action.HIT or action == Action.DOUBLE:
            if player_total <= 11:
                base_win = 55.0 - (dealer_val * 1.2)
            else:
                base_win = 40.0 - (dealer_val * 1.5)
        elif action == Action.SPLIT:
            base_win = 52.0 - (dealer_val * 1.2)
        elif action == Action.SURRENDER:
            return (0.0, 100.0, 0.0)

        base_win = max(5.0, min(85.0, base_win))
        base_push = max(2.0, min(15.0, base_push))
        base_loss = 100.0 - base_win - base_push

        return round(base_win, 1), round(base_loss, 1), round(base_push, 1)

    def get_recommendation(self, state: GameState) -> Recommendation:
        player_total, is_soft, is_split = self._parse_hand(state.player_cards)
        dealer_val = self._get_card_value(state.dealer_upcard)
        tc = self.get_true_count(state.running_count, state.decks_remaining)
        
        dev_key = f"{player_total}_{dealer_val}"
        action = Action.STAND

        if dev_key in ILLUSTRIOUS_18:
            deviation = ILLUSTRIOUS_18[dev_key]
            if tc >= deviation["tc"]:
                action = deviation["action"]
                wp, lp, pp = self._calculate_probabilities(action, player_total, dealer_val)
                return Recommendation(action=action, win_prob=wp, loss_prob=lp, push_prob=pp, expected_value=0.0)

        if is_split:
            split_val = self._get_card_value(state.player_cards[0])
            if split_val in SPLIT_STRATEGY and dealer_val in SPLIT_STRATEGY[split_val]:
                action = SPLIT_STRATEGY[split_val][dealer_val]
                if action != Action.SPLIT:
                    action = self._get_standard_action(player_total, is_soft, dealer_val)
        else:
            action = self._get_standard_action(player_total, is_soft, dealer_val)

        wp, lp, pp = self._calculate_probabilities(action, player_total, dealer_val)
        return Recommendation(action=action, win_prob=wp, loss_prob=lp, push_prob=pp, expected_value=0.0)

    def _get_standard_action(self, total: int, is_soft: bool, dealer_val: int) -> Action:
        if total >= 18 and not is_soft:
            return Action.STAND
        if total <= 8 and not is_soft:
            return Action.HIT
        if is_soft:
            return SOFT_STRATEGY.get(total, {}).get(dealer_val, Action.HIT)
        return HARD_STRATEGY.get(total, {}).get(dealer_val, Action.HIT)