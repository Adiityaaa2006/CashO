import pytest
from app.services.crypto import encrypt_text, decrypt_text, encrypt_json, decrypt_json

def test_encrypt_decrypt_text():
    secret = "my_super_secret_oauth_token_12345"
    cipher = encrypt_text(secret)
    assert cipher != secret
    assert len(cipher) > 20

    decrypted = decrypt_text(cipher)
    assert decrypted == secret

def test_encrypt_decrypt_json():
    data = {
        "token": "ya29.a0AfH6SM...",
        "refresh_token": "1//04...",
        "client_id": "google-client.apps.googleusercontent.com",
        "scopes": ["https://www.googleapis.com/auth/gmail.readonly"]
    }
    cipher = encrypt_json(data)
    assert isinstance(cipher, str)
    assert "ya29" not in cipher  # Never in plaintext!

    decrypted = decrypt_json(cipher)
    assert decrypted == data

def test_decrypt_corrupted_fails():
    with pytest.raises(ValueError, match="Decryption failed"):
        decrypt_text("corrupted_invalid_cipher_token")


def test_crypto_missing_encryption_key_raises(monkeypatch):
    """Ensure missing SYNC_ENCRYPTION_KEY raises ValueError and never generates in-memory keys."""
    from app.config import settings
    monkeypatch.setattr(settings, "SYNC_ENCRYPTION_KEY", "")

    with pytest.raises(ValueError, match="SYNC_ENCRYPTION_KEY is not configured"):
        encrypt_text("secret_token")

    with pytest.raises(ValueError, match="SYNC_ENCRYPTION_KEY is not configured"):
        decrypt_text("some_cipher")


def test_crypto_invalid_encryption_key_raises(monkeypatch):
    """Ensure invalid Fernet key format is safely rejected without logging secrets."""
    from app.config import settings
    monkeypatch.setattr(settings, "SYNC_ENCRYPTION_KEY", "invalid_non_base64_key")

    with pytest.raises(ValueError, match="SYNC_ENCRYPTION_KEY is invalid"):
        encrypt_text("secret_token")


def test_settings_security_validation(monkeypatch):
    """Test Settings.validate_security_config catches missing variables without exposing values."""
    from app.config import settings

    # Missing both
    monkeypatch.setattr(settings, "SYNC_ENCRYPTION_KEY", "")
    monkeypatch.setattr(settings, "ANDROID_API_KEY", "")
    with pytest.raises(ValueError) as excinfo:
        settings.validate_security_config()
    assert "SYNC_ENCRYPTION_KEY" in str(excinfo.value)
    assert "ANDROID_API_KEY" in str(excinfo.value)

    # Missing only Android key
    monkeypatch.setattr(settings, "SYNC_ENCRYPTION_KEY", "dummy_fernet_key_value")
    monkeypatch.setattr(settings, "ANDROID_API_KEY", "")
    with pytest.raises(ValueError) as excinfo:
        settings.validate_security_config()
    assert "ANDROID_API_KEY" in str(excinfo.value)

    # Both present
    monkeypatch.setattr(settings, "SYNC_ENCRYPTION_KEY", "dummy_fernet_key_value")
    monkeypatch.setattr(settings, "ANDROID_API_KEY", "dummy_android_key_value")
    # Should not raise
    settings.validate_security_config()

