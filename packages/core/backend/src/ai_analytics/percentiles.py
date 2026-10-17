"""R3.3 — `PERCENTILE_CONT` trên Postgres, tính **trong DB**.

Vì sao không dùng "window function" như plan viết (`:1093`)?

1. Django ORM **không có** `PercentileCont` — đo thật trên container staging:
   `django.db.models.functions` chỉ có `PercentileRank`/`Ntile`
   (Django 5.2.18). Không có ở `django.db.models.aggregates` cũng.
2. Postgres cũng **không cho** percentile dạng window: `PERCENTILE_CONT` là
   ordered-set aggregate (`WITHIN GROUP (ORDER BY …)`) và **không** nhận `OVER`.

Nên construct đúng là ordered-set aggregate. AC1 của plan là *"tính **trên DB**,
không kéo hết về Python"* — đạt đúng điều đó; chữ "window function" trong plan là
cách nói không hiện thực được với percentile trên Postgres. Có test chốt chặn
(AC1b) đòi SQL chứa `percentile_cont` để không ai đổi lại sang tự tính trong Python.
"""
from django.db.models import Aggregate, FloatField


class PercentileCont(Aggregate):
    """`PERCENTILE_CONT(p) WITHIN GROUP (ORDER BY <expr>)` — chỉ Postgres.

    Giá trị percentile đi qua **query parameter**, không nội suy vào SQL.
    """

    output_field = FloatField()

    def __init__(self, percentile=0.5, expression=('latency_ms',), **extra):
        super().__init__(*expression, **extra)
        self.percentile = percentile

    def as_sql(self, compiler, connection, **extra_context):
        expr, = self.source_expressions
        inner_sql, inner_params = compiler.compile(expr)
        # `%%s` để lại một placeholder cho tham số percentile; `%s` bên kia nhận
        # SQL của biểu thức. Nội suy ngược (`%(...)s`) sẽ nuốt mất placeholder.
        sql = 'PERCENTILE_CONT(%%s) WITHIN GROUP (ORDER BY %s)' % inner_sql
        return sql, [self.percentile, *inner_params]

    def __repr__(self):
        return '%s(%s)' % (type(self).__name__, self.percentile)