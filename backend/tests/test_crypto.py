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
    with pytest.raises(ValueError):
        decrypt_text("corrupted_invalid_cipher_token")
