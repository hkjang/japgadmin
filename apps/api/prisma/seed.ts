
import { PrismaClient, Environment, CloudProvider, InstanceRole, InstanceStatus, ConnectionMode, SslMode } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding operational data...');

  // ==================== CLUSTERS ====================

  const productionCluster = await prisma.cluster.upsert({
    where: { name: 'Production Cluster' },
    update: {},
    create: {
      name: 'Production Cluster',
      description: 'Main production environment for core services',
      environment: Environment.PRODUCTION,
      cloudProvider: CloudProvider.ON_PREMISE,
      region: 'ap-northeast-2',
      tags: { department: 'platform', criticality: 'high' },
    },
  });

  const monitoringCluster = await prisma.cluster.upsert({
    where: { name: 'Monitoring Cluster' },
    update: {},
    create: {
      name: 'Monitoring Cluster',
      description: 'Cluster for observability stack (TimescaleDB, Grafana)',
      environment: Environment.PRODUCTION,
      cloudProvider: CloudProvider.ON_PREMISE,
      region: 'ap-northeast-2',
      tags: { department: 'sre', criticality: 'medium' },
    },
  });

  console.log('Clusters seeded.');

  // ==================== INSTANCES ====================

  // 1. Primary DB (target-db)
  await prisma.instance.upsert({
    where: {
      clusterId_name: {
        clusterId: productionCluster.id,
        name: 'Primary DB',
      },
    },
    update: {},
    create: {
      clusterId: productionCluster.id,
      name: 'Primary DB',
      host: 'localhost',
      port: 5434, // Mapped to 5434 in docker-compose
      role: InstanceRole.PRIMARY,
      status: InstanceStatus.UNKNOWN,
      pgVersion: 'PostgreSQL 15',
      extensions: ['pg_stat_statements'],
      connectionMode: ConnectionMode.DIRECT,
      sslMode: SslMode.PREFER,
    },
  });

  // 2. Standby DB (target-db-standby)
  await prisma.instance.upsert({
    where: {
      clusterId_name: {
        clusterId: productionCluster.id,
        name: 'Standby DB',
      },
    },
    update: {},
    create: {
      clusterId: productionCluster.id,
      name: 'Standby DB',
      host: 'localhost',
      port: 5435, // Mapped to 5435 in docker-compose
      role: InstanceRole.STANDBY,
      status: InstanceStatus.UNKNOWN,
      pgVersion: 'PostgreSQL 15',
      extensions: ['pg_stat_statements'],
      connectionMode: ConnectionMode.DIRECT,
      sslMode: SslMode.PREFER,
    },
  });

  // 3. Metrics DB (metrics-db)
  await prisma.instance.upsert({
    where: {
      clusterId_name: {
        clusterId: monitoringCluster.id,
        name: 'Metrics DB',
      },
    },
    update: {},
    create: {
      clusterId: monitoringCluster.id,
      name: 'Metrics DB',
      host: 'localhost',
      port: 5433, // Mapped to 5433 in docker-compose
      role: InstanceRole.PRIMARY,
      status: InstanceStatus.UNKNOWN,
      pgVersion: 'PostgreSQL 15 (TimescaleDB)',
      extensions: ['timescaledb', 'pg_stat_statements'],
      connectionMode: ConnectionMode.DIRECT,
      sslMode: SslMode.PREFER,
    },
  });

  console.log('Instances seeded.');

  // ==================== USERS ====================

  const adminPassword = await import('bcrypt').then((m) => m.hash('adminpassword', 12));

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      passwordHash: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      status: 'ACTIVE', // Using string literal if enum import is tricky, otherwise UserStatus.ACTIVE
      username: 'admin',
    },
  });

  console.log('Admin user seeded: admin@example.com / adminpassword');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
