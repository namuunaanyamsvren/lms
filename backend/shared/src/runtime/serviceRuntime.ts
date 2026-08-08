import type { Express, Request, Response } from 'express';
import type { Server } from 'http';
import { registerMetricsRoute } from '../observability';
import { closeRabbitMQConnection, checkRabbitMQReady } from '../rabbitmq';
import { checkRedisReady, closeRedisClient } from '../redis';

export type RuntimeDependency = {
  name: string;
  check: () => Promise<void>;
  required?: boolean;
};

export type PrismaLikeClient = {
  $connect?: () => Promise<void>;
  $disconnect: () => Promise<void>;
  $queryRaw?: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown>;
};

export type ServiceRuntimeOptions = {
  app: Express;
  serviceName: string;
  port: number | string;
  logger: {
    info: (message: string, meta?: unknown) => void;
    warn?: (message: string, meta?: unknown) => void;
    error: (message: string, meta?: unknown) => void;
  };
  prisma?: PrismaLikeClient;
  dependencies?: RuntimeDependency[];
  startWorkers?: () => void | Promise<void>;
  shutdown?: Array<() => Promise<void>>;
  readinessTimeoutMs?: number;
  registerHealth?: boolean;
};

type DependencyStatus = {
  name: string;
  status: 'ok' | 'error';
  required: boolean;
  error?: string;
};

let shuttingDown = false;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: NodeJS.Timeout;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timeout));
}

export function prismaDependency(prisma: PrismaLikeClient): RuntimeDependency {
  return {
    name: 'prisma',
    required: true,
    check: async () => {
      if (prisma.$connect) await prisma.$connect();
      if (prisma.$queryRaw) await prisma.$queryRaw`SELECT 1`;
    },
  };
}

export function redisDependency(required = false): RuntimeDependency {
  return { name: 'redis', required, check: checkRedisReady };
}

export function rabbitMQDependency(required = false): RuntimeDependency {
  return { name: 'rabbitmq', required, check: checkRabbitMQReady };
}

export async function checkDependencies(
  dependencies: RuntimeDependency[],
  timeoutMs = 3000,
): Promise<DependencyStatus[]> {
  return Promise.all(dependencies.map(async dependency => {
    try {
      await withTimeout(dependency.check(), timeoutMs, dependency.name);
      return { name: dependency.name, status: 'ok', required: dependency.required !== false };
    } catch (error) {
      return {
        name: dependency.name,
        status: 'error',
        required: dependency.required !== false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }));
}

export function registerHealthRoutes(
  app: Express,
  serviceName: string,
  dependencies: RuntimeDependency[],
  readinessTimeoutMs = 3000,
): void {
  registerMetricsRoute(app, serviceName);

  app.get('/health/live', (_req: Request, res: Response) => {
    res.status(shuttingDown ? 503 : 200).json({
      status: shuttingDown ? 'shutting_down' : 'ok',
      service: serviceName,
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/health/ready', async (_req: Request, res: Response) => {
    const checks = await checkDependencies(dependencies, readinessTimeoutMs);
    const ready = !shuttingDown && checks.every(check => check.status === 'ok' || !check.required);
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ready' : 'not_ready',
      service: serviceName,
      timestamp: new Date().toISOString(),
      checks,
    });
  });

  app.get('/health', (_req: Request, res: Response) => {
    res.status(shuttingDown ? 503 : 200).json({
      status: shuttingDown ? 'shutting_down' : 'ok',
      service: serviceName,
      timestamp: new Date().toISOString(),
    });
  });
}

export async function startServiceRuntime(options: ServiceRuntimeOptions): Promise<Server> {
  const dependencies = [
    ...(options.prisma ? [prismaDependency(options.prisma)] : []),
    ...(options.dependencies || []),
  ];
  const readinessTimeoutMs = options.readinessTimeoutMs || 3000;
  if (options.registerHealth !== false) {
    registerHealthRoutes(options.app, options.serviceName, dependencies, readinessTimeoutMs);
  }

  const startupChecks = await checkDependencies(dependencies, readinessTimeoutMs);
  const failedRequired = startupChecks.filter(check => check.required && check.status !== 'ok');
  if (failedRequired.length) {
    options.logger.error(`${options.serviceName} startup dependency check failed`, { checks: startupChecks });
    throw new Error(`Required dependencies unavailable: ${failedRequired.map(check => check.name).join(', ')}`);
  }

  const server = options.app.listen(options.port, () => {
    options.logger.info(`${options.serviceName} running on port ${options.port}`);
  });

  if (options.startWorkers) {
    Promise.resolve(options.startWorkers()).catch(error => {
      options.logger.error(`${options.serviceName} worker startup failed`, { error: String(error) });
    });
  }

  const shutdown = async (signal: NodeJS.Signals) => {
    if (shuttingDown) return;
    shuttingDown = true;
    options.logger.info(`${options.serviceName} received ${signal}; shutting down`);
    server.close(async error => {
      if (error) options.logger.error(`${options.serviceName} HTTP server close failed`, { error: String(error) });
      for (const close of options.shutdown || []) await close();
      await closeRabbitMQConnection().catch(err => options.logger.error('RabbitMQ shutdown failed', { error: String(err) }));
      await closeRedisClient().catch(err => options.logger.error('Redis shutdown failed', { error: String(err) }));
      await options.prisma?.$disconnect().catch(err => options.logger.error('Prisma shutdown failed', { error: String(err) }));
      process.exit(error ? 1 : 0);
    });
  };

  process.once('SIGTERM', () => void shutdown('SIGTERM'));
  process.once('SIGINT', () => void shutdown('SIGINT'));
  return server;
}
