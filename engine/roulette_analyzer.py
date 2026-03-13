import math
from typing import List, Dict, Any
from collections import Counter

class RouletteAnalyzer:
    RED_NUMBERS = {1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36}
    BLACK_NUMBERS = {2, 4, 6, 8, 10, 11, 13, 15, 17, 20, 22, 24, 26, 28, 29, 31, 33, 35}
    
    VOISINS = {22, 18, 29, 7, 28, 12, 35, 3, 26, 0, 32, 15, 19, 4, 21, 2, 25}
    TIERS = {27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33}
    ORPHELINS = {1, 20, 14, 31, 9, 17, 34, 6}
    JEU_ZERO = {12, 35, 3, 26, 0, 32, 15}

    PROBABILITIES = {
        'simple': 18 / 37,
        'dozen_col': 12 / 37,
        'voisins': 17 / 37,
        'tiers': 12 / 37,
        'orphelins': 8 / 37,
        'jeu_zero': 7 / 37
    }

    def __init__(self, history: List[int]):
        self.history = history
        self.n = len(history)

    def _calculate_z_score(self, count: int, n: int, p0: float) -> float:
        if n == 0:
            return 0.0
        p_hat = count / n
        variance = (p0 * (1 - p0)) / n
        if variance == 0:
            return 0.0
        return round((p_hat - p0) / math.sqrt(variance), 2)

    def _get_properties(self, number: int) -> List[str]:
        if number == 0:
            return ['zero']
        
        props = []
        props.append('red' if number in self.RED_NUMBERS else 'black')
        props.append('even' if number % 2 == 0 else 'odd')
        props.append('low' if number <= 18 else 'high')
        
        if number <= 12:
            props.append('dozen_1')
        elif number <= 24:
            props.append('dozen_2')
        else:
            props.append('dozen_3')
            
        if number % 3 == 1:
            props.append('col_1')
        elif number % 3 == 2:
            props.append('col_2')
        elif number % 3 == 0:
            props.append('col_3')
            
        return props

    def _analyze_chances(self) -> Dict[str, Any]:
        counts = Counter()
        for num in self.history:
            counts.update(self._get_properties(num))

        results = {}
        simple_chances = ['red', 'black', 'even', 'odd', 'low', 'high']
        dozen_cols = ['dozen_1', 'dozen_2', 'dozen_3', 'col_1', 'col_2', 'col_3']

        for chance in simple_chances:
            results[chance] = {
                'count': counts[chance],
                'z_score': self._calculate_z_score(counts[chance], self.n, self.PROBABILITIES['simple'])
            }

        for dc in dozen_cols:
            results[dc] = {
                'count': counts[dc],
                'z_score': self._calculate_z_score(counts[dc], self.n, self.PROBABILITIES['dozen_col'])
            }

        return results

    def _analyze_sectors(self) -> Dict[str, Any]:
        counts = {'voisins': 0, 'tiers': 0, 'orphelins': 0, 'jeu_zero': 0}
        
        for num in self.history:
            if num in self.VOISINS: counts['voisins'] += 1
            if num in self.TIERS: counts['tiers'] += 1
            if num in self.ORPHELINS: counts['orphelins'] += 1
            if num in self.JEU_ZERO: counts['jeu_zero'] += 1

        results = {}
        for sector, count in counts.items():
            results[sector] = {
                'count': count,
                'z_score': self._calculate_z_score(count, self.n, self.PROBABILITIES[sector])
            }
        return results

    def _find_streaks(self) -> List[Dict[str, Any]]:
        if not self.history:
            return []

        streaks = []
        latest_num = self.history[-1]
        latest_props = self._get_properties(latest_num)

        for prop in latest_props:
            if prop == 'zero':
                continue
                
            streak_length = 0
            for num in reversed(self.history):
                if prop in self._get_properties(num):
                    streak_length += 1
                else:
                    break
            
            p0 = self.PROBABILITIES['simple'] if prop in ['red', 'black', 'even', 'odd', 'low', 'high'] else self.PROBABILITIES['dozen_col']
            probability = p0 ** streak_length
            
            streaks.append({
                'property': prop,
                'length': streak_length,
                'probability': round(probability, 5),
                'is_anomaly': probability < 0.001
            })

        return sorted(streaks, key=lambda x: x['probability'])

    def _get_hot_cold(self) -> Dict[str, List[int]]:
        counts = Counter(self.history)
        sorted_nums = counts.most_common()
        return {
            'hot': [num for num, _ in sorted_nums[:5]],
            'cold': [num for num in range(37) if num not in counts][:5] or [num for num, _ in sorted_nums[-5:]]
        }

    def analyze(self) -> Dict[str, Any]:
        if self.n == 0:
            return {"error": "No history provided"}

        return {
            "total_spins": self.n,
            "chances": self._analyze_chances(),
            "sectors": self._analyze_sectors(),
            "streaks": self._find_streaks(),
            "hot_cold": self._get_hot_cold()
        }