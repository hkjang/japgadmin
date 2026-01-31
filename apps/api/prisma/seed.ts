
import { PrismaClient, Environment, CloudProvider, InstanceRole, InstanceStatus, ConnectionMode, SslMode, ScopeType, ResourceType, ActionType } from '@prisma/client';

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

  // ==================== ROLES ====================

  const superAdminRole = await prisma.role.upsert({
    where: { name: 'Super Admin' },
    update: {},
    create: {
      name: 'Super Admin',
      description: 'System Administrator with full access',
      scopeType: ScopeType.GLOBAL,
      isSystem: true,
      permissions: {
        create: [
          { resource: ResourceType.CLUSTER, action: ActionType.ADMIN },
          { resource: ResourceType.INSTANCE, action: ActionType.ADMIN },
          { resource: ResourceType.DATABASE, action: ActionType.ADMIN },
          { resource: ResourceType.QUERY, action: ActionType.ADMIN },
          { resource: ResourceType.VACUUM, action: ActionType.ADMIN },
          { resource: ResourceType.SESSION, action: ActionType.ADMIN },
          { resource: ResourceType.ALERT, action: ActionType.ADMIN },
          { resource: ResourceType.CONFIG, action: ActionType.ADMIN },
          { resource: ResourceType.BACKUP, action: ActionType.ADMIN },
          { resource: ResourceType.USER, action: ActionType.ADMIN },
          { resource: ResourceType.ROLE, action: ActionType.ADMIN },
          { resource: ResourceType.AUDIT, action: ActionType.ADMIN },
          { resource: ResourceType.CREDENTIAL, action: ActionType.ADMIN },
        ],
      },
    },
  });

  console.log('Roles seeded.');

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

  // Assign Role
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: adminUser.id,
        roleId: superAdminRole.id,
      },
    },
    update: {},
    create: {
      userId: adminUser.id,
      roleId: superAdminRole.id,
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
