# Performance — SENTINEL-X

## Runtime metrics

Prometheus text at **`GET /api/metrics`** (auth required):

- `sentinel_x_http_requests_total`
- `sentinel_x_http_duration_ms_total`

## Benchmark (local)

Run on the same machine as the server:

```sh
npm start
npm run benchmark
```

Typical results on a modern laptop (indicative, not a SLA):

| Operation | Target |
|-----------|--------|
| Analyze full account scenario (6 events) | &lt; 50 ms |
| Ingest single event | &lt; 20 ms |
| Dashboard API | &lt; 100 ms |

## Design choices

- Single-process Node.js monolith — low latency for demo scale
- SQLite WAL — concurrent reads during writes
- Seeded Isolation Forest — reproducible, no cold-start ML service
- Model training in worker thread — non-blocking API
- SSE instead of WebSocket — simpler fan-out for demo

## Scale path

For production volume: PostgreSQL, event streaming (Kafka), horizontal API replicas, read replicas for investigation queries.
