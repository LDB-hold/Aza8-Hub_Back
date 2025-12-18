import 'dotenv/config';

import { PrismaClient, type Prisma } from '@prisma/client';
import { z } from 'zod';

type ParsedArgs = {
  tenantId?: string;
  packageKey?: string;
  adminEmail?: string;
  adminName?: string;
  allowProd?: boolean;
};

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {};

  for (let index = 0; index < argv.length; index += 1) {
    const part = argv[index];
    if (!part) continue;

    if (part === '--tenant' || part === '--tenantId') {
      args.tenantId = argv[index + 1];
      index += 1;
      continue;
    }

    if (part === '--package' || part === '--packageKey') {
      args.packageKey = argv[index + 1];
      index += 1;
      continue;
    }

    if (part === '--adminEmail') {
      args.adminEmail = argv[index + 1];
      index += 1;
      continue;
    }

    if (part === '--adminName') {
      args.adminName = argv[index + 1];
      index += 1;
      continue;
    }

    if (part === '--allow-prod') {
      args.allowProd = true;
      continue;
    }
  }

  return args;
}

const seedEnvSchema = z.object({
  NODE_ENV: z.string().optional(),
  DATABASE_URL: z.string().min(1),
});

const seedEnv = seedEnvSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  DATABASE_URL: process.env.DATABASE_URL,
});

type SeedToolAction = {
  key: string;
  name: string;
  description?: string;
};

type SeedTool = {
  key: string;
  name: string;
  description?: string;
  actions: SeedToolAction[];
};

type SeedPackage = {
  key: string;
  name: string;
  description?: string;
  toolActionKeys: string[];
};

const seedTools: SeedTool[] = [
  {
    key: 'tenants',
    name: 'Tenants',
    description: 'Onboarding e provisionamento de tenants',
    actions: [
      { key: 'tenants.create', name: 'Create tenant' },
      { key: 'tenants.packages.assign', name: 'Assign package to tenant' },
      { key: 'tenants.seeds.run', name: 'Run tenant base seeds' },
    ],
  },
  {
    key: 'catalog',
    name: 'Catalog',
    description: 'Catálogo global de ferramentas, ações e pacotes',
    actions: [
      { key: 'catalog.tools.create', name: 'Create tool' },
      { key: 'catalog.tools.read', name: 'List tools' },
      { key: 'catalog.tools.actions.create', name: 'Create tool action' },
      { key: 'catalog.packages.create', name: 'Create package' },
      { key: 'catalog.packages.read', name: 'List packages' },
      { key: 'catalog.packages.actions.set', name: 'Set package actions' },
    ],
  },
  {
    key: 'me',
    name: 'Me',
    actions: [{ key: 'me.read', name: 'Read own profile' }],
  },
  {
    key: 'rbac',
    name: 'RBAC',
    description: 'Usuários, grupos e permissões por tenant',
    actions: [
      { key: 'rbac.users.create', name: 'Create user' },
      { key: 'rbac.users.read', name: 'List users' },
      { key: 'rbac.users.update', name: 'Update user' },
      { key: 'rbac.users.status.update', name: 'Update user status' },
      { key: 'rbac.groups.create', name: 'Create group' },
      { key: 'rbac.groups.read', name: 'List groups' },
      { key: 'rbac.groups.update', name: 'Update group' },
      { key: 'rbac.groups.status.update', name: 'Update group status' },
      { key: 'rbac.groups.users.add', name: 'Add user to group' },
      { key: 'rbac.groups.users.remove', name: 'Remove user from group' },
      { key: 'rbac.groups.permissions.set', name: 'Set group permissions' },
      { key: 'rbac.groups.permissions.remove', name: 'Remove group permission' },
      { key: 'rbac.api_keys.create', name: 'Create API key' },
      { key: 'rbac.api_keys.read', name: 'List API keys' },
      { key: 'rbac.api_keys.status.update', name: 'Update API key status' },
    ],
  },
  {
    key: 'audit',
    name: 'Audit',
    actions: [{ key: 'audit.logs.read', name: 'Read audit logs' }],
  },
  {
    key: 'branding',
    name: 'Branding',
    actions: [
      { key: 'tenant.branding.read', name: 'Read branding' },
      { key: 'tenant.branding.write', name: 'Write branding' },
    ],
  },
  {
    key: 'config',
    name: 'Config',
    actions: [
      { key: 'tenant.config.read', name: 'Read config' },
      { key: 'tenant.config.write', name: 'Write config' },
    ],
  },
  {
    key: 'usage',
    name: 'Usage',
    actions: [{ key: 'usage.read', name: 'Read usage' }],
  },
  {
    key: 'metrics',
    name: 'Metrics',
    actions: [{ key: 'metrics.read', name: 'Read metrics' }],
  },
];

const tenantToolActionKeys: string[] = seedTools
  .flatMap((tool) => tool.actions.map((action) => action.key))
  .filter((key) => !key.startsWith('catalog.') && !key.startsWith('tenants.') && key !== 'metrics.read');

const viewerToolActionKeys: string[] = tenantToolActionKeys.filter((key) =>
  key.endsWith('.read')
);

const operatorToolActionKeys: string[] = [
  ...new Set([
    ...viewerToolActionKeys,
    'rbac.users.create',
    'rbac.groups.create',
    'rbac.groups.users.add',
    'rbac.groups.users.remove',
  ]),
];

const seedPackages: SeedPackage[] = [
  {
    key: 'mvp',
    name: 'MVP',
    description: 'Pacote base (MVP)',
    toolActionKeys: [...new Set([...tenantToolActionKeys, 'metrics.read'])],
  },
];

async function seedGlobal(prisma: PrismaClient): Promise<void> {
  for (const tool of seedTools) {
    const upsertedTool = await prisma.tool.upsert({
      where: { key: tool.key },
      create: {
        key: tool.key,
        name: tool.name,
        description: tool.description,
      },
      update: {
        name: tool.name,
        description: tool.description,
      },
    });

    for (const action of tool.actions) {
      await prisma.toolAction.upsert({
        where: { key: action.key },
        create: {
          key: action.key,
          name: action.name,
          description: action.description,
          toolId: upsertedTool.id,
        },
        update: {
          name: action.name,
          description: action.description,
          toolId: upsertedTool.id,
        },
      });
    }
  }

  for (const pkg of seedPackages) {
    const upsertedPackage = await prisma.package.upsert({
      where: { key: pkg.key },
      create: {
        key: pkg.key,
        name: pkg.name,
        description: pkg.description,
      },
      update: {
        name: pkg.name,
        description: pkg.description,
      },
    });

    const actions = await prisma.toolAction.findMany({
      where: { key: { in: pkg.toolActionKeys } },
      select: { id: true, key: true },
    });

    const missingKeys = pkg.toolActionKeys.filter(
      (key) => !actions.some((found) => found.key === key)
    );
    if (missingKeys.length > 0) {
      throw new Error(`Seed package "${pkg.key}" contains missing tool actions: ${missingKeys.join(', ')}`);
    }

    for (const action of actions) {
      await prisma.packageToolAction.upsert({
        where: {
          packageId_toolActionId: { packageId: upsertedPackage.id, toolActionId: action.id },
        },
        create: {
          packageId: upsertedPackage.id,
          toolActionId: action.id,
        },
        update: {},
      });
    }
  }
}

type TenantSeedInput = {
  tenantId: string;
  packageKey?: string;
  adminUser?: { email: string; name: string };
};

async function seedTenant(prisma: PrismaClient, input: TenantSeedInput): Promise<void> {
  const tenant = await prisma.tenant.findUnique({
    where: { id: input.tenantId },
    select: { id: true, status: true },
  });
  if (!tenant) throw new Error(`Tenant not found: ${input.tenantId}`);
  if (tenant.status !== 'ativo') throw new Error(`Tenant is not active: ${input.tenantId}`);

  let allowedToolActionKeys: string[] = tenantToolActionKeys;

  if (input.packageKey) {
    const pkg = await prisma.package.findUnique({
      where: { key: input.packageKey },
      select: { id: true },
    });
    if (!pkg) throw new Error(`Package not found: ${input.packageKey}`);

    await prisma.tenantPackage.upsert({
      where: { tenantId_packageId: { tenantId: input.tenantId, packageId: pkg.id } },
      create: { tenantId: input.tenantId, packageId: pkg.id },
      update: { status: 'ativo' },
    });

    const pkgActions = await prisma.packageToolAction.findMany({
      where: { packageId: pkg.id },
      select: { toolAction: { select: { key: true } } },
    });
    allowedToolActionKeys = pkgActions.map((row) => row.toolAction.key);
  }

  const [groupAdmin, groupOperator, groupViewer] = await Promise.all([
    prisma.group.upsert({
      where: { tenantId_name: { tenantId: input.tenantId, name: 'ADM_CLIENTE' } },
      create: { tenantId: input.tenantId, name: 'ADM_CLIENTE', description: 'Admin do tenant' },
      update: { description: 'Admin do tenant' },
    }),
    prisma.group.upsert({
      where: { tenantId_name: { tenantId: input.tenantId, name: 'OPERATOR' } },
      create: { tenantId: input.tenantId, name: 'OPERATOR', description: 'Operador do tenant' },
      update: { description: 'Operador do tenant' },
    }),
    prisma.group.upsert({
      where: { tenantId_name: { tenantId: input.tenantId, name: 'VIEWER' } },
      create: { tenantId: input.tenantId, name: 'VIEWER', description: 'Somente leitura' },
      update: { description: 'Somente leitura' },
    }),
  ]);

  const toolActions = await prisma.toolAction.findMany({
    where: { key: { in: allowedToolActionKeys } },
    select: { id: true, key: true },
  });

  const keyToId = new Map<string, string>(toolActions.map((row) => [row.key, row.id]));

  async function setGroupPermissions(groupId: string, toolActionKeys: string[]): Promise<void> {
    for (const key of toolActionKeys) {
      const toolActionId = keyToId.get(key);
      if (!toolActionId) continue;

      await prisma.groupPermission.upsert({
        where: {
          tenantId_groupId_toolActionId: {
            tenantId: input.tenantId,
            groupId,
            toolActionId,
          },
        },
        create: {
          tenantId: input.tenantId,
          groupId,
          toolActionId,
        },
        update: {},
      });
    }
  }

  await setGroupPermissions(groupAdmin.id, allowedToolActionKeys);
  await setGroupPermissions(
    groupOperator.id,
    operatorToolActionKeys.filter((key) => allowedToolActionKeys.includes(key))
  );
  await setGroupPermissions(
    groupViewer.id,
    viewerToolActionKeys.filter((key) => allowedToolActionKeys.includes(key))
  );

  if (input.adminUser) {
    const user = await prisma.user.upsert({
      where: { tenantId_email: { tenantId: input.tenantId, email: input.adminUser.email } },
      create: {
        tenantId: input.tenantId,
        email: input.adminUser.email,
        name: input.adminUser.name,
      },
      update: {
        name: input.adminUser.name,
        status: 'ativo',
        suspendedReason: null,
      },
    });

    await prisma.userGroup.upsert({
      where: {
        tenantId_userId_groupId: {
          tenantId: input.tenantId,
          userId: user.id,
          groupId: groupAdmin.id,
        },
      },
      create: {
        tenantId: input.tenantId,
        userId: user.id,
        groupId: groupAdmin.id,
      },
      update: {},
    });
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const nodeEnv = seedEnv.NODE_ENV ?? 'development';
  if (nodeEnv === 'production' && args.allowProd !== true) {
    throw new Error('Refusing to run seeds in production without --allow-prod');
  }

  const prisma = new PrismaClient();

  try {
    await seedGlobal(prisma);
    console.log('[seed] Global catalog seeded');

    if (args.tenantId) {
      const adminUser =
        args.adminEmail && args.adminName
          ? { email: args.adminEmail, name: args.adminName }
          : undefined;

      await seedTenant(prisma, {
        tenantId: args.tenantId,
        packageKey: args.packageKey,
        adminUser,
      });
      console.log(`[seed] Tenant seeded: ${args.tenantId}`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error('[seed] Failed', error);
  process.exitCode = 1;
});
