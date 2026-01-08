import os
import typing
import flask
import inngest.flask
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter, SimpleSpanProcessor
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.requests import RequestsInstrumentor

from src.client import inngest_client
from src import fns
from src.otel_middleware import InngestOTELMiddleware, inngest_span_processor
import dotenv

dotenv.load_dotenv()
port = int(os.getenv("PORT", "3939"))

# Set up OTEL provider with Inngest exporter
provider = TracerProvider()

# Add the Inngest span processor to add required attributes to spans
# This MUST be added first so it runs before other processors
provider.add_span_processor(inngest_span_processor)

# Console exporter for debugging - shows spans in stdout
provider.add_span_processor(SimpleSpanProcessor(ConsoleSpanExporter()))

# OTLP exporter to send to Inngest
otlp_endpoint = f"{inngest_client.api_origin.rstrip('/')}/v1/traces/userland"
print(f"[OTEL] Exporting to: {otlp_endpoint}")
print(f"[OTEL] Signing key present: {inngest_client.signing_key is not None}")

exporter = OTLPSpanExporter(
    endpoint=otlp_endpoint,
    headers={"Authorization": f"Bearer {inngest_client.signing_key}"},
)
provider.add_span_processor(BatchSpanProcessor(exporter))
trace.set_tracer_provider(provider)

# Enable auto-instrumentation for requests library
# This will create child spans for any HTTP requests made during function execution
RequestsInstrumentor().instrument()

# Register the OTEL middleware (pass the class, not an instance)
inngest_client.add_middleware(InngestOTELMiddleware)

# Collect functions
functions: list[inngest.Function[typing.Any]] = [
    val for name in dir(fns)
    if isinstance((val := getattr(fns, name)), inngest.Function)
]

app = flask.Flask("my-app")
inngest.flask.serve(app, inngest_client, functions)
app.run(port=port)
