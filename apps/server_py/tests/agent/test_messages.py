from langchain_core.messages import AIMessage, HumanMessage

from app.agent.messages import find_current_turn_assistant_text, read_message_text


def test_read_message_text_from_string():
    assert read_message_text(HumanMessage(content="hello")) == "hello"


def test_find_current_turn_assistant_text():
    messages = [
        HumanMessage(content="old question"),
        AIMessage(content="old answer"),
        HumanMessage(content="new question"),
        AIMessage(content="new answer"),
    ]
    assert find_current_turn_assistant_text(messages) == "new answer"
