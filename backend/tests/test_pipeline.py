from app.services.pipeline import run_pipeline

def test_pipeline_basic_debit():
    sample_sms = "Rs. 350.00 debited from A/c XX1234 at Swiggy on 10-Oct-2026."
    res = run_pipeline(sample_sms, source="sms", db=None)
    
    assert res.transaction.amount == 350.0
    assert res.transaction.transaction_type == "DEBIT"
    assert res.transaction.merchant_normalized == "Swiggy"
    assert res.transaction.category == "Food & Dining"
