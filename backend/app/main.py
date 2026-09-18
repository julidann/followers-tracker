from contextlib import asynccontextmanager
import os
import secrets
from urllib.parse import urlencode

import httpx

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.responses import RedirectResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models
from .database import Base, engine, get_db
from .schemas import (
    DashboardResponse,
    RelationshipListResponse,
    SnapshotCreate,
    SnapshotResponse,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="Followers Tracker API",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

INSTAGRAM_CLIENT_ID = os.getenv("INSTAGRAM_CLIENT_ID", "")
INSTAGRAM_CLIENT_SECRET = os.getenv("INSTAGRAM_CLIENT_SECRET", "")
INSTAGRAM_REDIRECT_URI = os.getenv(
    "INSTAGRAM_REDIRECT_URI",
    "http://localhost:8000/api/auth/instagram/callback",
)
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:4200")

_oauth_states: set[str] = set()
_instagram_session: dict[str, str | int | None] = {
    "access_token": None,
    "user_id": None,
    "username": None,
    "account_type": None,
    "followers_count": None,
    "follows_count": None,
}


def get_account(db: Session, username: str | None = None) -> models.InstagramAccount | None:
    if username:
        normalized = username.strip().lstrip("@").lower()
        return db.scalar(
            select(models.InstagramAccount).where(
                models.InstagramAccount.username == normalized
            )
        )
    return db.scalar(
        select(models.InstagramAccount)
        .order_by(models.InstagramAccount.id.desc())
        .limit(1)
    )


def latest_snapshots(
    db: Session,
    account_id: int,
    limit: int = 2,
) -> list[models.Snapshot]:
    return list(
        db.scalars(
            select(models.Snapshot)
            .where(models.Snapshot.account_id == account_id)
            .order_by(models.Snapshot.captured_at.desc(), models.Snapshot.id.desc())
            .limit(limit)
        )
    )


def relationship_sets(
    db: Session,
    snapshot_id: int,
) -> tuple[set[str], set[str]]:
    rows = db.scalars(
        select(models.Relationship).where(
            models.Relationship.snapshot_id == snapshot_id
        )
    )
    followers: set[str] = set()
    following: set[str] = set()

    for row in rows:
        if row.follows_me:
            followers.add(row.username)
        if row.i_follow:
            following.add(row.username)

    return followers, following



@app.get("/api/auth/instagram/url")
def instagram_auth_url():
    if not INSTAGRAM_CLIENT_ID or not INSTAGRAM_CLIENT_SECRET:
        raise HTTPException(
            status_code=503,
            detail="Faltan INSTAGRAM_CLIENT_ID o INSTAGRAM_CLIENT_SECRET en .env.",
        )

    state = secrets.token_urlsafe(24)
    _oauth_states.add(state)

    params = urlencode(
        {
            "client_id": INSTAGRAM_CLIENT_ID,
            "redirect_uri": INSTAGRAM_REDIRECT_URI,
            "response_type": "code",
            "scope": "instagram_business_basic",
            "state": state,
            "force_reauth": "true",
        }
    )

    return {
        "url": f"https://www.instagram.com/oauth/authorize?{params}",
    }


@app.get("/api/auth/instagram/callback")
def instagram_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
):
    if error:
        message = error_description or error
        return RedirectResponse(
            f"{FRONTEND_URL}/?instagram=error&message={message}"
        )

    if not code or not state or state not in _oauth_states:
        return RedirectResponse(
            f"{FRONTEND_URL}/?instagram=error&message=oauth_state"
        )

    _oauth_states.discard(state)

    try:
        with httpx.Client(timeout=20.0) as client:
            token_response = client.post(
                "https://api.instagram.com/oauth/access_token",
                data={
                    "client_id": INSTAGRAM_CLIENT_ID,
                    "client_secret": INSTAGRAM_CLIENT_SECRET,
                    "grant_type": "authorization_code",
                    "redirect_uri": INSTAGRAM_REDIRECT_URI,
                    "code": code,
                },
            )
            token_response.raise_for_status()
            token_data = token_response.json()

            short_token = token_data["access_token"]

            long_token_response = client.get(
                "https://graph.instagram.com/access_token",
                params={
                    "grant_type": "ig_exchange_token",
                    "client_secret": INSTAGRAM_CLIENT_SECRET,
                    "access_token": short_token,
                },
            )
            long_token_response.raise_for_status()
            long_token = long_token_response.json().get(
                "access_token",
                short_token,
            )

            profile_response = client.get(
                "https://graph.instagram.com/me",
                params={
                    "fields": (
                        "id,username,account_type,"
                        "followers_count,follows_count"
                    ),
                    "access_token": long_token,
                },
            )
            profile_response.raise_for_status()
            profile = profile_response.json()

        _instagram_session.update(
            {
                "access_token": long_token,
                "user_id": profile.get("id"),
                "username": profile.get("username"),
                "account_type": profile.get("account_type"),
                "followers_count": profile.get("followers_count"),
                "follows_count": profile.get("follows_count"),
            }
        )

        return RedirectResponse(f"{FRONTEND_URL}/?instagram=connected")

    except (httpx.HTTPError, KeyError, ValueError):
        return RedirectResponse(
            f"{FRONTEND_URL}/?instagram=error&message=token_exchange"
        )


@app.get("/api/auth/instagram/status")
def instagram_status():
    connected = bool(_instagram_session.get("access_token"))

    return {
        "connected": connected,
        "user_id": _instagram_session.get("user_id") if connected else None,
        "username": _instagram_session.get("username") if connected else None,
        "account_type": (
            _instagram_session.get("account_type") if connected else None
        ),
        "followers_count": (
            _instagram_session.get("followers_count") if connected else None
        ),
        "follows_count": (
            _instagram_session.get("follows_count") if connected else None
        ),
    }


@app.post("/api/auth/instagram/logout")
def instagram_logout():
    _instagram_session.update(
        {
            "access_token": None,
            "user_id": None,
            "username": None,
            "account_type": None,
            "followers_count": None,
            "follows_count": None,
        }
    )
    return {"ok": True}

@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/snapshots", response_model=SnapshotResponse)
def create_snapshot(payload: SnapshotCreate, db: Session = Depends(get_db)):
    account = db.scalar(
        select(models.InstagramAccount).where(
            models.InstagramAccount.username == payload.account_username
        )
    )

    if account is None:
        account = models.InstagramAccount(username=payload.account_username)
        db.add(account)
        db.flush()

    followers = set(payload.followers)
    following = set(payload.following)

    snapshot = models.Snapshot(
        account_id=account.id,
        followers_count=len(followers),
        following_count=len(following),
    )
    db.add(snapshot)
    db.flush()

    for username in sorted(followers | following):
        db.add(
            models.Relationship(
                snapshot_id=snapshot.id,
                username=username,
                follows_me=username in followers,
                i_follow=username in following,
            )
        )

    db.commit()
    db.refresh(snapshot)

    return SnapshotResponse(
        id=snapshot.id,
        account_username=account.username,
        followers_count=snapshot.followers_count,
        following_count=snapshot.following_count,
        captured_at=snapshot.captured_at,
    )


@app.get("/api/dashboard", response_model=DashboardResponse)
def dashboard(
    account: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    account_row = get_account(db, account)
    if account_row is None:
        return DashboardResponse(has_data=False)

    snapshots = latest_snapshots(db, account_row.id, limit=2)
    if not snapshots:
        return DashboardResponse(
            has_data=False,
            account_username=account_row.username,
        )

    latest = snapshots[0]
    current_followers, current_following = relationship_sets(db, latest.id)

    previous_followers: set[str] = set()
    if len(snapshots) > 1:
        previous_followers, _ = relationship_sets(db, snapshots[1].id)

    new_followers = current_followers - previous_followers if len(snapshots) > 1 else set()
    unfollowers = previous_followers - current_followers if len(snapshots) > 1 else set()

    return DashboardResponse(
        has_data=True,
        account_username=account_row.username,
        captured_at=latest.captured_at,
        followers=len(current_followers),
        following=len(current_following),
        new_followers=len(new_followers),
        unfollowers=len(unfollowers),
        not_following_back=len(current_following - current_followers),
        i_dont_follow_back=len(current_followers - current_following),
        mutuals=len(current_followers & current_following),
        ghost_followers=0,
        active_followers=0,
        lost_interest=0,
    )


@app.get(
    "/api/relationships/{kind}",
    response_model=RelationshipListResponse,
)
def relationships(
    kind: str,
    account: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    account_row = get_account(db, account)
    if account_row is None:
        raise HTTPException(status_code=404, detail="No hay una cuenta cargada.")

    snapshots = latest_snapshots(db, account_row.id, limit=2)
    if not snapshots:
        raise HTTPException(status_code=404, detail="No hay snapshots cargados.")

    current_followers, current_following = relationship_sets(db, snapshots[0].id)
    previous_followers: set[str] = set()
    if len(snapshots) > 1:
        previous_followers, _ = relationship_sets(db, snapshots[1].id)

    collections = {
        "followers": current_followers,
        "following": current_following,
        "not-following-back": current_following - current_followers,
        "i-dont-follow-back": current_followers - current_following,
        "mutuals": current_followers & current_following,
        "new-followers": current_followers - previous_followers if len(snapshots) > 1 else set(),
        "unfollowers": previous_followers - current_followers if len(snapshots) > 1 else set(),
    }

    if kind not in collections:
        raise HTTPException(status_code=400, detail="Tipo de relación no soportado.")

    usernames = sorted(collections[kind])
    return RelationshipListResponse(
        kind=kind,
        count=len(usernames),
        usernames=usernames,
    )
