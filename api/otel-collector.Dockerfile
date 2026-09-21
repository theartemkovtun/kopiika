FROM otel/opentelemetry-collector-contrib:0.161.0
COPY otel-collector-config.yaml /etc/otel-collector-config.yaml
