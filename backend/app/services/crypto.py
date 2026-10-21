import json
import logging
from typing import Any, Dict
from cryptography.fernet import Fernet
from app.config import settings

logger = logging.getLogger(__name__)

def _get_fernet() -> Fernet:
    """Initialize Fernet cipher using configured secret encryption key."""
    key = settings.SYNC_ENCRYPTION_KEY
    if not key:
        raise ValueError(
            "SYNC_ENCRYPTION_KEY is not configured. "
            "Please configure a valid 32-byte Fernet key in your local .env file or environment."
        )
    if isinstance(key, str):
        key = key.encode("utf-8")
    try:
        return Fernet(key)
    except Exception as e:
        logger.error("Failed to initialize Fernet cipher: invalid encryption key format.")
        raise ValueError(
            "SYNC_ENCRYPTION_KEY is invalid. It must be a 32-byte url-safe base64-encoded string."
        )

def encrypt_text(plain_text: str) -> str:
    """Encrypt a plain text string into a Fernet cipher token."""
    if not plain_text:
        return ""
    fernet = _get_fernet()
    encrypted_bytes = fernet.encrypt(plain_text.encode("utf-8"))
    return encrypted_bytes.decode("utf-8")

def decrypt_text(cipher_text: str) -> str:
    """Decrypt a Fernet cipher token back into plain text."""
    if not cipher_text:
        return ""
    fernet = _get_fernet()
    try:
        decrypted_bytes = fernet.decrypt(cipher_text.encode("utf-8"))
        return decrypted_bytes.decode("utf-8")
    except Exception as e:
        logger.error(f"Failed to decrypt credential token: {str(e)}")
        raise ValueError("Decryption failed. Invalid encryption key or corrupt ciphertext.")

def encrypt_json(data: Dict[str, Any]) -> str:
    """Serialize dictionary to JSON and encrypt."""
    raw_json = json.dumps(data)
    return encrypt_text(raw_json)

def decrypt_json(cipher_text: str) -> Dict[str, Any]:
    """Decrypt and deserialize JSON payload."""
    raw_json = decrypt_text(cipher_text)
    if not raw_json:
        return {}
    return json.loads(raw_json)
