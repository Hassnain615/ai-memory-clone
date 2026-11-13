from __future__ import annotations

import sqlite3

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from config import settings
from database import get_conn, utcnow
from deps import client_ip, enforce_rate_limit, get_current_user
from security import (
    create_access_token,
    hash_password,
    normalize_email,
    validate_password_strength,
    verify_password,
)
from services.container import get_container

router = APIRouter(prefix="/auth", tags=["auth"])


class SignupIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(max_length=320)
    password: str = Field(max_length=128)


class LoginIn(BaseModel):
    email: str = Field(max_length=320)
    password: str = Field(max_length=128)


class ProfileIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)


class PasswordIn(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: str = Field(max_length=128)


class DeleteAccountIn(BaseModel):
    password: str = Field(max_length=128)


def _public_user(u: dict) -> dict:
    return {"id": u["id"], "email": u["email"], "name": u["name"], "created_at": u["created_at"]}


def _token_response(user: dict) -> dict:
    token, expires_in = create_access_token(user["id"], user["token_version"])
    return {"access_token": token, "token_type": "bearer", "expires_in": expires_in, "user": _public_user(user)}


@router.post("/signup", status_code=status.HTTP_201_CREATED)
def signup(data: SignupIn, request: Request):
    enforce_rate_limit(f"auth:{client_ip(request)}", settings.RATE_LIMIT_AUTH)
    email = normalize_email(data.email)
    if not email:
        raise HTTPException(422, "Please enter a valid email address")
    if err := validate_password_strength(data.password):
        raise HTTPException(422, err)
    name = data.name.strip()
    if not name:
        raise HTTPException(422, "Name is required")
    try:
        with get_conn() as conn:
            cur = conn.execute(
                "INSERT INTO users (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)",
                (email, name, hash_password(data.password), utcnow()),
            )
            row = conn.execute("SELECT * FROM users WHERE id = ?", (cur.lastrowid,)).fetchone()
    except sqlite3.IntegrityError:
        raise HTTPException(409, "An account with this email already exists")
    return _token_response(dict(row))


@router.post("/login")
def login(data: LoginIn, request: Request):
    enforce_rate_limit(f"auth:{client_ip(request)}", settings.RATE_LIMIT_AUTH)
    email = normalize_email(data.email) or ""
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    # Same error for unknown email / wrong password (no account enumeration)
    if not row or not verify_password(data.password, row["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    return _token_response(dict(row))


@router.get("/me")
def me(user: dict = Depends(get_current_user)):
    return _public_user(user)


@router.patch("/me")
def update_profile(data: ProfileIn, user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        conn.execute("UPDATE users SET name = ? WHERE id = ?", (data.name.strip(), user["id"]))
    return {**_public_user(user), "name": data.name.strip()}


@router.post("/change-password")
def change_password(data: PasswordIn, user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
        if not verify_password(data.current_password, row["password_hash"]):
            raise HTTPException(400, "Current password is incorrect")
        if err := validate_password_strength(data.new_password):
            raise HTTPException(422, err)
        # bump token_version → every existing session is signed out
        conn.execute(
            "UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?",
            (hash_password(data.new_password), user["id"]),
        )
        row = conn.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    return _token_response(dict(row))


@router.post("/logout-all")
def logout_all(user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        conn.execute("UPDATE users SET token_version = token_version + 1 WHERE id = ?", (user["id"],))
    return {"success": True}


@router.delete("/me")
def delete_account(data: DeleteAccountIn, user: dict = Depends(get_current_user)):
    with get_conn() as conn:
        row = conn.execute("SELECT password_hash FROM users WHERE id = ?", (user["id"],)).fetchone()
        if not verify_password(data.password, row["password_hash"]):
            raise HTTPException(400, "Password is incorrect")
    get_container().rag.clear_user(user["id"])
    with get_conn() as conn:
        conn.execute("DELETE FROM users WHERE id = ?", (user["id"],))  # cascades to all data
    return {"success": True}
