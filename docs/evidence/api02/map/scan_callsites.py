#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
api02-m1 -- AST call-site mapper for every 2xx response in the Django backend.

WHY AST AND NOT GREP
--------------------
`grep "Response("` matches docstrings, comments, type annotations
(`-> Response:`), and `class Foo(Response)` definitions.  survey-a measured
969 grep hits vs 799 real DRF/Django Response call sites.  Every number in
m1.md comes from `ast.parse`, never from text matching.

SCOPE (exactly as briefed)
--------------------------
    packages/core/backend/src/**.py
    minus  migrations/  tests/  test_*.py  *_test.py  __pycache__/
(`--scope surveya` additionally drops commands/ management/ conftest.py so the
result can be compared like-for-like against survey-a.)

OUTPUT
------
    callsites.csv   one row per response call site
    callsites.json  same rows, machine readable
    routes.csv      urlpatterns resolved to view symbols
    summary.json    family counts + totals

REPRODUCE
---------
    python docs/evidence/api02/map/scan_callsites.py
    python docs/evidence/api02/map/scan_callsites.py --scope surveya
"""

from __future__ import annotations

import argparse
import ast
import csv
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

# --------------------------------------------------------------------------
# paths
# --------------------------------------------------------------------------
REPO = Path(__file__).resolve().parents[4]
SRC = REPO / "packages" / "core" / "backend" / "src"
OUTDIR = REPO / "docs" / "evidence" / "api02" / "map"

# extra array-key names accepted as F6 markers.  Empty set = strict reading
# ("results/rows/items/entries/records/content" only).  With the default value
# below the script reproduces survey-a's F6 = 91 exactly; see m1.md section 2.
F6_EXTRA_DEFAULT = "services,stats,keys,sessions"

SKIP_ALWAYS = {"__pycache__", "migrations", "tests"}
SKIP_SURVEYA = {"commands", "management"}

# --------------------------------------------------------------------------
# vocabulary
# --------------------------------------------------------------------------
# callee names that directly produce an HTTP response object
RESPONSE_CALLEES = {"Response", "JsonResponse"}
# callee names that produce a paginated response without wrapping in Response()
PAGINATOR_CALLEES = {"get_paginated_response"}
# DRF/Django base classes whose methods are request handlers, not factories
VIEW_BASE_RE = re.compile(r"(View|ViewSet|APIView|ViewSetMixin|GenericAPIView)$")
HTTP_METHOD_NAMES = {
    "get", "post", "put", "patch", "delete", "head", "options", "trace",
}
VIEWSET_ACTIONS = {
    "list", "retrieve", "create", "update", "partial_update", "destroy",
    "get_queryset", "get_serializer", "get_serializer_class", "paginate_queryset",
    "paginate_response",
}
VIEW_DECORATORS = {
    "api_view", "action", "detail_route", "list_route", "extend_schema",
    "extend_schema_view", "api_exception_handler", "permission_classes",
}
# helper names that build a serializer-shaped dict (survey-a called these F8)
SERIALIZER_DICT_HELPERS = re.compile(
    r"(to_response_dict|_response_dict$|response_dict$|^_serialize_dict$|^serialize_)"
)

HTTP_2XX_ATTRS = {
    "HTTP_200_OK", "HTTP_201_CREATED", "HTTP_202_ACCEPTED",
    "HTTP_203_NON_AUTHORITATIVE_INFORMATION", "HTTP_204_NO_CONTENT",
    "HTTP_205_RESET_CONTENT", "HTTP_206_PARTIAL_CONTENT",
    "HTTP_207_MULTI_STATUS", "HTTP_208_ALREADY_REPORTED",
    "HTTP_226_IM_USED",
}
HTTP_4XX_5XX_ATTRS = {
    "HTTP_400_BAD_REQUEST", "HTTP_401_UNAUTHORIZED", "HTTP_402_PAYMENT_REQUIRED",
    "HTTP_403_FORBIDDEN", "HTTP_404_NOT_FOUND", "HTTP_405_METHOD_NOT_ALLOWED",
    "HTTP_406_NOT_ACCEPTABLE", "HTTP_408_REQUEST_TIMEOUT", "HTTP_409_CONFLICT",
    "HTTP_410_GONE", "HTTP_412_PRECONDITION_FAILED", "HTTP_413_REQUEST_ENTITY_TOO_LARGE",
    "HTTP_415_UNSUPPORTED_MEDIA_TYPE", "HTTP_418_IM_A_TEAPOT",
    "HTTP_422_UNPROCESSABLE_ENTITY", "HTTP_423_LOCKED", "HTTP_424_FAILED_DEPENDENCY",
    "HTTP_428_PRECONDITION_REQUIRED", "HTTP_429_TOO_MANY_REQUESTS",
    "HTTP_431_REQUEST_HEADER_FIELDS_TOO_LARGE",
    "HTTP_451_UNAVAILABLE_FOR_LEGAL_REASONS",
    "HTTP_500_INTERNAL_SERVER_ERROR", "HTTP_501_NOT_IMPLEMENTED",
    "HTTP_502_BAD_GATEWAY", "HTTP_503_SERVICE_UNAVAILABLE",
    "HTTP_504_GATEWAY_TIMEOUT", "HTTP_505_HTTP_VERSION_NOT_SUPPORTED",
}

# pagination vocabulary.  PRIMARY markers are collection names; SECONDARY
# markers are pagination controls and only count when >= 2 appear together.
PAG_PRIMARY = {"results", "rows", "items", "entries", "records", "content"}
PAG_SECONDARY = {
    "next", "previous", "count", "total", "total_pages", "page", "page_size",
    "limit", "offset", "cursor", "next_cursor", "previous_cursor",
    "has_more", "has_next", "has_previous", "next_page", "prev_page",
    "total_count", "page_count", "next_before", "next_after",
    "has_more_before", "has_more_after",
}
# ack vocabulary: no business payload
ACK_KEYS = {
    "ok", "message", "msg", "detail", "error", "note", "success",
    "status", "code", "task_id", "acknowledged", "result",
}

# callables whose Python return type fixes the JSON shape, so no lookup needed
BUILTIN_LIST_RETURNS = {
    "sorted", "list", "filter", "map", "reversed", "frozenset", "tuple",
    "all", "values", "values_list", "distinct", "order_by", "annotate",
    "select_related", "prefetch_related", "defer", "only", "exclude",
    "recent", "latest", "earliest", "first", "last", "get_or_create",
    "bulk_create", "in_bulk",
}
BUILTIN_DICT_RETURNS = {"dict", "OrderedDict", "defaultdict", "Counter"}

# Optional extra array-key names accepted as F6 markers, so survey-a's looser
# "LIST-ISH" reading can be reproduced and the delta measured instead of
# guessed.  See m1.md section 2.
F6_EXTRA = set()

# repo-wide index of every function/class, used to resolve a call in another
# module back to its `return` expression.  Filled by index_repo().
FUNC_INDEX = defaultdict(list)


# ==========================================================================
# file discovery
# ==========================================================================
def iter_py_files(scope: str):
    skip = SKIP_ALWAYS | (SKIP_SURVEYA if scope == "surveya" else set())
    out = []
    for p in sorted(SRC.rglob("*.py")):
        rel = p.relative_to(SRC)
        parts = set(rel.parts)
        if parts & skip:
            continue
        if p.name.startswith("test_") or p.name.endswith("_test.py"):
            continue
        if p.name == "conftest.py" and scope == "surveya":
            continue
        out.append(p)
    return out


# ==========================================================================
# scoped AST walk
# ==========================================================================
class ScopedWalk:
    """Yields (node, scope_tuple, enclosing_func, enclosing_class)."""

    def __init__(self):
        self.items = []

    def run(self, tree):
        self._rec(tree, (), None, None)

    def _rec(self, node, scope, fn, cls):
        self.items.append((node, scope, fn, cls))
        for child in _children(node):
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)):
                # decorators / defaults / annotations evaluate in the outer scope
                for d in list(child.decorator_list) + list(child.args.defaults) + \
                         [a.annotation for a in _all_args(child.args) if a.annotation]:
                    self._rec(d, scope, fn, cls)
                self._rec(child, scope + (child.name,), child, cls)
            elif isinstance(child, ast.ClassDef):
                for d in child.decorator_list:
                    self._rec(d, scope, fn, cls)
                for b in child.bases:
                    self._rec(b, scope, fn, cls)
                self._rec(child, scope + (child.name,), fn, child)
            else:
                self._rec(child, scope, fn, cls)


def _all_args(a):
    return list(a.posonlyargs) + list(a.args) + list(a.kwonlyargs) + \
           ([a.vararg] if a.vararg else []) + ([a.kwarg] if a.kwarg else [])


def _children(node):
    """ast.iter_child_nodes but also descends into decorators."""
    out = list(ast.iter_child_nodes(node))
    return out


# ==========================================================================
# module model
# ==========================================================================
class Mod:
    def __init__(self, path: Path, rel: str, src: str, tree):
        self.path = path
        self.rel = rel
        self.src = src
        self.tree = tree
        self.walk = ScopedWalk()
        self.walk.run(tree)

        # qualified names of every def, keyed by scope tuple
        self.qualified = {}          # scope_tuple -> node
        self.by_basename = defaultdict(list)
        for node, scope, fn, cls in self.walk.items:
            if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                self.qualified[scope] = node
                self.by_basename[scope[-1]].append((scope, node))

        # assignments: scope -> list of (lineno, target_name, value)
        self.assigns = defaultdict(list)
        # subscript mutations: scope -> list of (lineno, base_name, key_or_None)
        self.subscripts = defaultdict(list)
        for node, scope, fn, cls in self.walk.items:
            sk = scope
            if isinstance(node, ast.Assign):
                for t in node.targets:
                    if isinstance(t, ast.Name):
                        self.assigns[sk].append((node.lineno, t.id, node.value))
                    elif isinstance(t, ast.Subscript):
                        base = _subscript_base(t)
                        if base:
                            self.subscripts[sk].append(
                                (node.lineno, base, _const_str(t.slice)))
            elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
                if node.value is not None:
                    self.assigns[sk].append((node.lineno, node.target.id, node.value))
            elif isinstance(node, ast.AugAssign) and isinstance(node.target, ast.Subscript):
                base = _subscript_base(node.target)
                if base:
                    self.subscripts[sk].append(
                        (node.lineno, base, _const_str(node.target.slice)))
            elif isinstance(node, ast.For):
                pass
        self.assigns = dict(self.assigns)
        self.subscripts = dict(self.subscripts)

        # functions whose every direct return is a Response-ish call.
        # Decided in a SECOND pass (see finalize_factories) because a class is
        # only known to be a DRF view after the whole repo index exists.
        self.rets_by_fn = defaultdict(list)
        for node, scope, fn, cls in self.walk.items:
            if isinstance(node, ast.Return) and node.value is not None and fn is not None:
                self.rets_by_fn[id(fn)].append((node, scope))
        self.factories = {}
        self.factory_kind = {}

    def is_view_method(self, scope, node):
        parent_cls = scope[:-1]
        if parent_cls and parent_cls in VIEW_CLASSES:
            return True
        if node.name in HTTP_METHOD_NAMES or node.name in VIEWSET_ACTIONS:
            return True
        for d in node.decorator_list:
            nm = _callee_name(d) if isinstance(d, ast.Call) else _dotted(d)
            if nm and nm.split(".")[-1] in VIEW_DECORATORS:
                return True
        return False


# class -> its base names, filled by index_repo
CLASS_BASES = defaultdict(list)
# class scope tuples that are DRF views, filled by index_repo
VIEW_CLASSES = set()


def index_repo():
    """Index every class and decide which ones are DRF views (transitively)."""
    CLASS_BASES.clear()
    VIEW_CLASSES.clear()
    FUNC_INDEX.clear()
    for m in mods:
        for sc, node in m.qualified.items():
            if isinstance(node, ast.ClassDef):
                bases = []
                for b in node.bases:
                    d = _dotted(b)
                    if d:
                        bases.append(d.split(".")[-1])
                CLASS_BASES[sc] = bases
            else:
                FUNC_INDEX[sc[-1]].append((m, sc))

    by_name = defaultdict(list)
    for sc in CLASS_BASES:
        by_name[sc[-1]].append(sc)

    memo = {}

    def is_view(sc, stack):
        if sc in memo:
            return memo[sc]
        if sc in stack:
            return False
        stack = stack | {sc}
        bases = CLASS_BASES.get(sc, [])
        res = False
        for b in bases:
            if VIEW_BASE_RE.search(b):
                res = True
                break
            for cand in by_name.get(b, []):
                if cand == sc:
                    continue
                if is_view(cand, stack):
                    res = True
                    break
            if res:
                break
        if not res:
            # a class that defines any HTTP verb or ViewSet action is a view
            for m2 in mods:
                for sub, n2 in m2.qualified.items():
                    if isinstance(n2, ast.ClassDef) and len(sub) == len(sc) + 1 \
                            and sub[:-1] == sc and \
                            n2.name in HTTP_METHOD_NAMES | VIEWSET_ACTIONS:
                        res = True
                        break
                if res:
                    break
        memo[sc] = res
        return res

    for sc in list(CLASS_BASES):
        if is_view(sc, frozenset()):
            VIEW_CLASSES.add(sc)


def finalize_factories():
    index_repo()
    for m in mods:
        for sc, node in m.qualified.items():
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            if m.is_view_method(sc, node):
                continue
            rets = m.rets_by_fn.get(id(node), [])
            if not rets:
                continue
            kinds = set()
            for r, s in rets:
                v = r.value
                if isinstance(v, ast.Call):
                    nm = _callee_name(v)
                    if nm in RESPONSE_CALLEES:
                        kinds.add("response")
                    elif nm in PAGINATOR_CALLEES:
                        kinds.add("paginator")
            if len(kinds) == 1:
                m.factories[sc] = node
                m.factory_kind[sc] = kinds.pop()


def _subscript_base(node):
    v = node.value
    while isinstance(v, ast.Subscript):
        v = v.value
    return v.id if isinstance(v, ast.Name) else None


def _const_str(node):
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value
    return None


def _dotted(node):
    if isinstance(node, ast.Name):
        return node.id
    if isinstance(node, ast.Attribute):
        b = _dotted(node.value)
        return f"{b}.{node.attr}" if b else node.attr
    return None


def _callee_name(call: ast.Call):
    return _dotted(call.func)


# ==========================================================================
# payload resolution
# ==========================================================================
class Payload:
    __slots__ = ("kind", "keys", "note")

    def __init__(self, kind, keys=None, note=""):
        self.kind = kind          # dict | list | serializer | none | unknown
        self.keys = keys or []
        self.note = note

    def sig(self):
        if self.kind == "dict":
            return "{" + ",".join(self.keys) + "}"
        if self.kind == "list":
            return "[...]"
        if self.kind == "serializer":
            return "<serializer>.data"
        if self.kind == "none":
            return "NO_BODY"
        return "?"


UNKNOWN = lambda n="": Payload("unknown", note=n)


def dict_keys(d: ast.Dict):
    keys, wild = [], False
    for k in d.keys:
        if k is None:
            wild = True
        elif isinstance(k, ast.Constant) and isinstance(k.value, str):
            keys.append(k.value)
        elif isinstance(k, ast.Constant):
            keys.append(repr(k.value))
        elif isinstance(k, ast.UnaryOp):
            keys.append(ast.unparse(k))
        else:
            wild = True
    if wild:
        keys.append("**")
    return keys


def _iter_defs(mods_by_qname, name, same_pkg):
    """find a function def named `name`; prefer same package."""
    hits = []
    for m in mods:
        for q, node in m.by_basename.get(name, []):
            hits.append((m, q, node))
    if not hits:
        return None, None
    for m, q, node in hits:
        if same_pkg and m.rel == same_pkg:
            return m, node
    return hits[0][0], hits[0][2]


mods: list = []
mods_by_path = {}


def resolve(node, mod: Mod, scope, lineno, depth=0, seen=None):
    """Resolve a response payload expression into a Payload."""
    if node is None:
        return Payload("none")
    if depth > 6:
        return UNKNOWN("depth")
    seen = seen or set()
    key = (mod.rel, scope, id(node))
    if key in seen:
        return UNKNOWN("cycle")
    seen = seen | {key}

    if isinstance(node, ast.Constant):
        if node.value is None:
            return Payload("none")
        return UNKNOWN("const")
    if isinstance(node, (ast.List, ast.ListComp, ast.Tuple, ast.GeneratorExp)):
        return Payload("list")
    if isinstance(node, ast.Dict):
        return Payload("dict", dict_keys(node))
    if isinstance(node, ast.Attribute):
        if node.attr == "data":
            return Payload("serializer")
        return UNKNOWN("attr:" + node.attr)
    if isinstance(node, ast.IfExp):
        a = resolve(node.body, mod, scope, lineno, depth + 1, seen)
        b = resolve(node.orelse, mod, scope, lineno, depth + 1, seen)
        if a.kind == b.kind and a.keys == b.keys:
            return a
        return UNKNOWN("ifexp-mixed")
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        a = resolve(node.left, mod, scope, lineno, depth + 1, seen)
        if a.kind == "list":
            return Payload("list")
        return UNKNOWN("binop")
    if isinstance(node, ast.UnaryOp):
        return UNKNOWN("unary")
    if isinstance(node, ast.Await):
        return resolve(node.value, mod, scope, lineno, depth + 1, seen)

    if isinstance(node, ast.Call):
        nm = _callee_name(node)
        if nm in RESPONSE_CALLEES:
            return UNKNOWN("nested-response")
        short = nm.split(".")[-1] if nm else ""
        if SERIALIZER_DICT_HELPERS.search(short or ""):
            return Payload("serializer", note=short)
        # builtins / DRF & Django queryset methods whose Python type IS the shape
        if short in BUILTIN_LIST_RETURNS:
            return Payload("list", note="builtin:" + short)
        if short in BUILTIN_DICT_RETURNS:
            return Payload("dict", ["**"], note="builtin:" + short)
        if short in ("dict", "OrderedDict"):
            if node.args and isinstance(node.args[0], ast.Dict):
                return Payload("dict", dict_keys(node.args[0]))
            if any(k.arg == "kwargs" for k in node.keywords):
                return UNKNOWN("dict(**)")
            return Payload("dict", ["**"])
        # a local helper, or a repo-wide helper with the same basename
        q = None
        if nm and "." not in nm:
            for cand in [tuple(nm.split("."))] + _prefixes(tuple(nm.split("."))):
                if cand in mod.qualified:
                    q = cand
                    break
        elif nm and nm.startswith("self."):
            cand = tuple(list(scope[:-1]) + nm.split(".", 1)[1].split("."))
            for c2 in [cand] + _prefixes(cand):
                if c2 in mod.qualified:
                    q = c2
                    break
        if q is None and nm:
            short2 = nm.split(".")[-1]
            for m2, sc2 in FUNC_INDEX.get(short2, []):
                q = sc2
                mod = m2
                break
        if q is not None and isinstance(mod.qualified[q],
                                         (ast.FunctionDef, ast.AsyncFunctionDef)):
            fnode = mod.qualified[q]
            rets = mod.rets_by_fn.get(id(fnode), [])
            if rets:
                pls = [resolve(r.value, mod, s, r.lineno, depth + 1, seen)
                       for r, s in rets]
                if len(pls) == 1:
                    return pls[0]
                # multi-branch helper: merge only when every branch is a
                # dict/serializer.  Otherwise the shape is branch-dependent and
                # static analysis cannot decide -> UNKNOWN (do not force a family)
                kinds = {p.kind for p in pls}
                if kinds <= {"dict"}:
                    keys = []
                    for p in pls:
                        for k in p.keys:
                            if k not in keys:
                                keys.append(k)
                    return Payload("dict", keys, note=f"multi_return({len(pls)})")
                if kinds <= {"dict", "serializer"}:
                    return Payload("serializer", note=f"multi_return({len(pls)})")
                return Payload("unknown", note=f"multi_return_mixed({len(pls)})")
        return UNKNOWN("call:" + (short or "?"))

    if isinstance(node, ast.Name):
        # A name can be rebound several times inside one function (try/except,
        # if/else).  Resolving only the last textual assignment is wrong, e.g.
        # `market_serving/views.py:141` vs `:144`.  Resolve every binding that
        # precedes the use and accept the answer only if they all agree.
        cands = [(lno, val) for lno, nm, val in mod.assigns.get(scope, [])
                 if nm == node.id and lno <= lineno]
        if cands:
            cands.sort()
            pls = []
            for lno, val in cands[-4:]:
                p = resolve(val, mod, scope, lno, depth + 1, seen)
                if p.kind == "dict":
                    for _, base, k in mod.subscripts.get(scope, []):
                        if base == node.id and k and k not in p.keys:
                            p.keys = p.keys + [k]
                pls.append((lno, p))
            kinds = {p.kind for _l, p in pls}
            sigs = {tuple(p.keys) for _l, p in pls if p.kind in ("dict", "list")}
            if len(pls) == 1 or len(kinds) == 1 and len(sigs) <= 1:
                return pls[-1][1]
            return UNKNOWN(f"multivalue:{node.id}({len(pls)})")
        # module level
        cands = [(lno, val) for lno, nm, val in mod.assigns.get((), [])
                 if nm == node.id]
        if cands:
            cands.sort()
            lno, val = cands[-1]
            return resolve(val, mod, (), lno, depth + 1, seen)
        return UNKNOWN("name:" + node.id)

    return UNKNOWN("expr:" + type(node).__name__)


def _prefixes(q):
    return [tuple(q[:i]) for i in range(len(q) - 1, 0, -1)]


# ==========================================================================
# family classification
# ==========================================================================
def classify(pl: Payload, call: ast.Call, paginator: bool):
    """Return (family, reason).  Order is fixed and documented in m1.md."""
    if paginator:
        return "F6_PAGINATED", "get_paginated_response()"
    if pl.kind == "none":
        return "F0_NO_BODY", "no data argument / None"
    if pl.kind == "serializer":
        return "F8_SERIALIZER", pl.note or "<x>.data"
    if pl.kind == "list":
        return "F1_BARE_ARRAY", pl.note or ""
    if pl.kind == "unknown":
        return "UNKNOWN", pl.note
    if pl.kind == "paginator":
        return "F6_PAGINATED", "get_paginated_response()"
    # dict
    keys = set(pl.keys)
    if "**" in keys:
        return "F9_HAND_BUILT", "dict with **spread"
    if keys == {"data", "meta"}:
        return "F2_DATA_META", "{data, meta}"
    if keys and keys <= {"status", "timestamp", "request_id", "data"} and "data" in keys:
        return "F3_ALREADY", pl.sig()
    if keys & {"object", "generated_at", "summary_cards"}:
        return "F4_GENERATED", pl.sig()
    if "data" in keys and (len(keys) > 1):
        return "F5_DATA_PLUS", pl.sig()
    if (keys & (PAG_PRIMARY | F6_EXTRA)) or (len(keys & PAG_SECONDARY) >= 2):
        return "F6_PAGINATED", pl.sig()
    if keys and keys <= ACK_KEYS:
        return "F7_ACK", pl.sig()
    return "F9_HAND_BUILT", pl.sig()


# ==========================================================================
# status resolution
# ==========================================================================
def _status_atom(v, mod, scope, lineno, helper_defaults, depth=0):
    """Classify one status expression.  Returns (is_2xx_str, repr)."""
    if isinstance(v, ast.Constant) and isinstance(v.value, int):
        return ("2xx" if 200 <= v.value < 300 else "4xx5xx"), str(v.value)
    if isinstance(v, ast.Attribute):
        if v.attr in HTTP_2XX_ATTRS:
            return "2xx", f"status.{v.attr}"
        if v.attr in HTTP_4XX_5XX_ATTRS:
            return "4xx5xx", f"status.{v.attr}"
        # e.g. `self.status_code` -- decided at runtime
        return "unknown", ast.unparse(v)
    if isinstance(v, ast.IfExp) and depth < 4:
        a = _status_atom(v.body, mod, scope, lineno, helper_defaults, depth + 1)
        b = _status_atom(v.orelse, mod, scope, lineno, helper_defaults, depth + 1)
        if a[0] == b[0]:
            return a[0], f"({a[1]} if .. else {b[1]})"
        return "unknown", f"({a[1]} if .. else {b[1]})"
    if isinstance(v, ast.Name) and depth < 4:
        d = helper_defaults.get(v.id)
        if isinstance(d, int):
            return ("2xx" if 200 <= d < 300 else "4xx5xx"), f"{v.id}={d}"
        best = None
        for lno, nm, val in mod.assigns.get(scope, []):
            if nm == v.id and lno <= lineno and (best is None or lno >= best[0]):
                best = (lno, val)
        if best:
            return _status_atom(best[1], mod, scope, best[0],
                                helper_defaults, depth + 1)
    return "unknown", ast.unparse(v)


def factory_status(short, helper_defaults):
    """Status a response-factory helper hands back, from its own Response call."""
    cand = _find_factory(short)
    if cand is None:
        return None, None
    m2, sc2, _f = cand
    rv, rs = factory_return(m2, sc2)
    if rv is None:
        return None, None
    _data, st = unwrap_response_call(rv)
    if st is None:
        return "2xx", "implicit 200"
    return _status_atom(st, m2, rs, rv.lineno, helper_defaults)


def resolve_status(call: ast.Call, mod: Mod, scope, lineno, helper_defaults):
    """Return (is_2xx_str, status_repr)."""
    for k in call.keywords:
        if k.arg in ("status", "status_code", "code"):
            return _status_atom(k.value, mod, scope, lineno, helper_defaults)
    nm = _callee_name(call)
    if nm:
        short = nm.split(".")[-1]
        fs, fr = factory_status(short, helper_defaults)
        if fs is not None:
            return fs, f"helper:{fr}"
    return "2xx", "implicit 200"


# ==========================================================================
# global response-factory registry
# ==========================================================================
# A "factory" is a function whose every direct `return` builds the response
# object itself.  The factory body is NOT an endpoint; its call sites are.
# Built repo-wide so that `success_response` imported into another module is
# still recognised.
FACTORIES = {}          # bare name -> list of (mod, scope_tuple, kind)


def build_factory_registry():
    FACTORIES.clear()
    for m in mods:
        for sc, node in m.factories.items():
            FACTORIES.setdefault(sc[-1], []).append(
                (m, sc, m.factory_kind[sc]))


# ==========================================================================
# urlpatterns resolution
# ==========================================================================
def _rel_pkg(rel: str):
    """src-relative package parts for a file rel path."""
    parts = rel.split("/")
    if parts[-1] == "__init__.py":
        return parts[:-1]
    return parts[:-1]


def _abs_dotted(rel: str, module, level: int):
    """Resolve a (possibly relative) import module to src-relative dotted."""
    parts = [p for p in (module or "").split(".") if p]
    if level == 0:
        return ".".join(parts)
    pkg = _rel_pkg(rel)
    anchor = pkg[: len(pkg) - (level - 1)] if level - 1 <= len(pkg) else []
    return ".".join(anchor + parts)


def _dotted_to_rel(dotted: str):
    d = dotted.replace(".", "/")
    p1 = d + ".py"
    p2 = d + "/__init__.py"
    for p in (p1, p2):
        if p in mods_by_path:
            return p
    return None


def import_map(mod: Mod):
    """local name -> src-relative dotted symbol path"""
    out = {}
    for node, scope, fn, cls in mod.walk.items:
        if isinstance(node, ast.ImportFrom):
            base = _abs_dotted(mod.rel, node.module or "", node.level or 0)
            for a in node.names:
                if a.name == "*":
                    continue
                out[a.asname or a.name] = f"{base}.{a.name}" if base else a.name
        elif isinstance(node, ast.Import):
            for a in node.names:
                out[a.asname or a.name.split(".")[0]] = a.name
    return out


def local_defs(mod: Mod):
    return {q.split(".")[-1]: ".".join(q.split(".")[:-1])
            for q in mod.qualified
            if not mod.qualified[q].__class__.__name__.endswith("Module")}


def resolve_view_ref(node, mod: Mod, imap, aliases=None):
    """'MyView.as_view()' / bare name / as_view() alias -> dotted symbol."""
    aliases = aliases or {}
    if isinstance(node, ast.Name) and node.id in aliases:
        return aliases[node.id]
    if isinstance(node, ast.Call):
        node = node.func
    if isinstance(node, ast.Attribute) and node.attr == "as_view":
        node = node.value

    if isinstance(node, ast.Attribute):
        # `module.MyView.as_view()` -> the `as_view` was stripped above
        d = _dotted(node)
        if d:
            parts = d.split(".")
            if parts[0] in imap:
                return chase_reexport(".".join([imap[parts[0]]] + parts[1:]))
        return chase_reexport(d) if d else None
    if isinstance(node, ast.Name):
        if node.id in imap:
            return chase_reexport(imap[node.id])
        return node.id          # defined in the same module (urls.py local view)
    return None


def as_view_aliases(mod: Mod, imap):
    """`ingest_job_list = IngestJobViewSet.as_view({'get': 'list'})` -> alias."""
    out = {}
    for node, scope, fn, cls in mod.walk.items:
        if not isinstance(node, ast.Assign) or scope != ():
            continue
        v = node.value
        if not (isinstance(v, ast.Call) and isinstance(v.func, ast.Attribute)
                and v.func.attr == "as_view"):
            continue
        d = _dotted(v.func.value)
        if not d:
            continue
        head = d.split(".")[0]
        sym = (imap[head] + "." + ".".join(d.split(".")[1:])
               if head in imap and len(d.split(".")) > 1 else
               (imap[head] if head in imap else d))
        for t in node.targets:
            if isinstance(t, ast.Name):
                out[t.id] = sym
    return out


def star_exports(dotted_module):
    """Names brought in by `from <dotted_module> import *`.

    service_ops/views/dataops.py:3-8 is nine star-imports of the dataops_*
    modules, and service_ops/urls.py routes `dataops.DataOpsRunLogsView`.  Without
    expanding stars every DataOps* view looks unrouted.
    """
    rel = _dotted_to_rel(dotted_module)
    if rel is None or rel not in mods_by_path:
        return []
    m = mods_by_path[rel]
    for node, scope, fn, cls in m.walk.items:
        if isinstance(node, ast.Assign):
            for t in node.targets:
                if isinstance(t, ast.Name) and t.id == "__all__" and \
                        isinstance(node.value, (ast.List, ast.Tuple)):
                    return [e.value for e in node.value.elts
                            if isinstance(e, ast.Constant)]
    return sorted({sc[-1] for sc in m.qualified if len(sc) == 1})


REEXPORTS = defaultdict(dict)      # rel module -> {name: dotted target}


def build_reexport_index():
    """`<module>.<name>` is routed through a re-export chain?

    e.g. identity_access/views_auth.py:6 re-exports `logout_view` from
    `views/login.py`, and identity_access/urls.py routes `views_auth.logout_view`.
    Without chasing this hop the call site in views/login.py looks unrouted.
    """
    REEXPORTS.clear()
    for m in mods:
        defined = {sc[-1] for sc in m.qualified}
        for node, scope, fn, cls in m.walk.items:
            if not isinstance(node, ast.ImportFrom) or not node.module:
                continue
            base = _abs_dotted(m.rel, node.module, node.level or 0)
            if not base:
                continue
            for a in node.names:
                if a.name == "*":
                    for nm in star_exports(base):
                        if nm not in defined:
                            REEXPORTS[m.rel].setdefault(nm, f"{base}.{nm}")
                    continue
                if a.name in defined:
                    continue
                REEXPORTS[m.rel].setdefault(a.name, f"{base}.{a.name}")


def chase_reexport(symbol, hops=3):
    """Follow `<module>.<name>` re-export chains.  Returns the defining symbol."""
    seen = set()
    while hops > 0 and symbol and symbol not in seen:
        seen.add(symbol)
        dot = symbol.rfind(".")
        if dot < 0:
            return symbol
        modpath, name = symbol[:dot], symbol[dot + 1:]
        rel = _dotted_to_rel(modpath)
        if rel is None or rel not in REEXPORTS:
            return symbol
        nxt = REEXPORTS[rel].get(name)
        if not nxt:
            return symbol
        symbol = nxt
        hops -= 1
    return symbol


class Routes:
    def __init__(self):
        self.routes = []
        self.view_symbols = set()
        self.method_routes = defaultdict(set)
        self.includes = []
        self.unresolved = []


def build_routes(mod: Mod, routes: Routes, visited):
    if mod.rel in visited:
        return
    visited.add(mod.rel)
    imap = import_map(mod)
    aliases = as_view_aliases(mod, imap)
    for node, scope, fn, cls in mod.walk.items:
        if not isinstance(node, ast.Call):
            continue
        nm = _callee_name(node)
        if not nm:
            continue
        short = nm.split(".")[-1]
        if short in ("path", "re_path", "url", "register"):
            if short == "register":
                if len(node.args) >= 2:
                    pref = _const_str(node.args[0]) or ""
                    vs = resolve_view_ref(node.args[1], mod, imap, aliases)
                    if vs:
                        routes.view_symbols.add(vs)
                        base = vs.split(".")[-1]
                        routes.method_routes[base] |= HTTP_METHOD_NAMES
                        routes.routes.append((pref, vs, mod.rel, node.lineno,
                                              ["<router>"]))
                continue
            args = node.args
            pat = _const_str(args[0]) if args else None
            view = resolve_view_ref(args[1], mod, imap, aliases) if len(args) > 1 else None
            methods = set()
            for k in node.keywords:
                if k.arg == "methods" and isinstance(k.value, (ast.List, ast.Tuple)):
                    methods = {e.value for e in k.value.elts
                               if isinstance(e, ast.Constant)}
            if view:
                routes.view_symbols.add(view)
                base = view.split(".")[-1]
                routes.method_routes[base] |= (methods or HTTP_METHOD_NAMES)
            routes.routes.append((pat, view, mod.rel, node.lineno, sorted(methods)))
        elif short == "include":
            target = None
            for a in node.args:
                if isinstance(a, ast.Constant) and isinstance(a.value, str):
                    target = a.value
                elif isinstance(a, (ast.Tuple, ast.List)) and a.elts and \
                        isinstance(a.elts[0], ast.Constant):
                    target = a.elts[0].value
            if target:
                routes.includes.append((target, mod.rel, node.lineno))
                rel = _dotted_to_rel(target)
                if rel and rel not in visited:
                    build_routes(mods_by_path[rel], routes, visited)


def resolve_root_urlconf():
    """ROOT_URLCONF from settings.py, as an src-relative file. None if absent."""
    for rel in ("vninvest_core/settings.py", "settings.py"):
        m = mods_by_path.get(rel)
        if m is None:
            continue
        for node, scope, fn, cls in m.walk.items:
            if isinstance(node, ast.Assign):
                for t in node.targets:
                    if isinstance(t, ast.Name) and t.id == "ROOT_URLCONF" and \
                            isinstance(node.value, ast.Constant):
                        r = _dotted_to_rel(str(node.value.value))
                        if r:
                            return r, node.lineno
    return None, None


# ==========================================================================
# main
# ==========================================================================
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scope", choices=["m1", "surveya"], default="m1")
    ap.add_argument("--out-prefix", default="")
    ap.add_argument("--f6-extra", default=F6_EXTRA_DEFAULT,
                    help="comma separated extra F6 array-key names "
                         "(pass empty string for the strict reading)")
    ap.add_argument("--src", default="",
                    help="override source root (used to re-scan another base "
                         "commit exported with git archive)")
    ap.add_argument("--include-factory-bodies", action="store_true",
                    help="count the Response() inside a response-producing "
                         "helper as a call site too (double counts; used only "
                         "to reproduce survey-a's arithmetic)")
    args = ap.parse_args()

    global F6_EXTRA, SRC
    F6_EXTRA = {x.strip() for x in args.f6_extra.split(",") if x.strip()}
    if args.src:
        SRC = Path(args.src)

    files = iter_py_files(args.scope)
    global mods, mods_by_path
    mods = []
    mods_by_path = {}
    parse_errors = []

    for p in files:
        rel = p.relative_to(SRC).as_posix()
        src = p.read_text(encoding="utf-8")   # explicit utf-8, never cp1252
        try:
            tree = ast.parse(src, filename=str(p))
        except SyntaxError as e:
            parse_errors.append((rel, e.lineno, str(e)))
            continue
        m = Mod(p, rel, src, tree)
        mods.append(m)
        mods_by_path[rel] = m

    # ---- helper default status across all modules
    finalize_factories()
    build_factory_registry()
    helper_defaults = {}
    for m in mods:
        for sc, node in m.qualified.items():
            if not isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
                continue
            args_ = _all_args(node.args)
            defaults = list(node.args.defaults)
            # positional defaults align to the tail of positional args
            off = len(args_) - len(defaults)
            pairs = []
            for i, d in enumerate(defaults):
                pairs.append((args_[i + off].arg, d))
            for i, d in enumerate(node.args.kw_defaults):
                if d is not None:
                    pairs.append((node.args.kwonlyargs[i].arg, d))
            for nm, d in pairs:
                if nm in ("status", "status_code", "code"):
                    if isinstance(d, ast.Constant) and isinstance(d.value, int):
                        helper_defaults.setdefault(sc[-1], d.value)
                    elif isinstance(d, ast.Attribute) and d.attr in HTTP_2XX_ATTRS:
                        helper_defaults.setdefault(sc[-1], 200)

    # ---- collect call sites
    rows = []
    for m in mods:
        factory_scopes = set(m.factories)
        for node, scope, fn, cls in m.walk.items:
            if not isinstance(node, ast.Call):
                continue
            nm = _callee_name(node)
            if not nm:
                continue
            short = nm.split(".")[-1]

            kind = None
            if short in RESPONSE_CALLEES:
                kind = "response"
            elif short in PAGINATOR_CALLEES:
                kind = "paginator"
            elif short in FACTORIES and \
                    any(k == "response" for (_m, _s, k) in FACTORIES[short]):
                kind = "response_helper"
            if kind is None:
                continue

            # a factory body itself is not a call site; count at call site instead.
            # `scope` IS the enclosing function's scope tuple (ScopedWalk only
            # pushes a scope at FunctionDef/ClassDef boundaries).
            if kind == "response" and fn is not None and scope in factory_scopes \
                    and not args.include_factory_bodies:
                continue
            # `self.get_paginated_response(...)` INSIDE a method of the same name
            # is delegation (SOCBaseView), not an endpoint.
            if kind == "paginator" and fn is not None and \
                    fn.name == "get_paginated_response":
                continue

            # resolve payload
            if kind == "paginator":
                pl = Payload("paginator")
                fam, why = classify(pl, node, True)
            elif kind == "response_helper":
                p2 = resolve_helper_payload(m, node, short)
                if p2 is None:
                    fam, why = "UNKNOWN", f"helper:{short} unresolvable"
                else:
                    fam, why = classify(p2, node, False)
            else:
                data_arg = node.args[0] if node.args else None
                for k in node.keywords:
                    if k.arg == "data":
                        data_arg = k.value
                if data_arg is None:
                    pl = Payload("none")
                else:
                    pl = resolve(data_arg, m, scope, node.lineno)
                fam, why = classify(pl, node, False)

            is2, st = resolve_status(node, m, scope, node.lineno, helper_defaults)
            if kind == "response_helper" and is2 == "unknown":
                is2 = "2xx"

            enclosing = ".".join(scope)
            pag = "True" if kind == "paginator" else "False"

            rows.append({
                "family": fam,
                "file": m.rel,
                "line": node.lineno,
                "symbol": nm,
                "enclosing_view": enclosing,
                "is_2xx": is2,
                "paginates": pag,
                "notes": f"{why} | status={st} | kind={kind}",
                "_callee": short,
                "_scope": scope,
                "_line": node.lineno,
            })

    OUTDIR.mkdir(parents=True, exist_ok=True)
    pre = args.out_prefix
    build_reexport_index()
    # ---- routes: reachability starts at ROOT_URLCONF only, so "on route"
    # means "reachable from the URLconf Django actually loads".
    routes = Routes()
    root_rel, root_line = resolve_root_urlconf()
    visited = set()
    if root_rel and root_rel in mods_by_path:
        build_routes(mods_by_path[root_rel], routes, visited)
    unreachable_urlconfs = sorted(
        m.rel for m in mods
        if (m.rel.endswith("urls.py") or m.rel.endswith("_urls.py"))
        and m.rel not in visited)

    # ---- inventory of paginate_queryset() call sites.  These do NOT return a
    # response (they return a page); the response is produced by the paired
    # get_paginated_response().  Counted here so the pairing is auditable.
    paginate_queryset_sites = []
    for m in mods:
        for node, scope, fn, cls in m.walk.items:
            if isinstance(node, ast.Call) and \
                    (_callee_name(node) or "").split(".")[-1] == "paginate_queryset" and \
                    not (fn is not None and fn.name == "paginate_queryset"):
                paginate_queryset_sites.append((m.rel, node.lineno))
    with (OUTDIR / f"{pre}paginate_queryset.csv").open(
            "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["file", "line"])
        for rel, ln in sorted(paginate_queryset_sites):
            w.writerow([rel, ln])

    route_basenames = {v.split(".")[-1] for v in routes.view_symbols}

    # def_path: src-relative dotted path of a top-level def, e.g.
    #   market_data.admin_sync_views.AdminOpsMarketGroupsSyncView
    # Matching routes on the FULL path (not the basename) matters: the repo has
    # one view class name defined in two modules
    # (`AdminOpsMarketGroupsSyncView`), and a basename match marks the unrouted
    # copy as routed.
    def dotted(rel):
        return rel[:-3].replace("/", ".") if rel.endswith(".py") else rel

    def def_path(mod, scope):
        top = scope[0]
        if (top,) in mod.qualified:
            return f"{dotted(mod.rel)}.{top}"
        return None

    # pass 1a: exact dotted match
    for r in rows:
        r["_route"] = None
    for r in rows:
        m2 = mods_by_path[r["file"]]
        dp = def_path(m2, r["_scope"])
        if dp and dp in routes.view_symbols:
            r["_route"] = "exact:" + dp

    # pass 1b: fall back to basename ONLY for route symbols the urlconf
    # referenced by an unresolvable bare name (a function view defined in the
    # urls module itself).  For fully qualified symbols a basename match would
    # be unsound.
    bare_route_names = {v for v in routes.view_symbols if "." not in v}
    for r in rows:
        if r["_route"]:
            continue
        scope = r["_scope"]
        for nm_ in list(scope[:-1]) + [scope[-1] if scope else ""]:
            if nm_ and nm_ in bare_route_names:
                r["_route"] = "basename:" + nm_
                break

    # pass 2: a module-level helper is on the route if any of ITS call sites sits
    # in a routed view.  (`_empty_list()`, `_do_issue()` ...)
    routed_scopes = {r["_scope"] for r in rows if r["_route"]}
    for r in rows:
        if r["_route"]:
            continue
        if len(r["_scope"]) != 1:
            continue
        helper_scope = r["_scope"]
        called_from_routed = False
        for m2 in mods:
            for node, scope, fn, cls in m2.walk.items:
                if not isinstance(node, ast.Call):
                    continue
                nm = _callee_name(node) or ""
                if nm.split(".")[-1] != helper_scope[0]:
                    continue
                if scope in routed_scopes:
                    called_from_routed = True
                    break
            if called_from_routed:
                break
        if called_from_routed:
            r["_route"] = "via_helper:" + helper_scope[0]

    for r in rows:
        parts = r["notes"].split("; ", 1)
        tail = parts[1] if len(parts) > 1 else parts[0]
        r["notes"] = f"on_route={r['_route'] or 'NO'} ; {tail}"

    def routed(r):
        return bool(r["_route"])

    # ---- reconciliation counters (to reproduce survey-a's arithmetic exactly)
    # A) every Response()/JsonResponse() 2xx Call node, INCLUDING factory bodies
    raw_resp_2xx = 0
    factory_body_2xx = 0
    factory_bodies_2xx_names = []
    for m in mods:
        for node, scope, fn, cls in m.walk.items:
            if not isinstance(node, ast.Call):
                continue
            nm = _callee_name(node) or ""
            if nm.split(".")[-1] not in RESPONSE_CALLEES:
                continue
            is2, _st = resolve_status(node, m, scope, node.lineno,
                                      helper_defaults)
            if is2 != "2xx":
                continue
            raw_resp_2xx += 1
            if fn is not None and scope in m.factory_kind:
                factory_body_2xx += 1
                factory_bodies_2xx_names.append(
                    f"{m.rel}:{node.lineno} {'.'.join(scope)}")
    # B) call sites of response-producing helpers, grouped by helper name

    # ---- write csv
    cols = ["family", "file", "line", "symbol", "enclosing_view",
            "is_2xx", "paginates", "notes"]
    csv_path = OUTDIR / f"{pre}callsites.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        for r in sorted(rows, key=lambda x: (x["file"], x["_line"])):
            w.writerow(r)

    # ---- summary
    twoxx = [r for r in rows if r["is_2xx"] == "2xx"]
    unknown_status = [r for r in rows if r["is_2xx"] == "unknown"]
    non2xx = [r for r in rows if r["is_2xx"] == "4xx5xx"]
    fam2 = Counter(r["family"] for r in twoxx)
    famall = Counter(r["family"] for r in rows)
    by_app = Counter(r["file"].split("/")[0] for r in twoxx)
    f6_paginator = sum(1 for r in twoxx
                       if r["family"] == "F6_PAGINATED" and r["paginates"] == "True")
    f6_handwritten = sum(1 for r in twoxx
                         if r["family"] == "F6_PAGINATED" and r["paginates"] == "False")
    unknown_reasons = Counter(
        r["notes"].split(";")[-1].split("=")[-1].strip()
        for r in twoxx if r["family"] == "UNKNOWN")
    kind2 = Counter(r["notes"].split("kind=")[-1] for r in twoxx)
    callee2 = Counter(r["symbol"].split(".")[-1] for r in twoxx)
    helper_call_sites = Counter(
        r["symbol"].split(".")[-1] for r in twoxx
        if "kind=response_helper" in r["notes"])

    ACK_KEY_SET = {"ok", "message", "msg", "detail", "error", "note", "success"}

    ack_present = Counter()
    for r in twoxx:
        m2 = re.match(r"\{([^}]*)\}", r["notes"].split(";")[1].strip())
        if not m2:
            continue
        keys = set(m2.group(1).split(","))
        if keys & ACK_KEY_SET:
            ack_present[r["family"]] += 1

    summary = {
        "repo": str(REPO),
        "base_commit": "4717fc1e",
        "scope": args.scope,
        "files_on_disk": len(files),
        "files_parsed": len(mods),
        "parse_errors": parse_errors,
        "total_response_callsites_all_status": len(rows),
        "is_2xx": len(twoxx),
        "is_4xx5xx": len(non2xx),
        "status_unknown": len(unknown_status),
        "family_2xx": dict(sorted(fam2.items())),
        "family_all": dict(sorted(famall.items())),
        "by_app_2xx": dict(sorted(by_app.items())),
        "f6_paginator_only": f6_paginator,
        "f6_handwritten": f6_handwritten,
        "kind_2xx": dict(sorted(kind2.items())),
        "callee_2xx": dict(sorted(callee2.items())),
        "recon_raw_response_2xx_incl_factory_bodies": raw_resp_2xx,
        "recon_factory_bodies_2xx": factory_body_2xx,
        "recon_factory_bodies_2xx_list": sorted(factory_bodies_2xx_names),
        "recon_helper_call_sites_2xx": dict(sorted(helper_call_sites.items())),
        "paginate_queryset_callsites": len(paginate_queryset_sites),
        "unknown_reasons": dict(unknown_reasons),
        "rows_2xx_dict_containing_an_ack_key_by_family": dict(sorted(
            ack_present.items())),
        "routes_found": len(routes.routes),
        "root_urlconf": root_rel,
        "root_urlconf_line": root_line,
        "reachable_urlconfs": sorted(visited),
        "unreachable_urlconfs": unreachable_urlconfs,
        "includes_found": len(routes.includes),
        "route_view_symbols": sorted(routes.view_symbols),
        "callsites_2xx_on_route": sum(1 for r in twoxx if r["_route"]),
        "callsites_2xx_off_route": sum(1 for r in twoxx if not r["_route"]),
        "route_status_2xx": dict(Counter(
            (r["_route"] or "NO").split(":")[0] for r in twoxx)),
        "symbols_2xx_on_route": len({r["enclosing_view"] for r in twoxx
                                     if r["_route"]}),
        "symbols_2xx_off_route": len({r["enclosing_view"] for r in twoxx
                                      if not r["_route"]}),
        "callsites_on_route_class": sum(1 for r in rows if routed(r)),
        "callsites_not_on_route": sum(1 for r in rows if not routed(r)),
        "distinct_route_symbols": len(routes.view_symbols),
        "distinct_enclosing_symbols_2xx": len(
            {r["enclosing_view"] for r in twoxx}),
        "distinct_enclosing_classes_2xx": len(
            {r["_scope"][0] for r in twoxx if r["_scope"]}),
    }
    (OUTDIR / f"{pre}summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    with (OUTDIR / f"{pre}routes.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["route", "view", "file", "line", "methods"])
        for r in routes.routes:
            w.writerow(r)

    # ---- console (utf-8)
    out = sys.stdout
    print(f"scope={args.scope} files_on_disk={len(files)} parsed={len(mods)}", file=out)
    if parse_errors:
        print(f"PARSE ERRORS ({len(parse_errors)}):", file=out)
        for rel, lno, msg in parse_errors:
            print(f"  {rel}:{lno}: {msg}", file=out)
    print(f"total response call sites (all status) = {len(rows)}", file=out)
    print(f"  is_2xx          = {len(twoxx)}", file=out)
    print(f"  is_4xx5xx       = {len(non2xx)}", file=out)
    print(f"  status unknown  = {len(unknown_status)}", file=out)
    print("\nfamily (2xx only):", file=out)
    for k, v in sorted(fam2.items(), key=lambda kv: (-kv[1], kv[0])):
        print(f"  {k:<16} {v}", file=out)
    print(f"  {'TOTAL':<16} {sum(fam2.values())}", file=out)
    print(f"\nF6 split: paginator-call = {f6_paginator}  handwritten-list = "
          f"{f6_handwritten}", file=out)
    print(f"paginate_queryset() call sites (not a response) = "
          f"{len(paginate_queryset_sites)}", file=out)
    if unknown_reasons:
        print("\nUNKNOWN reasons:", file=out)
        for k, v in unknown_reasons.most_common():
            print(f"  {v:4}  {k}", file=out)
    print("\nby app (2xx):", file=out)
    for k, v in sorted(by_app.items(), key=lambda kv: (-kv[1], kv[0])):
        print(f"  {k:<26} {v}", file=out)
    print(f"\nroutes parsed      = {len(routes.routes)}", file=out)
    print(f"ROOT_URLCONF       = {root_rel} (settings.py:{root_line})", file=out)
    print(f"urlconfs reached   = {len(visited)}", file=out)
    if unreachable_urlconfs:
        print(f"urlconfs NOT reached from ROOT_URLCONF = "
              f"{len(unreachable_urlconfs)}", file=out)
        for u in unreachable_urlconfs:
            print(f"    {u}", file=out)
    print(f"recon: raw Response/JsonResponse 2xx (incl factory bodies) = "
          f"{raw_resp_2xx}", file=out)
    print(f"recon: factory bodies excluded = {factory_body_2xx}", file=out)
    print(f"recon: response-helper call sites = "
          f"{sum(helper_call_sites.values())} {dict(helper_call_sites)}", file=out)
    print(f"include() resolved = {len(routes.includes)}", file=out)
    print(f"distinct route view symbols = {len(routes.view_symbols)}", file=out)
    print(f"2xx call sites ON a route    = {summary['callsites_2xx_on_route']}"
          f" ({summary['route_status_2xx']})", file=out)
    print(f"2xx call sites OFF route    = {summary['callsites_2xx_off_route']}", file=out)
    print(f"distinct symbols ON route   = {summary['symbols_2xx_on_route']}", file=out)
    print(f"distinct symbols OFF route  = {summary['symbols_2xx_off_route']}", file=out)
    print(f"distinct enclosing symbols (2xx) = "
          f"{summary['distinct_enclosing_symbols_2xx']}", file=out)
    print(f"\nwrote {csv_path}", file=out)


_HELPERS_CACHE = {}


def _find_factory(short: str):
    """(mod, scope, node) of a repo-wide response factory with this bare name."""
    key = ("factory", short)
    if key in _HELPERS_CACHE:
        return _HELPERS_CACHE[key]
    cand = None
    for _m, _sc, _kind in FACTORIES.get(short, []):
        if len(_m.rets_by_fn.get(id(_m.qualified[_sc]), [])) == 1:
            cand = (_m, _sc, _m.qualified[_sc])
            break
    _HELPERS_CACHE[key] = cand
    return cand


def factory_return(mod: Mod, sc):
    """The single `return` value node of a factory, plus its scope."""
    fnode = mod.qualified[sc]
    rets = mod.rets_by_fn.get(id(fnode), [])
    if len(rets) != 1:
        return None, None
    r, s = rets[0]
    return r.value, s


def unwrap_response_call(node):
    """If `node` is a Response(...) call return (data_arg, status_node)."""
    if isinstance(node, ast.Call) and _callee_name(node) in RESPONSE_CALLEES:
        data = node.args[0] if node.args else None
        for k in node.keywords:
            if k.arg == "data":
                data = k.value
        st = None
        for k in node.keywords:
            if k.arg in ("status", "status_code", "code"):
                st = k.value
        return data, st
    return node, None


def resolve_helper_payload(mod: Mod, call: ast.Call, short: str):
    """Resolve the payload a response-factory helper hands back to the caller."""
    cand = _find_factory(short)
    if cand is None:
        return None
    m2, sc2, _f = cand
    rv, rs = factory_return(m2, sc2)
    if rv is None:
        return None
    data, _st = unwrap_response_call(rv)
    if data is None:
        return Payload("none")
    return resolve(data, m2, rs, rv.lineno)


def _uses_paginate_queryset(mod: Mod, call: ast.Call, scope):
    return False


if __name__ == "__main__":
    main()