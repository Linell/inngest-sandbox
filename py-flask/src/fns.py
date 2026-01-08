import inngest
import requests
from opentelemetry import trace

from .client import inngest_client


@inngest_client.create_function(
    fn_id="fn-1",
    trigger=inngest.TriggerEvent(event="event-1"),
)
def fn_1(ctx: inngest.ContextSync) -> str:
    # Get the current span created by the OTEL middleware
    span = trace.get_current_span()

    # Add custom attributes that will appear in the Inngest UI
    # These show up in the span details panel when you click on the span
    span.set_attribute("user.id", "user_12345")
    span.set_attribute("order.total", 99.99)
    span.set_attribute("feature.flags", "beta,dark-mode")
    span.set_attribute("request.source", "api")

    # You can also add attributes from the event data
    event_data = ctx.event.data or {}
    if "customer_id" in event_data:
        span.set_attribute("customer.id", event_data["customer_id"])

    # Make an HTTP request (auto-instrumented if requests instrumentation is enabled)
    response = requests.get("https://httpbin.org/get")

    # Add result attributes
    span.set_attribute("http.response.status", response.status_code)
    span.set_attribute("result.success", response.ok)

    return f"Got response: {response.status_code}"
