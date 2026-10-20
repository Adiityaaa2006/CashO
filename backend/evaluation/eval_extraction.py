import json
import os
from app.nlp.preprocess import preprocess_message
from app.nlp.extractor import extract_entities
from app.nlp.merchant_normalizer import MerchantNormalizer

def run_extraction_evaluation():
    sample_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "sample", "sample_sms.json")
    with open(sample_file, "r") as f:
        samples = json.load(f)

    merchants_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "merchants.json")
    normalizer = MerchantNormalizer(merchants_file)

    correct_amount = 0
    correct_type = 0
    correct_merchant = 0
    total = len(samples)

    for item in samples:
        clean = preprocess_message(item["text"])
        entities = extract_entities(clean)
        norm_merchant, _ = normalizer.normalize(entities.get("merchant_candidate", ""))

        exp = item["expected"]
        if abs(entities["amount"] - exp["amount"]) < 0.01:
            correct_amount += 1
        if entities["transaction_type"] == exp["type"]:
            correct_type += 1
        if exp["merchant"].lower() in norm_merchant.lower():
            correct_merchant += 1

    print(f"Extraction Evaluation on {total} samples:")
    print(f"  Amount Accuracy:   {correct_amount / total * 100:.1f}%")
    print(f"  Type Accuracy:     {correct_type / total * 100:.1f}%")
    print(f"  Merchant Accuracy: {correct_merchant / total * 100:.1f}%")

if __name__ == "__main__":
    run_extraction_evaluation()
