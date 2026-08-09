type QueryEvent = {
  query: string;
  params: string;
  duration: number;
};

type PrismaQueryLogger = {
  $on: (event: 'query', callback: (event: QueryEvent) => void) => void;
};

export function attachPrismaSlowQueryLogger(
  prisma: PrismaQueryLogger,
  serviceName: string,
  thresholdMs = Number(process.env.PRISMA_SLOW_QUERY_MS || 250),
): void {
  if (!Number.isFinite(thresholdMs) || thresholdMs <= 0) return;
  prisma.$on('query', event => {
    if (event.duration < thresholdMs) return;
    console.warn(`[${serviceName}] slow prisma query`, {
      durationMs: event.duration,
      query: event.query,
      params: event.params,
    });
  });
}
