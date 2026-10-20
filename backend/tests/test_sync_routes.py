import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.database import Base, get_db
from app.db.models import SyncConnectionModel, ReviewQueueModel, TransactionModel
from app.config import settings

@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()

@pytest.fixture
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()

def test_sync_status_endpoint(client, db_session):
    response = client.get("/api/sync/status")
    assert response.status_code == 200
    data = response.json()
    assert "gmail" in data
    assert "android" in data
    assert data["gmail"]["status"] == "disconnected"
    assert data["review_queue_pending_count"] == 0

def test_android_ingest_unauthorized(client):
    payload = {
        "items": [
            {"text": "Paid Rs 100 at Chai Point on 10-04-2024", "source": "android"}
        ]
    }
    response = client.post("/api/sync/android/ingest", json=payload)
    assert response.status_code == 401

def test_android_ingest_authorized(client, db_session):
    payload = {
        "items": [
            {"text": "Paid Rs 150 at Chai Point on 10-04-2024", "source": "android", "external_id": "sms_test_1"}
        ]
    }
    headers = {"Authorization": f"Bearer {settings.ANDROID_API_KEY}"}
    response = client.post("/api/sync/android/ingest", json=payload, headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["inserted"] == 1
    assert data["total_received"] == 1

    # Check connection updated
    conn = db_session.query(SyncConnectionModel).filter(SyncConnectionModel.provider == "android").first()
    assert conn is not None
    assert conn.status == "connected"
    assert conn.last_synced_at is not None

def test_review_queue_listing_and_resolution(client, db_session):
    # Insert an item needing review
    rev = ReviewQueueModel(
        source="android",
        raw_text="Payment of undefined amount to Store",
        reason="missing_amount",
        status="pending"
    )
    db_session.add(rev)
    db_session.commit()
    db_session.refresh(rev)

    # 1. Fetch pending
    res = client.get("/api/review?status_filter=pending")
    assert res.status_code == 200
    items = res.json()
    assert len(items) == 1
    assert items[0]["id"] == rev.id

    # 2. Resolve with user approval
    resolve_payload = {
        "action": "approve",
        "amount": 299.0,
        "merchant": "BookStore",
        "category": "Education"
    }
    res_resolve = client.post(f"/api/review/{rev.id}/resolve", json=resolve_payload)
    assert res_resolve.status_code == 200
    assert res_resolve.json()["status"] == "approved"

    # Verify transaction added to DB
    tx = db_session.query(TransactionModel).filter(TransactionModel.amount == 299.0).first()
    assert tx is not None
    assert tx.merchant_normalized == "BookStore"
    assert tx.category == "Education"

def test_gmail_callback_and_disconnect(client, db_session):
    mock_tokens = {
        "token": "mock_access_token",
        "refresh_token": "mock_refresh_token",
        "token_uri": "https://oauth2.googleapis.com/token",
        "client_id": "test_client_id",
        "client_secret": "test_client_secret",
        "scopes": [settings.GMAIL_READONLY_SCOPE]
    }

    with patch("app.api.sync_routes.exchange_code_for_tokens", return_value=mock_tokens):
        res = client.get("/api/sync/gmail/callback?code=mock_oauth_code&state=mock_state_param")
        assert res.status_code == 200
        assert res.json()["status"] == "success"

        conn = db_session.query(SyncConnectionModel).filter(SyncConnectionModel.provider == "gmail").first()
        assert conn is not None
        assert conn.status == "connected"
        assert conn.encrypted_credentials is not None
        assert "mock_access_token" not in conn.encrypted_credentials  # Encrypted!

    # Now disconnect
    res_disc = client.post("/api/sync/gmail/disconnect")
    assert res_disc.status_code == 200
    assert res_disc.json()["status"] == "success"

    db_session.refresh(conn)
    assert conn.status == "disconnected"
    assert conn.encrypted_credentials is None


def test_oauth_callback_missing_state_rejected(client):
    res = client.get("/api/sync/gmail/callback?code=test_code_only")
    assert res.status_code == 400
    assert "Missing OAuth state parameter" in res.json()["detail"]


def test_oauth_callback_unknown_state_rejected(client):
    res = client.get("/api/sync/gmail/callback?code=test_code&state=unknown_random_state_999")
    assert res.status_code == 400
    assert "Invalid, expired, or already-used OAuth state" in res.json()["detail"]


def test_oauth_callback_expired_state_rejected(client):
    from app.services.gmail_sync import oauth_state_manager
    import time

    # Manually store an expired state
    oauth_state_manager.store_state("expired_state_token", "test_verifier")
    oauth_state_manager._states["expired_state_token"]["expires_at"] = time.time() - 10

    res = client.get("/api/sync/gmail/callback?code=test_code&state=expired_state_token")
    assert res.status_code == 400
    assert "OAuth state has expired" in res.json()["detail"]


def test_oauth_callback_reused_state_rejected(client, db_session):
    from app.services.gmail_sync import oauth_state_manager

    oauth_state_manager.store_state("single_use_state", "test_verifier_123")
    mock_tokens = {
        "token": "tok1",
        "refresh_token": "refr1",
        "token_uri": "https://oauth2.googleapis.com/token",
        "client_id": "cid",
        "client_secret": "csec",
        "scopes": [settings.GMAIL_READONLY_SCOPE]
    }

    # 1. First consumption succeeds
    with patch("app.services.gmail_sync.build_oauth_flow") as mock_build:
        mock_flow = MagicMock()
        mock_flow.credentials = MagicMock(
            token="tok1",
            refresh_token="refr1",
            token_uri="https://oauth2.googleapis.com/token",
            client_id="cid",
            client_secret="csec",
            scopes=[settings.GMAIL_READONLY_SCOPE]
        )
        mock_build.return_value = mock_flow

        res1 = client.get("/api/sync/gmail/callback?code=auth_code_1&state=single_use_state")
        assert res1.status_code == 200
        # Verify verifier was restored on flow
        assert mock_flow.code_verifier == "test_verifier_123"

    # 2. Second consumption with exact same state fails (replay attack protection)
    res2 = client.get("/api/sync/gmail/callback?code=auth_code_replay&state=single_use_state")
    assert res2.status_code == 400
    assert "Invalid, expired, or already-used OAuth state" in res2.json()["detail"]


def test_concurrent_oauth_states_isolated():
    from app.services.gmail_sync import oauth_state_manager

    oauth_state_manager.clear()
    oauth_state_manager.store_state("state_user_a", "verifier_user_a")
    oauth_state_manager.store_state("state_user_b", "verifier_user_b")

    # Both exist independently
    assert "state_user_a" in oauth_state_manager._states
    assert "state_user_b" in oauth_state_manager._states

    # Consuming user B does not affect user A
    verifier_b = oauth_state_manager.consume_state("state_user_b")
    assert verifier_b == "verifier_user_b"
    assert "state_user_b" not in oauth_state_manager._states
    assert "state_user_a" in oauth_state_manager._states

    # User A consumes successfully
    verifier_a = oauth_state_manager.consume_state("state_user_a")
    assert verifier_a == "verifier_user_a"
    assert "state_user_a" not in oauth_state_manager._states


def test_pkce_authorization_url_generation_and_storage():
    from app.services.gmail_sync import get_authorization_url, oauth_state_manager

    with patch.object(settings, "GOOGLE_CLIENT_ID", "mock_id.apps.googleusercontent.com"), \
         patch.object(settings, "GOOGLE_CLIENT_SECRET", "mock_secret"):
        auth_url, state = get_authorization_url()

        assert "accounts.google.com" in auth_url
        assert "code_challenge=" in auth_url
        assert "code_challenge_method=S256" in auth_url
        assert state in oauth_state_manager._states
        assert oauth_state_manager._states[state]["code_verifier"] is not None
        assert len(oauth_state_manager._states[state]["code_verifier"]) > 40