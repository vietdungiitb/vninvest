"""BL-15: stdlib-only structured JSON logging (no new dependency).

- `request_id_var`: ContextVar populated by RequestTraceMiddleware; the
  JsonFormatter attaches it so logs correlate with audit events + responses.
- `JsonFormatter`: emits one JSON object per line:
  {ts, level, logger, msg, module, request_id?, exc?}.
- Format selected in settings via LOG_FORMAT=json|text (prod default json).
"""
import contextvars
import json
import logging
from datetime import datetime, timezone

request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar('request_id', default='')


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            'ts': datetime.fromtimestamp(record.created, tz=timezone.utc).isoformat(),
            'level': record.levelname,
            'logger': record.name,
            'module': record.module,
            'msg': record.getMessage(),
        }
        request_id = request_id_var.get()
        if request_id:
            payload['request_id'] = request_id
        if record.exc_info and record.exc_info[0] is not None:
            payload['exc'] = self.formatException(record.exc_info)
        return json.dumps(payload, ensure_ascii=False)
