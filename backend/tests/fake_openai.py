"""A stand-in for openai.OpenAI that returns scripted replies and records calls."""

from types import SimpleNamespace


class FakeOpenAI:
    def __init__(self, *replies: object):
        # A reply is a str (JSON content), a dict (a full message with tool calls) or an exception.
        self.replies = list(replies)
        self.calls: list[dict] = []
        self.chat = SimpleNamespace(completions=SimpleNamespace(create=self.create))

    def create(self, **kwargs):
        self.calls.append(kwargs)
        reply = self.replies.pop(0)
        if isinstance(reply, Exception):
            raise reply
        if isinstance(reply, str):
            message = SimpleNamespace(content=reply, tool_calls=None)
        else:
            message = SimpleNamespace(
                content=reply.get("content"), tool_calls=reply.get("tool_calls")
            )
        # Every scripted reply costs 1,000 input and 100 output tokens.
        usage = SimpleNamespace(prompt_tokens=1000, completion_tokens=100)
        return SimpleNamespace(choices=[SimpleNamespace(message=message)], usage=usage)


def tool_call(call_id: str, name: str, arguments: str) -> SimpleNamespace:
    return SimpleNamespace(
        id=call_id, type="function", function=SimpleNamespace(name=name, arguments=arguments)
    )
