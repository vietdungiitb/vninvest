"""
Local SSE primitives for signal_intelligence (S7).

Mirrors the proven pattern in service_ops/views/base.py
(EventStreamRenderer + SSEStreamingHttpResponse) WITHOUT importing
service_ops — the dependency direction is service_ops → signal_intelligence,
so a reverse import would violate app layering and risk cycles.

- EventStreamRenderer: pass-through renderer so DRF content negotiation
  accepts `Accept: text/event-stream` from real browsers (RC1 lesson).
- AlertCenterStreamingHttpResponse: incremental flush under ASGI
  (Django's default StreamingHttpResponse.__aiter__ lists the whole
  generator first, which hangs forever on infinite SSE streams).
- sse_format: wire-format helper (retry / comment / event / id / data).
"""
import json

from asgiref.sync import sync_to_async
from django.http import StreamingHttpResponse
from rest_framework.renderers import BaseRenderer


def sse_format(*, event=None, data=None, sse_id=None, retry=None, comment=None) -> str:
    lines: list[str] = []
    if comment is not None:
        lines.append(f': {comment}')
    if retry is not None:
        lines.append(f'retry: {retry}')
    if sse_id is not None:
        lines.append(f'id: {sse_id}')
    if event is not None:
        lines.append(f'event: {event}')
    if data is not None:
        if not isinstance(data, str):
            data = json.dumps(data, ensure_ascii=False, default=str)
        for line in data.splitlines() or ['']:
            lines.append(f'data: {line}')
    lines.append('')
    return '\n'.join(lines) + '\n'


class AlertCenterStreamEventRenderer(BaseRenderer):
    media_type = 'text/event-stream'
    format = 'event-stream'
    charset = 'utf-8'

    def render(self, data, accepted_media_type=None, renderer_context=None):
        if data is None:
            return b''
        if isinstance(data, bytes):
            return data
        if isinstance(data, str):
            return data.encode(self.charset)
        return json.dumps(data, ensure_ascii=False, default=str).encode(self.charset)


class AlertCenterStreamingHttpResponse(StreamingHttpResponse):
    async def __aiter__(self):
        it = iter(self.streaming_content)
        try:
            while True:
                try:
                    part = await sync_to_async(next, thread_sensitive=False)(it)
                except StopIteration:
                    return
                if isinstance(part, str):
                    part = part.encode(self.charset)
                yield part
        finally:
            close = getattr(it, 'close', None)
            if callable(close):
                close()
