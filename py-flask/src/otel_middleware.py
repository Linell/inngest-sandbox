from __future__ import annotations

import json
import urllib.parse
import logging
from opentelemetry import trace, context as otel_context
from opentelemetry.trace import SpanKind, StatusCode
from opentelemetry.trace.propagation.tracecontext import TraceContextTextMapPropagator
import inngest

from .otel_processor import InngestSpanProcessor

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.DEBUG)

# Global processor instance - needs to be added to the TracerProvider
inngest_span_processor = InngestSpanProcessor()

# Scope name for userland spans - must match the TypeScript SDK pattern
# The backend expects scope "inngest" for SDK-created spans
USERLAND_SCOPE = "inngest"


class InngestOTELMiddleware(inngest.MiddlewareSync):
    """
    Sync middleware for OTEL tracing with Inngest (Flask, Django, etc.)

    Creates a userland span that wraps function execution. This span:
    1. Uses scope "inngest" to match the TypeScript SDK pattern
    2. Uses name "inngest.execution/{function_name}" following SDK conventions
    3. Is parented to Inngest's execution span via traceref.tp

    Auto-instrumented spans (HTTP requests, DB queries, etc.) become children of this span.
    """

    def __init__(self, client: inngest.Inngest, raw_request: object) -> None:
        super().__init__(client, raw_request)

        # Normalize headers to lowercase for consistent lookup
        self.headers: dict[str, str] = {}
        if hasattr(raw_request, "headers"):
            self.headers = {k.lower(): v for k, v in raw_request.headers.items()}

        self._span = None
        self._token = None
        self._span_created = False

    def _parse_tracestate(self) -> dict[str, str]:
        """Parse all inngest@ prefixed values from W3C tracestate header."""
        result = {}
        tracestate = self.headers.get("tracestate", "")
        for entry in tracestate.split(","):
            entry = entry.strip()
            if entry.startswith("inngest@"):
                key, _, value = entry.partition("=")
                clean_key = key.replace("inngest@", "")
                result[clean_key] = urllib.parse.unquote(value)
        return result

    def _ensure_span_created(self, run_id: str | None = None, function_name: str | None = None) -> None:
        """Create the userland span if it doesn't exist yet."""
        if self._span_created:
            return

        # Parse tracestate for all inngest values
        tracestate_values = self._parse_tracestate()
        traceref_raw = tracestate_values.get("traceref", "")
        app_id = tracestate_values.get("app")
        fn_id = tracestate_values.get("fn")

        logger.debug(f"[OTEL] HTTP traceparent: {self.headers.get('traceparent')}")
        logger.debug(f"[OTEL] tracestate values: {tracestate_values}")

        # Extract the traceparent from traceref - this is the CORRECT parent
        # The HTTP traceparent header has a different trace ID!
        traceref_tp = ""
        if traceref_raw:
            try:
                traceref_parsed = json.loads(traceref_raw)
                traceref_tp = traceref_parsed.get("tp", "")
                logger.debug(f"[OTEL] Using traceref.tp as parent: {traceref_tp}")
            except json.JSONDecodeError:
                logger.warning(f"[OTEL] Failed to parse traceref: {traceref_raw}")

        if not traceref_tp:
            logger.warning("[OTEL] No traceref.tp found - spans won't be linked to Inngest trace")
            self._span_created = True
            return

        # Create parent context from traceref.tp (NOT the HTTP traceparent header)
        propagator = TraceContextTextMapPropagator()
        carrier = {"traceparent": traceref_tp}
        parent_ctx = propagator.extract(carrier)

        # IMPORTANT: Register with span processor BEFORE creating the span
        # This ensures on_start can track the span and propagate attributes to children
        inngest_span_processor.set_inngest_context(
            trace_id=traceref_tp.split("-")[1] if traceref_tp else "",
            traceref=traceref_raw,
            traceparent=traceref_tp,
            run_id=run_id or "",
            app_id=app_id,
            function_id=fn_id,
        )

        # Create the userland span matching the TypeScript SDK pattern
        # Scope "inngest" + name "inngest.execution/{fn}" is the SDK convention
        tracer = trace.get_tracer(USERLAND_SCOPE)
        fn_name = function_name or "function"
        span_name = f"inngest.execution/{fn_name}"
        self._span = tracer.start_span(
            span_name,
            context=parent_ctx,
            kind=SpanKind.INTERNAL,
        )
        self._span_created = True

        logger.debug(f"[OTEL] Created userland span: {self._span.get_span_context().trace_id:032x}")

        # Set required Inngest attributes on the main span
        if traceref_raw:
            self._span.set_attribute("inngest.traceref", traceref_raw)
        if traceref_tp:
            self._span.set_attribute("inngest.traceparent", traceref_tp)
        if run_id:
            self._span.set_attribute("sdk.run.id", run_id)
        if app_id:
            self._span.set_attribute("sdk.app.id", app_id)
            self._span.set_attribute("sys.app.id", app_id)
        if fn_id:
            self._span.set_attribute("sys.function.id", fn_id)

        # Make span active so child spans are properly parented
        self._token = otel_context.attach(trace.set_span_in_context(self._span))

        logger.debug(f"[OTEL] Span active - children will be parented to {self._span.get_span_context().span_id:016x}")

    def before_execution(self) -> None:
        logger.debug("[OTEL] before_execution called")

    def transform_input(
        self,
        ctx: inngest.Context | inngest.ContextSync,
        function: inngest.Function,
        steps: inngest.StepMemos,
    ) -> None:
        logger.debug(f"[OTEL] transform_input called - run_id: {ctx.run_id}, function: {function.local_id}")

        # Create span here where we have access to run_id and function name
        self._ensure_span_created(run_id=ctx.run_id, function_name=function.local_id)

    def transform_output(self, result: inngest.TransformOutputResult) -> None:
        logger.debug(f"[OTEL] transform_output called - step: {result.step}, error: {result.error}")

        # Record errors on the span
        if self._span and result.error:
            self._span.set_status(StatusCode.ERROR, str(result.error))
            self._span.record_exception(result.error)

    def after_execution(self) -> None:
        logger.debug("[OTEL] after_execution called")
        if self._token:
            otel_context.detach(self._token)
        if self._span:
            self._span.set_status(StatusCode.OK)
            self._span.end()
            logger.debug(f"[OTEL] Ended span: {self._span.get_span_context().span_id:016x}")
        # Clear the processor context for this execution
        inngest_span_processor.clear_context()
