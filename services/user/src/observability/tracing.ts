import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { env } from '../config/env.js';
import { logger } from './logger.js';

export function normalizeOtlpHttpEndpoint(raw: string): string {
  let base = raw.trim();
  if (!/^https?:\/\//i.test(base)) {
    base = `http://${base}`;
  }
  // Collector exposes gRPC on :4317 and HTTP on :4318; the shared
  // OTEL_EXPORTER_OTLP_ENDPOINT may point at either. User needs HTTP.
  base = base.replace(/:4317(\/|$)/, ':4318$1');
  // Bare host without port defaults to collector HTTP :4318.
  const m = base.match(/^(https?:\/\/[^/:]+)(\/|$)/i);
  if (m) {
    base = base.replace(m[1], `${m[1]}:4318`);
  }
  return base;
}

export function setupTracing(): void {
  if (!env.OTEL_EXPORTER_OTLP_ENDPOINT) {
    logger.info('tracing disabled: OTEL_EXPORTER_OTLP_ENDPOINT not set');
    return;
  }

  const exporter = new OTLPTraceExporter({
    url: new URL('/v1/traces', normalizeOtlpHttpEndpoint(env.OTEL_EXPORTER_OTLP_ENDPOINT)).toString(),
  });

  const sdk = new NodeSDK({
    serviceName: env.OTEL_SERVICE_NAME,
    spanProcessors: [new BatchSpanProcessor(exporter)],
    instrumentations: [new HttpInstrumentation(), new IORedisInstrumentation(), new PgInstrumentation()],
  });

  sdk.start();
  logger.info('tracing enabled: exporting to %s', env.OTEL_EXPORTER_OTLP_ENDPOINT);
}
