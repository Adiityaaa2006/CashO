import json
import os
from typing import Tuple, Dict

def levenshtein_distance(s1: str, s2: str) -> int:
    """Compute Levenshtein distance between two strings."""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)

    if len(s2) == 0:
        return len(s1)

    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row

    return previous_row[-1]

def load_canonical_merchants(filepath: str) -> Dict[str, str]:
    """Load canonical dictionary mapping aliases to standardized names."""
    if os.path.exists(filepath):
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "swiggy": "Swiggy",
        "zomato": "Zomato",
        "uber": "Uber",
        "ola": "Ola Cabs",
        "amazon": "Amazon",
        "flipkart": "Flipkart",
        "blinkit": "Blinkit",
        "zepto": "Zepto",
        "netflix": "Netflix",
        "spotify": "Spotify",
    }

class MerchantNormalizer:
    def __init__(self, merchants_filepath: str):
        self.merchants = load_canonical_merchants(merchants_filepath)

    def normalize(self, raw_candidate: str) -> Tuple[str, float]:
        """Normalize raw candidate string using dictionary lookup and edit distance."""
        if not raw_candidate:
            return "Unknown Merchant", 0.0

        clean = raw_candidate.lower().strip()
        
        # Ignore common noise words that may have bypassed regex
        if clean in ["to", "at", "in", "the", "on", "a", "an", "is", "via", "ref", "by", "vpa", "info"]:
            return "Unknown Merchant", 0.0

        # 1. Exact dictionary match
        for key, canonical in self.merchants.items():
            if key == clean:
                return canonical, 1.0

        # 2. Key contained in candidate (e.g., 'swiggy bangalore' contains 'swiggy')
        for key, canonical in self.merchants.items():
            if len(key) >= 3 and key in clean:
                return canonical, 0.95

        # 3. Candidate is a significant prefix/substring of key (e.g., 'amaz' for 'amazon')
        if len(clean) >= 4:
            for key, canonical in self.merchants.items():
                if clean in key:
                    return canonical, 0.85

        # 4. Fuzzy matching via Levenshtein with length-aware distance threshold
        if len(clean) >= 3:
            best_match = raw_candidate
            min_dist = 999
            for key, canonical in self.merchants.items():
                if abs(len(clean) - len(key)) <= 2:
                    dist = levenshtein_distance(clean, key)
                    if dist < min_dist:
                        min_dist = dist
                        best_match = canonical

            max_allowed_dist = 1 if len(clean) <= 4 else 2
            if min_dist <= max_allowed_dist:
                confidence = max(0.6, 1.0 - (min_dist * 0.2))
                return best_match, confidence

        if len(clean) >= 2:
            return raw_candidate.title(), 0.4
        return "Unknown Merchant", 0.0
