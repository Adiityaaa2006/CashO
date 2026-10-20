import json
import os
import re
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
        """Normalize raw candidate string using dictionary lookup, edit distance, and payee formatting."""
        if not raw_candidate:
            return "Unknown Merchant", 0.0

        clean = raw_candidate.lower().strip()
        
        # Clean out common noise prefixes/suffixes
        for noise in ["order no", "order", "rrn", "ref", "please report", "if you", "help@", "support@"]:
            if noise in clean:
                clean = clean.replace(noise, "").strip()

        clean = re.sub(r'\b(?:via|using|through|on\s+your|into\s+your)\b.*', '', clean).strip()
        clean = re.sub(r'\s+', ' ', clean).strip()

        # Ignore noise words
        if clean in ["to", "at", "in", "the", "on", "a", "an", "is", "via", "ref", "by", "vpa", "info", "it", "you", "open it"]:
            return "Unknown Merchant", 0.0

        # 1. Exact dictionary match
        for key, canonical in self.merchants.items():
            if key == clean:
                return canonical, 1.0

        # 2. Key contained in candidate (e.g., 'swiggy bangalore' contains 'swiggy', 'slice bank account' contains 'slice')
        for key, canonical in self.merchants.items():
            if len(key) >= 3 and (key in clean or clean in key):
                return canonical, 0.95

        # 3. Fuzzy matching via Levenshtein with length-aware distance threshold
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
                confidence = max(0.65, 1.0 - (min_dist * 0.15))
                return best_match, round(confidence, 2)

        # 4. Valid individual payee / store name (title-cased)
        if len(clean) >= 3:
            # If candidate looks like a valid person name or merchant (contains letters, not just numbers/symbols)
            clean_name = re.sub(r'[^A-Za-z0-9\s]', '', clean).strip()
            clean_name = re.sub(r'\s+', ' ', clean_name).strip()
            if len(clean_name) >= 3 and not clean_name.isdigit():
                return clean_name.title(), 0.70

        return "Unknown Merchant", 0.0
