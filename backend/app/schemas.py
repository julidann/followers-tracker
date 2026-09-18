from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class SnapshotCreate(BaseModel):
    account_username: str = Field(min_length=1, max_length=255)
    followers: list[str] = Field(default_factory=list)
    following: list[str] = Field(default_factory=list)

    @field_validator("account_username")
    @classmethod
    def normalize_account(cls, value: str) -> str:
        return value.strip().lstrip("@").lower()

    @field_validator("followers", "following")
    @classmethod
    def normalize_users(cls, values: list[str]) -> list[str]:
        normalized = {
            value.strip().lstrip("@").lower()
            for value in values
            if value and value.strip().lstrip("@")
        }
        return sorted(normalized)


class SnapshotResponse(BaseModel):
    id: int
    account_username: str
    followers_count: int
    following_count: int
    captured_at: datetime


class DashboardResponse(BaseModel):
    has_data: bool
    account_username: str | None = None
    captured_at: datetime | None = None
    followers: int = 0
    following: int = 0
    new_followers: int = 0
    unfollowers: int = 0
    not_following_back: int = 0
    i_dont_follow_back: int = 0
    mutuals: int = 0
    ghost_followers: int = 0
    active_followers: int = 0
    lost_interest: int = 0


class RelationshipListResponse(BaseModel):
    kind: str
    count: int
    usernames: list[str]
