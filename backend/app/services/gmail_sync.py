import base64
import re
import logging
import threading
import time
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
from email.utils import parsedate_to_datetime
from sqlalchemy.orm import Session

from app.config import settings
from app.db.models import SyncConnectionModel
from app.services.crypto import encrypt_json, decrypt_json
from app.services.ingestion import ingest_batch
from app.schemas import BatchIngestItem, BatchIngestResponse

logger = logging.getLogger(__name__)

DEFAULT_FINANCIAL_QUERY = (
    'subject:(debited OR credited OR payment OR "bank alert" OR "order confirmation" '
    'OR invoice OR receipt OR txn OR UPI OR refund OR "spent on" OR statement)'
)


class OAuthStateManager:
    """
    Secure, short-lived, one-time server-side store for OAuth state and PKCE code_verifier.
    Prevents CSRF, ensures code_verifier preservation without exposing it to the frontend,
    and isolates concurrent user sessions.
    """
    def __init__(self, ttl_seconds: int = 600):
        self._states: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()
        self._ttl = ttl_seconds

    def store_state(self, state: str, code_verifier: Optional[str]) -> None:
        if not state:
            raise ValueError("OAuth state cannot be empty.")
        now = time.time()
        with self._lock:
            # Clean up expired entries to prevent memory leaks
            expired_keys = [s for s, data in self._states.items() if data["expires_at"] < now]
            for s in expired_keys:
                del self._states[s]

            self._states[state] = {
                "code_verifier": code_verifier,
                "expires_at": now + self._ttl,
                "created_at": now
            }

    def consume_state(self, state: Optional[str]) -> Optional[str]:
        if not state:
            raise ValueError("Missing OAuth state parameter.")

        now = time.time()
        with self._lock:
            if state not in self._states:
                raise ValueError("Invalid, expired, or already-used OAuth state.")

            # One-time consumption: atomic pop prevents replay or reuse
            data = self._states.pop(state)
            if data["expires_at"] < now:
                raise ValueError("OAuth state has expired. Please restart authorization.")

            return data.get("code_verifier")

    def clear(self) -> None:
        """Utility for test fixtures and state reset."""
        with self._lock:
            self._states.clear()


oauth_state_manager = OAuthStateManager(ttl_seconds=600)


def build_oauth_flow(state: Optional[str] = None):
    """Create Google OAuth flow using configured credentials."""
    from google_auth_oauthlib.flow import Flow
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise ValueError("Google Client ID and Secret are not configured in settings.")

    client_config = {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.GOOGLE_REDIRECT_URI]
        }
    }
    kwargs: Dict[str, Any] = {
        "client_config": client_config,
        "scopes": [settings.GMAIL_READONLY_SCOPE],
        "redirect_uri": settings.GOOGLE_REDIRECT_URI
    }
    if state:
        kwargs["state"] = state

    flow = Flow.from_client_config(**kwargs)
    return flow


def get_authorization_url(state: Optional[str] = None) -> Tuple[str, str]:
    """Generate authorization consent URL for Gmail read-only access and preserve PKCE verifier."""
    flow = build_oauth_flow(state=state)
    auth_url, generated_state = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state
    )
    # Securely store code_verifier associated with generated state
    oauth_state_manager.store_state(generated_state, flow.code_verifier)
    return auth_url, generated_state


def exchange_code_for_tokens(code: str, state: Optional[str] = None) -> Dict[str, Any]:
    """Exchange authorization code for access and refresh tokens restoring the original PKCE verifier."""
    if not code:
        raise ValueError("Authorization code is required.")

    # 1. Validate state and retrieve original code_verifier (fails if missing, invalid, expired, or reused)
    code_verifier = oauth_state_manager.consume_state(state)

    # 2. Recreate flow with the original state
    flow = build_oauth_flow(state=state)

    # 3. Restore the preserved code_verifier on the flow
    if code_verifier:
        flow.code_verifier = code_verifier

    # 4. Exchange code with Google token endpoint
    flow.fetch_token(code=code, code_verifier=code_verifier)
    credentials = flow.credentials
    return {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": credentials.scopes
    }


def get_gmail_service(creds_data: Dict[str, Any]):
    """Instantiate authenticated Gmail API resource."""
    from google.oauth2.credentials import Credentials
    from googleapiclient.discovery import build

    credentials = Credentials(
        token=creds_data.get("token"),
        refresh_token=creds_data.get("refresh_token"),
        token_uri=creds_data.get("token_uri", "https://oauth2.googleapis.com/token"),
        client_id=creds_data.get("client_id", settings.GOOGLE_CLIENT_ID),
        client_secret=creds_data.get("client_secret", settings.GOOGLE_CLIENT_SECRET),
        scopes=creds_data.get("scopes", [settings.GMAIL_READONLY_SCOPE])
    )
    return build("gmail", "v1", credentials=credentials)


def extract_email_body(payload: Dict[str, Any]) -> str:
    """Recursively extract plain text or sanitized HTML body from Gmail payload."""
    mime_type = payload.get("mimeType", "")
    body_data = payload.get("body", {}).get("data")

    if mime_type == "text/plain" and body_data:
        try:
            return base64.urlsafe_b64decode(body_data).decode("utf-8", errors="ignore")
        except Exception:
            pass

    if mime_type == "text/html" and body_data:
        try:
            html = base64.urlsafe_b64decode(body_data).decode("utf-8", errors="ignore")
            # Strip tags and normalize spacing
            text = re.sub(r"<style[\s\S]*?</style>", " ", html, flags=re.IGNORECASE)
            text = re.sub(r"<script[\s\S]*?</script>", " ", text, flags=re.IGNORECASE)
            text = re.sub(r"<[^>]+>", " ", text)
            text = re.sub(r"&[a-z]+;", " ", text)
            text = re.sub(r"\s+", " ", text).strip()
            return text
        except Exception:
            pass

    parts = payload.get("parts", [])
    for part in parts:
        if part.get("mimeType") == "text/plain":
            body = extract_email_body(part)
            if body:
                return body

    for part in parts:
        body = extract_email_body(part)
        if body:
            return body

    return ""


def extract_headers(headers_list: List[Dict[str, str]]) -> Dict[str, str]:
    """Normalize headers into lowercase dictionary."""
    headers = {}
    for h in headers_list or []:
        name = h.get("name", "").lower()
        headers[name] = h.get("value", "")
    return headers


def sync_gmail(
    db: Session,
    max_messages: int = 50,
    force_full: bool = False,
    query: Optional[str] = None
) -> BatchIngestResponse:
    """
    Perform incremental or initial synchronization of bank & order emails from Gmail.
    """
    connection = db.query(SyncConnectionModel).filter(SyncConnectionModel.provider == "gmail").first()
    if not connection or connection.status != "connected" or not connection.encrypted_credentials:
        raise ValueError("Gmail connection is not active or credentials are missing.")

    creds_dict = decrypt_json(connection.encrypted_credentials)
    service = get_gmail_service(creds_dict)

    # Fetch user profile to get current historyId
    profile = service.users().getProfile(userId='me').execute()
    latest_history_id = str(profile.get("historyId", ""))

    message_ids = set()

    # Determine sync strategy: incremental history vs query search
    search_query = query or DEFAULT_FINANCIAL_QUERY
    if not force_full and connection.sync_cursor:
        try:
            logger.info(f"Attempting incremental sync from historyId {connection.sync_cursor}")
            history_response = service.users().history().list(
                userId='me',
                startHistoryId=connection.sync_cursor,
                historyTypes=['messageAdded'],
                maxResults=max_messages
            ).execute()

            for item in history_response.get("history", []):
                for msg_added in item.get("messagesAdded", []):
                    msg = msg_added.get("message", {})
                    if msg.get("id"):
                        message_ids.add(msg["id"])
        except Exception as e:
            logger.warning(f"Incremental history fetch failed ({str(e)}), falling back to query search.")
            message_ids.clear()

    # Fallback to targeted search query if no history items or first run
    if not message_ids:
        if connection.last_synced_at and not force_full:
            # Append after: date filter for efficiency
            after_timestamp = int(connection.last_synced_at.timestamp())
            search_query += f" after:{after_timestamp}"

        logger.info(f"Querying Gmail messages with query: {search_query}")
        list_response = service.users().messages().list(
            userId='me',
            q=search_query,
            maxResults=max_messages
        ).execute()

        for m in list_response.get("messages", []):
            message_ids.add(m["id"])

    # Batch process retrieved messages
    items_to_ingest: List[BatchIngestItem] = []
    for msg_id in list(message_ids)[:max_messages]:
        try:
            msg = service.users().messages().get(
                userId='me',
                id=msg_id,
                format='full'
            ).execute()

            payload = msg.get("payload", {})
            headers = extract_headers(payload.get("headers", []))
            subject = headers.get("subject", "")
            date_str = headers.get("date", "")
            body = extract_email_body(payload)

            parsed_date = None
            if date_str:
                try:
                    parsed_date = parsedate_to_datetime(date_str)
                except Exception:
                    pass

            full_text = f"Subject: {subject}\n{body}".strip()
            if full_text:
                items_to_ingest.append(BatchIngestItem(
                    text=full_text,
                    source="gmail",
                    external_id=f"gmail_{msg_id}",
                    timestamp=parsed_date
                ))
        except Exception as e:
            logger.error(f"Error fetching Gmail message {msg_id}: {str(e)}")

    batch_response = ingest_batch(db, items_to_ingest)

    # Update connection state
    connection.last_synced_at = datetime.utcnow()
    if latest_history_id:
        connection.sync_cursor = latest_history_id
    connection.error_message = None
    db.commit()

    return batch_response
