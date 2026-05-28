from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field

PlaygroundHistorySurface = Literal["default", "published"]


class AttachmentMeta(BaseModel):
    id: str
    type: Literal["image"] = "image"
    fileName: str
    mimeType: str
    size: int
    filePath: Optional[str] = None
    storagePath: Optional[str] = None
    createdAt: int


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    timestamp: Optional[int] = None
    attachments: Optional[List[AttachmentMeta]] = None


class Session(BaseModel):
    version: int = 0
    lastId: int = 0
    messages: List[Message] = Field(default_factory=list)
    memorySummary: str = ""
    memorySummaryUpdatedAt: Optional[int] = None
    summaryArchiveMessageCount: int = 0


class SessionAppendMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    attachments: Optional[List[AttachmentMeta]] = None


class RecentDialogueItem(BaseModel):
    id: str
    sessionId: str
    updatedAt: float
    userContent: str
    playgroundSurface: PlaygroundHistorySurface
    basePlaygroundSessionId: str
    publishedChatbotWorkflowAppId: Optional[str] = None
