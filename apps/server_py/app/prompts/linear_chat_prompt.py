from __future__ import annotations

from typing import List, Optional, Union

from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder

from app.domain.session_store import Message
from app.prompts.default_system_prompt import DEFAULT_SYSTEM_PROMPT

linear_chat_prompt = ChatPromptTemplate.from_messages(
    [
        SystemMessage(content=DEFAULT_SYSTEM_PROMPT),
        MessagesPlaceholder("memory", optional=True),
        MessagesPlaceholder("history"),
        ("human", "{prompt}"),
    ]
)


def build_linear_chat_history(messages: List[Message]) -> List[Union[HumanMessage, AIMessage]]:
    result: List[Union[HumanMessage, AIMessage]] = []
    for message in messages:
        if message.role == "user":
            result.append(HumanMessage(content=message.content))
        else:
            result.append(AIMessage(content=message.content))
    return result


def format_linear_chat_messages(
    *,
    prompt: str,
    history: List[Message],
    memory_summary: Optional[str] = None,
) -> List[BaseMessage]:
    memory: List[SystemMessage] = []
    if memory_summary and memory_summary.strip():
        memory = [
            SystemMessage(
                content=f"Conversation memory summary:\n{memory_summary.strip()}"
            )
        ]

    return linear_chat_prompt.format_messages(
        memory=memory,
        history=build_linear_chat_history(history),
        prompt=prompt,
    )
