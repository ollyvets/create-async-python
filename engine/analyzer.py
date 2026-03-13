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
        
        dealer_bust_prob = {2: 35.3, 3: 37.5, 4: 40.2, 5: 42.8, 6: 42.0, 7: 25.9, 8: 23.8, 9: 23.3, 10: 21.4, 11: 11.6}
        db_prob = dealer_bust_prob.get(dealer_val, 25.0)

        win, loss, push = 0.0, 0.0, 0.0

        if action == Action.STAND:
            if player_total >= 19:
                win, loss, push = 75.0, 15.0, 10.0
            elif player_total >= 17:
                win, loss, push = 45.0, 45.0, 10.0
            else:
                # Надежда только на перебор дилера
                win = db_prob
                loss = 100.0 - db_prob
                push = 0.0

        elif action == Action.HIT or action == Action.DOUBLE:
            if player_total <= 11:
                win, loss, push = 55.0, 40.0, 5.0
            else:
                # Риск перебора игрока
                bust_risk = (player_total - 11) * 8.0 
                win = max(10.0, 50.0 - bust_risk + (db_prob * 0.5))
                loss = 100.0 - win - 5.0
                push = 5.0

        elif action == Action.SPLIT:
            win, loss, push = 48.0, 48.0, 4.0
            
        elif action == Action.SURRENDER:
            return (0.0, 100.0, 0.0)

        # Нормализация
        total = win + loss + push
        return round((win/total)*100, 1), round((loss/total)*100, 1), round((push/total)*100, 1)

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

    def _get_count_value(self, card: str) -> int:
       
        val = self._get_card_value(card)
        if val >= 2 and val <= 6:
            return 1
        elif val == 10 or val == 11:
            return -1
        return 0
    