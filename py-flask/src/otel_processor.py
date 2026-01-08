"""
Custom SpanProcessor that adds Inngest-required attributes to child spans.

This processor tracks spans that are children of Inngest userland spans and adds
the required attributes (inngest.traceref, inngest.traceparent, etc.) so they
can be properly stored and displayed in Inngest's trace view.

IMPORTANT: Child spans must also be marked as userland (_inngest.userland: true)
for them to appear in the Inngest UI. The backend deliberately ignores the
root inngest.execution span and only displays its children.
"""

from opentelemetry.sdk.trace import SpanProcessor, ReadableSpan
from opentelemetry.trace import Span
import logging

logger = logging.getLogger(__name__)

# Userland attribute keys - must match otel_middleware.py
ATTR_USERLAND = "_inngest.userland"
ATTR_USERLAND_NAME = "_inngest.userland.name"
ATTR_USERLAND_KIND = "_inngest.userland.kind"
ATTR_USERLAND_SCOPE_NAME = "_inngest.userland.scope.name"


class InngestSpanProcessor(SpanProcessor):
    """
    Adds Inngest-required attributes to child spans of userland spans.

    The Inngest backend requires every userland span to have:
    - inngest.traceref: Reference to the parent in Inngest's trace tree
    - inngest.traceparent: The W3C traceparent from traceref
    - sdk.run.id: The Inngest run ID
    - sdk.app.id / sys.app.id: The Inngest app ID
    - sys.function.id: The Inngest function ID

    This processor tracks span IDs and propagates attributes to child spans,
    supporting nested spans (children of children also get attributes).
    """

    def __init__(self):
        # span_id -> attributes dict for tracked spans
        self._tracked_spans: dict[int, dict[str, str | None]] = {}

    def set_inngest_context(
        self,
        trace_id: str,
        traceref: str,
        traceparent: str,
        run_id: str,
        app_id: str | None,
        function_id: str | None,
    ) -> None:
        """
        Set up context for a new Inngest execution.
        The actual span registration happens in on_start when we see the root span.
        """
        # Store the attributes to be propagated
        self._pending_attrs = {
            "inngest.traceref": traceref,
            "inngest.traceparent": traceparent,
            "sdk.run.id": run_id,
            "sdk.app.id": app_id,
            "sys.app.id": app_id,
            "sys.function.id": function_id,
        }
        self._pending_trace_id = trace_id.lower() if trace_id else None

        logger.debug(f"[InngestSpanProcessor] Context set for trace: {self._pending_trace_id}")

    def clear_context(self) -> None:
        """Clear pending context after execution completes."""
        self._pending_attrs = {}
        self._pending_trace_id = None
        # Note: We don't clear _tracked_spans here - they clean themselves up in on_end
        logger.debug("[InngestSpanProcessor] Context cleared")

    def on_start(self, span: Span, parent_context=None) -> None:
        """Called when a span starts. Add Inngest attributes if appropriate."""
        span_context = span.get_span_context()
        span_id = span_context.span_id
        span_trace_id = f"{span_context.trace_id:032x}"

        # Check if this is the root userland span (matches pending trace)
        if hasattr(self, '_pending_trace_id') and self._pending_trace_id and span_trace_id == self._pending_trace_id:
            # This span is on the Inngest trace - check if it's our root or a child
            parent_span_id = self._get_parent_span_id(span)

            if parent_span_id is None or parent_span_id not in self._tracked_spans:
                # This is either the root span or a direct child of the system execution span
                # Register it as a tracked span
                attrs = getattr(self, '_pending_attrs', {})
                if attrs:
                    self._tracked_spans[span_id] = attrs
                    logger.debug(f"[InngestSpanProcessor] Registered root span: {span_id:016x}")
            elif parent_span_id in self._tracked_spans:
                # This is a child of a tracked span - propagate attributes
                parent_attrs = self._tracked_spans[parent_span_id]
                for key, value in parent_attrs.items():
                    if value is not None:
                        span.set_attribute(key, value)

                # Mark child spans as userland so they appear in the UI
                # The backend ignores the root inngest.execution span and only shows children
                span.set_attribute(ATTR_USERLAND, True)

                # Set userland metadata for this child span
                # Use the span's own name for display
                span_name = getattr(span, 'name', None) or getattr(span, '_name', 'unknown')
                span.set_attribute(ATTR_USERLAND_NAME, span_name)
                span.set_attribute(ATTR_USERLAND_KIND, "INTERNAL")
                span.set_attribute(ATTR_USERLAND_SCOPE_NAME, "inngest")

                # Track this span so its children also get attributes
                self._tracked_spans[span_id] = parent_attrs
                logger.debug(f"[InngestSpanProcessor] Added attributes to child span: {span_id:016x}")

    def _get_parent_span_id(self, span: Span) -> int | None:
        """Get the parent span ID from a span."""
        if hasattr(span, 'parent') and span.parent:
            return span.parent.span_id
        elif hasattr(span, '_parent') and span._parent:
            return span._parent.span_id
        return None

    def on_end(self, span: ReadableSpan) -> None:
        """Called when a span ends. Clean up tracking."""
        span_id = span.get_span_context().span_id
        self._tracked_spans.pop(span_id, None)

    def shutdown(self) -> None:
        """Clean up resources."""
        self._tracked_spans.clear()
        self._pending_attrs = {}
        self._pending_trace_id = None

    def force_flush(self, timeout_millis: int = 30000) -> bool:
        """Force flush - nothing to do for this processor."""
        return True
