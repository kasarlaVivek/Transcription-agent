"""
SQLite database layer for user management.
Zero-dependency — uses Python's built-in sqlite3 module.
"""

import sqlite3
import uuid
from datetime import datetime
from contextlib import contextmanager

from app.config import DB_PATH


def init_db():
    """Create the users table if it does not exist."""
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                name TEXT NOT NULL,
                plan TEXT DEFAULT 'starter',
                stripe_customer_id TEXT,
                meetings_used INTEGER DEFAULT 0,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.commit()


@contextmanager
def get_db():
    """Context manager for database connections."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def create_user(email: str, password_hash: str, name: str) -> dict:
    """Insert a new user and return the user dict."""
    user_id = uuid.uuid4().hex
    with get_db() as conn:
        conn.execute(
            "INSERT INTO users (id, email, password_hash, name) VALUES (?, ?, ?, ?)",
            (user_id, email, password_hash, name),
        )
        conn.commit()
    return get_user_by_id(user_id)


def get_user_by_email(email: str) -> dict | None:
    """Fetch a user by email address."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: str) -> dict | None:
    """Fetch a user by their unique ID."""
    with get_db() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
        return dict(row) if row else None


def update_user_plan(user_id: str, plan: str):
    """Update the user's subscription plan."""
    with get_db() as conn:
        conn.execute("UPDATE users SET plan = ? WHERE id = ?", (plan, user_id))
        conn.commit()


def set_stripe_customer_id(user_id: str, stripe_customer_id: str):
    """Link a Stripe customer ID to a user."""
    with get_db() as conn:
        conn.execute(
            "UPDATE users SET stripe_customer_id = ? WHERE id = ?",
            (stripe_customer_id, user_id),
        )
        conn.commit()


def get_user_by_stripe_customer(stripe_customer_id: str) -> dict | None:
    """Fetch a user by their Stripe customer ID."""
    with get_db() as conn:
        row = conn.execute(
            "SELECT * FROM users WHERE stripe_customer_id = ?",
            (stripe_customer_id,),
        ).fetchone()
        return dict(row) if row else None


def increment_meetings_used(user_id: str):
    """Increment the meetings_used counter for a user."""
    with get_db() as conn:
        conn.execute(
            "UPDATE users SET meetings_used = meetings_used + 1 WHERE id = ?",
            (user_id,),
        )
        conn.commit()
