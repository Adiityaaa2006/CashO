from sqlalchemy import inspect, text
from app.db.database import engine, Base
import logging

logger = logging.getLogger(__name__)

def run_migrations():
    """
    Ensures that existing databases are upgraded with new tables and columns
    without data loss.
    """
    from app.db import models  # ensure all models are registered with Base
    Base.metadata.create_all(bind=engine)

    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    if "transactions" in existing_tables:
        columns = [c["name"] for c in inspector.get_columns("transactions")]
        with engine.connect() as conn:
            if "source" not in columns:
                logger.info("Migrating transactions table: adding source column")
                conn.execute(text("ALTER TABLE transactions ADD COLUMN source VARCHAR DEFAULT 'manual'"))
            if "external_id" not in columns:
                logger.info("Migrating transactions table: adding external_id column")
                conn.execute(text("ALTER TABLE transactions ADD COLUMN external_id VARCHAR"))
            if "review_status" not in columns:
                logger.info("Migrating transactions table: adding review_status column")
                conn.execute(text("ALTER TABLE transactions ADD COLUMN review_status VARCHAR DEFAULT 'approved'"))
            conn.commit()

    if "review_queue" in existing_tables:
        columns_rq = [c["name"] for c in inspector.get_columns("review_queue")]
        with engine.connect() as conn:
            if "suggested_transaction_type" not in columns_rq:
                logger.info("Migrating review_queue table: adding suggested_transaction_type column")
                conn.execute(text("ALTER TABLE review_queue ADD COLUMN suggested_transaction_type VARCHAR DEFAULT 'UNKNOWN'"))
            conn.commit()
