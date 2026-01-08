import inngest
import requests
from opentelemetry import trace

from .client import inngest_client

# Get a tracer for creating manual spans
# Using "inngest" scope to match the middleware pattern
tracer = trace.get_tracer("inngest")


def do_neat_thing():
    with tracer.start_as_current_span("do-neat-thing") as span:
        span.set_attribute("neat_thing", True)
        span.set_attribute("custom.message", "This span will appear in the UI!")

    return "Cool, right?"


@inngest_client.create_function(
    fn_id="fn-2",
    trigger=inngest.TriggerEvent(event="event-2"),
)
def fn_2(ctx: inngest.ContextSync) -> str:
    foo_bar = ctx.step.run("foo-bar", do_neat_thing)
    return foo_bar


@inngest_client.create_function(
    fn_id="fn-1",
    trigger=inngest.TriggerEvent(event="event-1"),
)
def fn_1(ctx: inngest.ContextSync) -> str:
    with tracer.start_as_current_span("process-order") as span:
        # Add custom attributes to this span
        span.set_attribute("user.id", "user_12345")
        span.set_attribute("order.total", 99.99)
        span.set_attribute("feature.flags", "beta,dark-mode")
        span.set_attribute("request.source", "api")

        # This HTTP request creates an auto-instrumented child span
        response = requests.get("https://httpbin.org/get")

    return f"Got response: {response.status_code}"
