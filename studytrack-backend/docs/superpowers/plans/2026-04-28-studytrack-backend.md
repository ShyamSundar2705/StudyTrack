# StudyTrack Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready Fastify 5 + Prisma 7 + PostgreSQL REST + WebSocket backend for the StudyTrack study-session tracking app.

**Architecture:** Controllers contain business logic and import a shared Prisma singleton; routes register handlers + JSON schema validation + an auth preHandler; plugins register Fastify decorations (prisma, jwt, cors, socket.io). Server.ts wires everything together.

**Tech Stack:** Fastify 5, TypeScript (strict:false), Prisma 7 (prisma+postgres), @fastify/jwt, @fastify/cors, bcrypt, Socket.io, Jest + ts-jest

---

## File Map

```
<root>/
├── src/
│   ├── routes/           auth.ts, users.ts, subjects.ts, sessions.ts,
│   │                     stats.ts, tasks.ts, leaderboard.ts, achievements.ts
│   ├── controllers/      (same names, .controller.ts suffix)
│   ├── middleware/        auth.ts, errorHandler.ts
│   ├── plugins/           prisma.ts, jwt.ts, cors.ts, socket.ts
│   └── types/             index.ts
├── __tests__/
│   ├── helpers/           buildTestApp.ts
│   ├── auth.test.ts
│   ├── users.test.ts
│   ├── subjects.test.ts
│   ├── sessions.test.ts
│   ├── stats.test.ts
│   ├── tasks.test.ts
│   ├── leaderboard.test.ts
│   └── achievements.test.ts
├── server.ts
├── tsconfig.json
└── jest.config.js
```

---

## Task 0: Project scaffolding

**Files:**
- Create: `tsconfig.json`
- Create: `jest.config.js`
- Modify: `package.json`
- Modify: `.env`

- [ ] **Step 1: Install missing dependencies**

```bash
npm install bcrypt fastify-plugin
npm install --save-dev typescript ts-node @types/node @types/bcrypt jest ts-jest @types/jest
```

Expected: packages appear in `node_modules`, no errors.

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "strict": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "sourceMap": true
  },
  "include": ["src/**/*", "server.ts"],
  "exclude": ["node_modules", "dist", "__tests__"]
}
```

- [ ] **Step 3: Create jest.config.js**

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  globals: {
    'ts-jest': {
      tsconfig: {
        strict: false,
        esModuleInterop: true,
        skipLibCheck: true,
        module: 'commonjs'
      }
    }
  }
};
```

- [ ] **Step 4: Update package.json scripts**

Replace the `scripts` section with:

```json
"scripts": {
  "dev": "ts-node server.ts",
  "build": "tsc",
  "start": "node dist/server.js",
  "test": "jest",
  "prisma:generate": "prisma generate",
  "prisma:migrate": "prisma migrate dev"
}
```

- [ ] **Step 5: Add JWT_SECRET and PORT to .env**

Append to `.env`:
```
JWT_SECRET=supersecretkey_change_in_production
PORT=3000
```

- [ ] **Step 6: Create folder structure**

```bash
mkdir -p src/routes src/controllers src/middleware src/plugins src/types __tests__/helpers
```

Expected: all folders exist.

---

## Task 1: Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Replace prisma/schema.prisma with full schema**

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum SessionType {
  FOCUS
  POMODORO
}

enum AchievementType {
  FIRST_SESSION
  STREAK_3
  STREAK_7
  TOTAL_1H
  TOTAL_10H
  TOTAL_100H
  EARLY_BIRD
  NIGHT_OWL
}

model User {
  id               String        @id @default(cuid())
  email            String        @unique
  name             String
  handle           String        @unique
  avatar           String?
  passwordHash     String
  dailyGoalSeconds Int           @default(3600)
  createdAt        DateTime      @default(now())
  subjects         Subject[]
  sessions         Session[]
  tasks            Task[]
  achievements     Achievement[]
  groupMembers     GroupMember[]
}

model Subject {
  id        String    @id @default(cuid())
  userId    String
  name      String
  colorHex  String
  createdAt DateTime  @default(now())
  user      User      @relation(fields: [userId], references: [id])
  sessions  Session[]
  tasks     Task[]
}

model Session {
  id              String      @id @default(cuid())
  userId          String
  subjectId       String
  startedAt       DateTime    @default(now())
  endedAt         DateTime?
  durationSeconds Int?
  type            SessionType
  user            User        @relation(fields: [userId], references: [id])
  subject         Subject     @relation(fields: [subjectId], references: [id])
}

model Task {
  id          String    @id @default(cuid())
  userId      String
  title       String
  subjectId   String?
  dueDate     DateTime?
  completed   Boolean   @default(false)
  completedAt DateTime?
  carriedOver Boolean   @default(false)
  user        User      @relation(fields: [userId], references: [id])
  subject     Subject?  @relation(fields: [subjectId], references: [id])
}

model Achievement {
  id         String          @id @default(cuid())
  userId     String
  type       AchievementType
  unlockedAt DateTime        @default(now())
  user       User            @relation(fields: [userId], references: [id])
}

model Group {
  id        String        @id @default(cuid())
  name      String
  createdAt DateTime      @default(now())
  members   GroupMember[]
}

model GroupMember {
  id       String   @id @default(cuid())
  groupId  String
  userId   String
  joinedAt DateTime @default(now())
  group    Group    @relation(fields: [groupId], references: [id])
  user     User     @relation(fields: [userId], references: [id])
}
```

- [ ] **Step 2: Generate Prisma client**

```bash
npx prisma generate
```

Expected: `generated/prisma/` folder created at project root with the Prisma client.

- [ ] **Step 3: Run migration**

```bash
npx prisma migrate dev --name init
```

Expected: `prisma/migrations/` folder with an `init` migration; all tables created in the database.

---

## Task 2: Types and shared declarations

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Create src/types/index.ts**

```typescript
import { PrismaClient } from '../../generated/prisma';
import { Server as SocketServer } from 'socket.io';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
    io: SocketServer;
  }
  interface FastifyRequest {
    user: { id: string; email: string };
  }
}

export interface RegisterBody {
  email: string;
  name: string;
  handle: string;
  password: string;
}

export interface LoginBody {
  email: string;
  password: string;
}

export interface UpdatePreferencesBody {
  name?: string;
  handle?: string;
  avatar?: string;
  dailyGoalSeconds?: number;
}

export interface CreateSubjectBody {
  userId: string;
  name: string;
  colorHex: string;
}

export interface StartSessionBody {
  userId: string;
  subjectId: string;
  type: 'FOCUS' | 'POMODORO';
}

export interface CompleteSessionBody {
  endedAt: string;
  durationSeconds: number;
}

export interface UpdateSessionBody {
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  type?: 'FOCUS' | 'POMODORO';
}

export interface CreateTaskBody {
  userId: string;
  title: string;
  subjectId?: string;
  dueDate?: string;
}

export interface UpdateTaskBody {
  title?: string;
  completed?: boolean;
  completedAt?: string;
  carriedOver?: boolean;
  dueDate?: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add shared TypeScript types and Fastify module augmentation"
```

---

## Task 3: Plugins

**Files:**
- Create: `src/plugins/prisma.ts`
- Create: `src/plugins/jwt.ts`
- Create: `src/plugins/cors.ts`
- Create: `src/plugins/socket.ts`

- [ ] **Step 1: Create src/plugins/prisma.ts**

```typescript
import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { PrismaClient } from '../../generated/prisma';

export const prisma = new PrismaClient();

async function prismaPlugin(fastify: FastifyInstance) {
  fastify.decorate('prisma', prisma);
  fastify.addHook('onClose', async () => {
    await prisma.$disconnect();
  });
}

export default fp(prismaPlugin);
```

- [ ] **Step 2: Create src/plugins/jwt.ts**

```typescript
import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import { FastifyInstance } from 'fastify';

async function jwtPlugin(fastify: FastifyInstance) {
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET as string,
  });
}

export default fp(jwtPlugin);
```

- [ ] **Step 3: Create src/plugins/cors.ts**

```typescript
import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';
import { FastifyInstance } from 'fastify';

async function corsPlugin(fastify: FastifyInstance) {
  fastify.register(fastifyCors, { origin: '*' });
}

export default fp(corsPlugin);
```

- [ ] **Step 4: Create src/plugins/socket.ts**

```typescript
import fp from 'fastify-plugin';
import { FastifyInstance } from 'fastify';
import { Server as SocketServer } from 'socket.io';

async function socketPlugin(fastify: FastifyInstance) {
  const io = new SocketServer(fastify.server, {
    cors: { origin: '*' },
  });

  const groups = io.of('/groups');

  groups.on('connection', (socket) => {
    socket.on('join:group', ({ groupId }: { groupId: string }) => {
      socket.join(groupId);
    });
  });

  fastify.decorate('io', io);

  fastify.addHook('onClose', () => {
    io.close();
  });
}

export default fp(socketPlugin);
```

- [ ] **Step 5: Commit**

```bash
git add src/plugins/
git commit -m "feat: add prisma, jwt, cors, and socket.io plugins"
```

---

## Task 4: Middleware

**Files:**
- Create: `src/middleware/auth.ts`
- Create: `src/middleware/errorHandler.ts`

- [ ] **Step 1: Create src/middleware/auth.ts**

```typescript
import { FastifyRequest, FastifyReply } from 'fastify';

export async function verifyJWT(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ error: 'Unauthorized' });
  }
}
```

- [ ] **Step 2: Create src/middleware/errorHandler.ts**

```typescript
import { FastifyError, FastifyRequest, FastifyReply } from 'fastify';

export default function errorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply
) {
  // Prisma record not found
  if ((error as any).code === 'P2025' || error.message?.includes('P2025')) {
    return reply.code(404).send({ error: 'Not found' });
  }
  // Prisma unique constraint
  if ((error as any).code === 'P2002' || error.message?.includes('P2002')) {
    return reply.code(409).send({ error: 'Already exists' });
  }
  // Fastify validation errors
  if (error.statusCode === 400) {
    return reply.code(400).send({ error: error.message });
  }

  const status = error.statusCode && error.statusCode < 500 ? error.statusCode : 500;
  const message = status < 500 ? error.message : 'Internal server error';
  return reply.code(status).send({ error: message });
}
```

- [ ] **Step 3: Commit**

```bash
git add src/middleware/
git commit -m "feat: add JWT auth preHandler and global error handler"
```

---

## Task 5: Auth — controller, routes, tests

**Files:**
- Create: `src/controllers/auth.controller.ts`
- Create: `src/routes/auth.ts`
- Create: `__tests__/auth.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/auth.test.ts`:

```typescript
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  handle: 'testuser',
  avatar: null,
  passwordHash: '',
  dailyGoalSeconds: 3600,
  createdAt: new Date(),
};

jest.mock('../src/plugins/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { prisma } from '../src/plugins/prisma';
import * as AuthController from '../src/controllers/auth.controller';
import bcrypt from 'bcrypt';

const prismaMock = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe('AuthController.register', () => {
  it('creates a user and returns id + email', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    prismaMock.user.create.mockResolvedValue({ ...mockUser, passwordHash: 'hashed' });

    const result = await AuthController.register({
      email: 'test@example.com',
      name: 'Test User',
      handle: 'testuser',
      password: 'password123',
    });

    expect(prismaMock.user.create).toHaveBeenCalledTimes(1);
    expect(result.email).toBe('test@example.com');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('throws 409 if email already exists', async () => {
    prismaMock.user.findUnique.mockResolvedValue(mockUser);
    await expect(
      AuthController.register({ email: 'test@example.com', name: 'x', handle: 'x', password: 'x' })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

describe('AuthController.login', () => {
  it('returns user when credentials are valid', async () => {
    const hash = await bcrypt.hash('password123', 10);
    prismaMock.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash: hash });

    const result = await AuthController.login({ email: 'test@example.com', password: 'password123' });
    expect(result.email).toBe('test@example.com');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('throws 401 when password is wrong', async () => {
    const hash = await bcrypt.hash('correct', 10);
    prismaMock.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash: hash });
    await expect(
      AuthController.login({ email: 'test@example.com', password: 'wrong' })
    ).rejects.toMatchObject({ statusCode: 401 });
  });

  it('throws 401 when user not found', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(
      AuthController.login({ email: 'no@one.com', password: 'x' })
    ).rejects.toMatchObject({ statusCode: 401 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/auth.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../src/controllers/auth.controller'`

- [ ] **Step 3: Create src/controllers/auth.controller.ts**

```typescript
import bcrypt from 'bcrypt';
import { prisma } from '../plugins/prisma';
import { RegisterBody, LoginBody } from '../types';

function safeUser(user: any) {
  const { passwordHash, ...rest } = user;
  return rest;
}

function makeError(message: string, statusCode: number) {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export async function register(body: RegisterBody) {
  const existing = await prisma.user.findUnique({ where: { email: body.email } });
  if (existing) throw makeError('Email already in use', 409);

  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await prisma.user.create({
    data: {
      email: body.email,
      name: body.name,
      handle: body.handle,
      passwordHash,
    },
  });
  return safeUser(user);
}

export async function login(body: LoginBody) {
  const user = await prisma.user.findUnique({ where: { email: body.email } });
  if (!user) throw makeError('Invalid credentials', 401);

  const valid = await bcrypt.compare(body.password, user.passwordHash);
  if (!valid) throw makeError('Invalid credentials', 401);

  return safeUser(user);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/auth.test.ts --no-coverage
```

Expected: PASS (3 tests).

- [ ] **Step 5: Create src/routes/auth.ts**

```typescript
import { FastifyInstance } from 'fastify';
import * as AuthController from '../controllers/auth.controller';

const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'name', 'handle', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      name: { type: 'string', minLength: 1 },
      handle: { type: 'string', minLength: 1 },
      password: { type: 'string', minLength: 6 },
    },
  },
};

const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string' },
    },
  },
};

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post('/auth/register', { schema: registerSchema }, async (request, reply) => {
    const body = request.body as any;
    const user = await AuthController.register(body);
    const token = fastify.jwt.sign({ id: user.id, email: user.email });
    return reply.code(201).send({ data: { token, user } });
  });

  fastify.post('/auth/login', { schema: loginSchema }, async (request, reply) => {
    const body = request.body as any;
    const user = await AuthController.login(body);
    const token = fastify.jwt.sign({ id: user.id, email: user.email });
    return reply.code(200).send({ data: { token, user } });
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/controllers/auth.controller.ts src/routes/auth.ts __tests__/auth.test.ts
git commit -m "feat: add auth register and login endpoints"
```

---

## Task 6: Users — controller, routes, tests

**Files:**
- Create: `src/controllers/users.controller.ts`
- Create: `src/routes/users.ts`
- Create: `__tests__/users.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/users.test.ts`:

```typescript
const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  handle: 'testuser',
  avatar: null,
  dailyGoalSeconds: 3600,
  createdAt: new Date(),
};

jest.mock('../src/plugins/prisma', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

import { prisma } from '../src/plugins/prisma';
import * as UsersController from '../src/controllers/users.controller';

const prismaMock = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe('UsersController.getProfile', () => {
  it('returns user without passwordHash', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ ...mockUser, passwordHash: 'hash' });
    const result = await UsersController.getProfile('user-1');
    expect(result.id).toBe('user-1');
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('throws 404 when user not found', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null);
    await expect(UsersController.getProfile('no-one')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('UsersController.updatePreferences', () => {
  it('updates and returns user without passwordHash', async () => {
    prismaMock.user.update.mockResolvedValue({ ...mockUser, name: 'Updated', passwordHash: 'hash' });
    const result = await UsersController.updatePreferences('user-1', { name: 'Updated' });
    expect(result.name).toBe('Updated');
    expect(result).not.toHaveProperty('passwordHash');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/users.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../src/controllers/users.controller'`

- [ ] **Step 3: Create src/controllers/users.controller.ts**

```typescript
import { prisma } from '../plugins/prisma';
import { UpdatePreferencesBody } from '../types';

function safeUser(user: any) {
  const { passwordHash, ...rest } = user;
  return rest;
}

function makeError(message: string, statusCode: number) {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export async function getProfile(id: string) {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) throw makeError('User not found', 404);
  return safeUser(user);
}

export async function updatePreferences(id: string, body: UpdatePreferencesBody) {
  const user = await prisma.user.update({ where: { id }, data: body });
  return safeUser(user);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/users.test.ts --no-coverage
```

Expected: PASS (3 tests).

- [ ] **Step 5: Create src/routes/users.ts**

```typescript
import { FastifyInstance } from 'fastify';
import { verifyJWT } from '../middleware/auth';
import * as UsersController from '../controllers/users.controller';

const preferencesSchema = {
  body: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
      handle: { type: 'string', minLength: 1 },
      avatar: { type: 'string' },
      dailyGoalSeconds: { type: 'integer', minimum: 0 },
    },
  },
};

export default async function userRoutes(fastify: FastifyInstance) {
  fastify.get('/users/:id/profile', { preHandler: verifyJWT }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await UsersController.getProfile(id);
    return reply.send({ data: user });
  });

  fastify.patch('/users/:id/preferences', { preHandler: verifyJWT, schema: preferencesSchema }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const user = await UsersController.updatePreferences(id, body);
    return reply.send({ data: user });
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/controllers/users.controller.ts src/routes/users.ts __tests__/users.test.ts
git commit -m "feat: add user profile and preferences endpoints"
```

---

## Task 7: Subjects — controller, routes, tests

**Files:**
- Create: `src/controllers/subjects.controller.ts`
- Create: `src/routes/subjects.ts`
- Create: `__tests__/subjects.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/subjects.test.ts`:

```typescript
const mockSubject = {
  id: 'sub-1',
  userId: 'user-1',
  name: 'Math',
  colorHex: '#FF0000',
  createdAt: new Date(),
};

jest.mock('../src/plugins/prisma', () => ({
  prisma: {
    subject: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      delete: jest.fn(),
    },
  },
}));

import { prisma } from '../src/plugins/prisma';
import * as SubjectsController from '../src/controllers/subjects.controller';

const prismaMock = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe('SubjectsController.create', () => {
  it('creates and returns a subject', async () => {
    prismaMock.subject.create.mockResolvedValue(mockSubject);
    const result = await SubjectsController.create({ userId: 'user-1', name: 'Math', colorHex: '#FF0000' });
    expect(result.name).toBe('Math');
    expect(prismaMock.subject.create).toHaveBeenCalledTimes(1);
  });
});

describe('SubjectsController.list', () => {
  it('returns subjects for a user', async () => {
    prismaMock.subject.findMany.mockResolvedValue([mockSubject]);
    const result = await SubjectsController.list('user-1');
    expect(result).toHaveLength(1);
    expect(result[0].userId).toBe('user-1');
  });
});

describe('SubjectsController.remove', () => {
  it('deletes subject owned by user', async () => {
    prismaMock.subject.findFirst.mockResolvedValue(mockSubject);
    prismaMock.subject.delete.mockResolvedValue(mockSubject);
    await expect(SubjectsController.remove('sub-1', 'user-1')).resolves.not.toThrow();
  });

  it('throws 404 when subject not found or not owned', async () => {
    prismaMock.subject.findFirst.mockResolvedValue(null);
    await expect(SubjectsController.remove('sub-1', 'user-1')).rejects.toMatchObject({ statusCode: 404 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/subjects.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../src/controllers/subjects.controller'`

- [ ] **Step 3: Create src/controllers/subjects.controller.ts**

```typescript
import { prisma } from '../plugins/prisma';
import { CreateSubjectBody } from '../types';

function makeError(message: string, statusCode: number) {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export async function create(body: CreateSubjectBody) {
  return prisma.subject.create({
    data: { userId: body.userId, name: body.name, colorHex: body.colorHex },
  });
}

export async function list(userId: string) {
  return prisma.subject.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } });
}

export async function remove(id: string, userId: string) {
  const subject = await prisma.subject.findFirst({ where: { id, userId } });
  if (!subject) throw makeError('Subject not found', 404);
  await prisma.subject.delete({ where: { id } });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/subjects.test.ts --no-coverage
```

Expected: PASS (4 tests).

- [ ] **Step 5: Create src/routes/subjects.ts**

```typescript
import { FastifyInstance } from 'fastify';
import { verifyJWT } from '../middleware/auth';
import * as SubjectsController from '../controllers/subjects.controller';

const createSchema = {
  body: {
    type: 'object',
    required: ['userId', 'name', 'colorHex'],
    properties: {
      userId: { type: 'string' },
      name: { type: 'string', minLength: 1 },
      colorHex: { type: 'string', pattern: '^#[0-9A-Fa-f]{6}$' },
    },
  },
};

export default async function subjectRoutes(fastify: FastifyInstance) {
  fastify.post('/subjects', { preHandler: verifyJWT, schema: createSchema }, async (request, reply) => {
    const body = request.body as any;
    const subject = await SubjectsController.create(body);
    return reply.code(201).send({ data: subject });
  });

  fastify.get('/subjects', { preHandler: verifyJWT }, async (request, reply) => {
    const { userId } = request.query as { userId: string };
    const subjects = await SubjectsController.list(userId);
    return reply.send({ data: subjects });
  });

  fastify.delete('/subjects/:id', { preHandler: verifyJWT }, async (request, reply) => {
    const { id } = request.params as { id: string };
    await SubjectsController.remove(id, request.user.id);
    return reply.code(204).send();
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/controllers/subjects.controller.ts src/routes/subjects.ts __tests__/subjects.test.ts
git commit -m "feat: add subjects CRUD endpoints"
```

---

## Task 8: Sessions — controller, routes, tests

**Files:**
- Create: `src/controllers/sessions.controller.ts`
- Create: `src/routes/sessions.ts`
- Create: `__tests__/sessions.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/sessions.test.ts`:

```typescript
const mockSession = {
  id: 'sess-1',
  userId: 'user-1',
  subjectId: 'sub-1',
  startedAt: new Date(),
  endedAt: null,
  durationSeconds: null,
  type: 'FOCUS',
};

jest.mock('../src/plugins/prisma', () => ({
  prisma: {
    session: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    achievement: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
    groupMember: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '../src/plugins/prisma';
import * as SessionsController from '../src/controllers/sessions.controller';

const prismaMock = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe('SessionsController.start', () => {
  it('creates a session with startedAt', async () => {
    prismaMock.session.create.mockResolvedValue(mockSession);
    const result = await SessionsController.start({ userId: 'user-1', subjectId: 'sub-1', type: 'FOCUS' });
    expect(result.type).toBe('FOCUS');
    expect(prismaMock.session.create).toHaveBeenCalledTimes(1);
  });
});

describe('SessionsController.complete', () => {
  it('updates session and checks achievements', async () => {
    const completed = { ...mockSession, endedAt: new Date(), durationSeconds: 1800 };
    prismaMock.session.findUnique.mockResolvedValue(mockSession);
    prismaMock.session.update.mockResolvedValue(completed);
    prismaMock.achievement.findMany.mockResolvedValue([]);
    prismaMock.session.aggregate.mockResolvedValue({ _sum: { durationSeconds: 1800 } });
    prismaMock.session.findMany.mockResolvedValue([]); // getStreak needs this
    prismaMock.achievement.createMany.mockResolvedValue({ count: 1 });
    prismaMock.groupMember.findMany.mockResolvedValue([]);

    const result = await SessionsController.complete('sess-1', {
      endedAt: new Date().toISOString(),
      durationSeconds: 1800,
    });

    expect(result.session.durationSeconds).toBe(1800);
    expect(prismaMock.session.update).toHaveBeenCalledTimes(1);
  });

  it('throws 404 if session not found', async () => {
    prismaMock.session.findUnique.mockResolvedValue(null);
    await expect(
      SessionsController.complete('no-session', { endedAt: new Date().toISOString(), durationSeconds: 0 })
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('SessionsController.list', () => {
  it('returns sessions for a user', async () => {
    prismaMock.session.findMany.mockResolvedValue([mockSession]);
    const result = await SessionsController.list('user-1', undefined);
    expect(result).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/sessions.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../src/controllers/sessions.controller'`

- [ ] **Step 3: Create src/controllers/sessions.controller.ts**

```typescript
import { prisma } from '../plugins/prisma';
import { StartSessionBody, CompleteSessionBody, UpdateSessionBody } from '../types';
import { AchievementType } from '../../generated/prisma';

function makeError(message: string, statusCode: number) {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
}

export async function start(body: StartSessionBody) {
  return prisma.session.create({
    data: {
      userId: body.userId,
      subjectId: body.subjectId,
      type: body.type,
    },
  });
}

export async function update(id: string, body: UpdateSessionBody) {
  return prisma.session.update({ where: { id }, data: body as any });
}

export async function complete(id: string, body: CompleteSessionBody) {
  const session = await prisma.session.findUnique({ where: { id } });
  if (!session) throw makeError('Session not found', 404);

  const updated = await prisma.session.update({
    where: { id },
    data: {
      endedAt: new Date(body.endedAt),
      durationSeconds: body.durationSeconds,
    },
  });

  const newAchievements = await checkAchievements(session.userId, updated);

  return { session: updated, newAchievements };
}

export async function list(userId: string, subjectId?: string) {
  return prisma.session.findMany({
    where: { userId, ...(subjectId ? { subjectId } : {}) },
    orderBy: { startedAt: 'desc' },
  });
}

async function checkAchievements(userId: string, session: any): Promise<AchievementType[]> {
  const existing = await prisma.achievement.findMany({ where: { userId } });
  const existingTypes = new Set(existing.map((a) => a.type));
  const toUnlock: AchievementType[] = [];

  if (!existingTypes.has('FIRST_SESSION')) toUnlock.push('FIRST_SESSION');

  const totals = await prisma.session.aggregate({
    where: { userId, durationSeconds: { not: null } },
    _sum: { durationSeconds: true },
  });
  const totalSec = totals._sum.durationSeconds || 0;
  if (totalSec >= 3600 && !existingTypes.has('TOTAL_1H')) toUnlock.push('TOTAL_1H');
  if (totalSec >= 36000 && !existingTypes.has('TOTAL_10H')) toUnlock.push('TOTAL_10H');
  if (totalSec >= 360000 && !existingTypes.has('TOTAL_100H')) toUnlock.push('TOTAL_100H');

  const hour = new Date(session.startedAt).getHours();
  if (hour < 7 && !existingTypes.has('EARLY_BIRD')) toUnlock.push('EARLY_BIRD');
  if (hour >= 22 && !existingTypes.has('NIGHT_OWL')) toUnlock.push('NIGHT_OWL');

  const streak = await getStreak(userId);
  if (streak >= 3 && !existingTypes.has('STREAK_3')) toUnlock.push('STREAK_3');
  if (streak >= 7 && !existingTypes.has('STREAK_7')) toUnlock.push('STREAK_7');

  if (toUnlock.length > 0) {
    await prisma.achievement.createMany({
      data: toUnlock.map((type) => ({ userId, type })),
    });
  }

  return toUnlock;
}

async function getStreak(userId: string): Promise<number> {
  const sessions = await prisma.session.findMany({
    where: { userId, endedAt: { not: null } },
    select: { startedAt: true },
    orderBy: { startedAt: 'desc' },
  });

  if (sessions.length === 0) return 0;

  const uniqueDates = [
    ...new Set(sessions.map((s) => s.startedAt.toISOString().split('T')[0])),
  ].sort().reverse();

  let streak = 1;
  for (let i = 0; i < uniqueDates.length - 1; i++) {
    const curr = new Date(uniqueDates[i]);
    const prev = new Date(uniqueDates[i + 1]);
    const diffDays = (curr.getTime() - prev.getTime()) / 86400000;
    if (Math.round(diffDays) === 1) streak++;
    else break;
  }
  return streak;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/sessions.test.ts --no-coverage
```

Expected: PASS (4 tests).

- [ ] **Step 5: Create src/routes/sessions.ts**

```typescript
import { FastifyInstance } from 'fastify';
import { verifyJWT } from '../middleware/auth';
import * as SessionsController from '../controllers/sessions.controller';
import * as LeaderboardController from '../controllers/leaderboard.controller';

const startSchema = {
  body: {
    type: 'object',
    required: ['userId', 'subjectId', 'type'],
    properties: {
      userId: { type: 'string' },
      subjectId: { type: 'string' },
      type: { type: 'string', enum: ['FOCUS', 'POMODORO'] },
    },
  },
};

const completeSchema = {
  body: {
    type: 'object',
    required: ['endedAt', 'durationSeconds'],
    properties: {
      endedAt: { type: 'string' },
      durationSeconds: { type: 'integer', minimum: 0 },
    },
  },
};

const updateSchema = {
  body: {
    type: 'object',
    properties: {
      startedAt: { type: 'string' },
      endedAt: { type: 'string' },
      durationSeconds: { type: 'integer', minimum: 0 },
      type: { type: 'string', enum: ['FOCUS', 'POMODORO'] },
    },
  },
};

export default async function sessionRoutes(fastify: FastifyInstance) {
  fastify.post('/sessions/start', { preHandler: verifyJWT, schema: startSchema }, async (request, reply) => {
    const body = request.body as any;
    const session = await SessionsController.start(body);
    return reply.code(201).send({ data: session });
  });

  fastify.patch('/sessions/:id', { preHandler: verifyJWT, schema: updateSchema }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const session = await SessionsController.update(id, body);
    return reply.send({ data: session });
  });

  fastify.post('/sessions/:id/complete', { preHandler: verifyJWT, schema: completeSchema }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const result = await SessionsController.complete(id, body);

    // Emit socket events to all groups the user belongs to
    const memberships = await fastify.prisma.groupMember.findMany({
      where: { userId: result.session.userId },
    });
    for (const m of memberships) {
      fastify.io.of('/groups').to(m.groupId).emit('session:completed', {
        userId: result.session.userId,
        subjectId: result.session.subjectId,
        durationSeconds: result.session.durationSeconds,
      });
      const leaderboard = await LeaderboardController.getGroupLeaderboard(m.groupId);
      fastify.io.of('/groups').to(m.groupId).emit('leaderboard:updated', leaderboard);
    }

    return reply.send({ data: result });
  });

  fastify.get('/sessions', { preHandler: verifyJWT }, async (request, reply) => {
    const { userId, subjectId } = request.query as { userId: string; subjectId?: string };
    const sessions = await SessionsController.list(userId, subjectId);
    return reply.send({ data: sessions });
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/controllers/sessions.controller.ts src/routes/sessions.ts __tests__/sessions.test.ts
git commit -m "feat: add sessions endpoints with achievement unlock logic"
```

---

## Task 9: Stats heatmap — controller, routes, tests

**Files:**
- Create: `src/controllers/stats.controller.ts`
- Create: `src/routes/stats.ts`
- Create: `__tests__/stats.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/stats.test.ts`:

```typescript
jest.mock('../src/plugins/prisma', () => ({
  prisma: {
    session: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '../src/plugins/prisma';
import * as StatsController from '../src/controllers/stats.controller';

const prismaMock = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe('StatsController.heatmap', () => {
  it('returns daily second totals keyed by YYYY-MM-DD', async () => {
    prismaMock.session.findMany.mockResolvedValue([
      { startedAt: new Date('2026-04-10T09:00:00Z'), durationSeconds: 1800 },
      { startedAt: new Date('2026-04-10T14:00:00Z'), durationSeconds: 900 },
      { startedAt: new Date('2026-04-11T10:00:00Z'), durationSeconds: 3600 },
    ]);

    const result = await StatsController.heatmap('user-1', '2026-04');
    expect(result['2026-04-10']).toBe(2700);
    expect(result['2026-04-11']).toBe(3600);
  });

  it('returns empty object when no sessions', async () => {
    prismaMock.session.findMany.mockResolvedValue([]);
    const result = await StatsController.heatmap('user-1', '2026-04');
    expect(result).toEqual({});
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/stats.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../src/controllers/stats.controller'`

- [ ] **Step 3: Create src/controllers/stats.controller.ts**

```typescript
import { prisma } from '../plugins/prisma';

export async function heatmap(userId: string, month: string): Promise<Record<string, number>> {
  const [year, mon] = month.split('-').map(Number);
  const start = new Date(year, mon - 1, 1);
  const end = new Date(year, mon, 1);

  const sessions = await prisma.session.findMany({
    where: {
      userId,
      startedAt: { gte: start, lt: end },
      durationSeconds: { not: null },
    },
    select: { startedAt: true, durationSeconds: true },
  });

  const result: Record<string, number> = {};
  for (const session of sessions) {
    const date = session.startedAt.toISOString().split('T')[0];
    result[date] = (result[date] || 0) + (session.durationSeconds || 0);
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/stats.test.ts --no-coverage
```

Expected: PASS (2 tests).

- [ ] **Step 5: Create src/routes/stats.ts**

```typescript
import { FastifyInstance } from 'fastify';
import { verifyJWT } from '../middleware/auth';
import * as StatsController from '../controllers/stats.controller';

export default async function statsRoutes(fastify: FastifyInstance) {
  fastify.get('/stats/heatmap', { preHandler: verifyJWT }, async (request, reply) => {
    const { userId, month } = request.query as { userId: string; month: string };
    if (!userId || !month) {
      return reply.code(400).send({ error: 'userId and month (YYYY-MM) are required' });
    }
    const data = await StatsController.heatmap(userId, month);
    return reply.send({ data });
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/controllers/stats.controller.ts src/routes/stats.ts __tests__/stats.test.ts
git commit -m "feat: add stats heatmap endpoint"
```

---

## Task 10: Tasks — controller, routes, tests

**Files:**
- Create: `src/controllers/tasks.controller.ts`
- Create: `src/routes/tasks.ts`
- Create: `__tests__/tasks.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/tasks.test.ts`:

```typescript
const mockTask = {
  id: 'task-1',
  userId: 'user-1',
  title: 'Read chapter 3',
  subjectId: null,
  dueDate: new Date('2026-04-30'),
  completed: false,
  completedAt: null,
  carriedOver: false,
};

jest.mock('../src/plugins/prisma', () => ({
  prisma: {
    task: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from '../src/plugins/prisma';
import * as TasksController from '../src/controllers/tasks.controller';

const prismaMock = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe('TasksController.list', () => {
  it('returns tasks for user on date', async () => {
    prismaMock.task.findMany.mockResolvedValue([mockTask]);
    const result = await TasksController.list('user-1', '2026-04-30');
    expect(result).toHaveLength(1);
  });

  it('returns all tasks when no date', async () => {
    prismaMock.task.findMany.mockResolvedValue([mockTask]);
    const result = await TasksController.list('user-1', undefined);
    expect(prismaMock.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } })
    );
  });
});

describe('TasksController.create', () => {
  it('creates a task', async () => {
    prismaMock.task.create.mockResolvedValue(mockTask);
    const result = await TasksController.create({ userId: 'user-1', title: 'Read chapter 3' });
    expect(result.title).toBe('Read chapter 3');
  });
});

describe('TasksController.update', () => {
  it('updates a task', async () => {
    prismaMock.task.update.mockResolvedValue({ ...mockTask, completed: true });
    const result = await TasksController.update('task-1', { completed: true });
    expect(result.completed).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/tasks.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../src/controllers/tasks.controller'`

- [ ] **Step 3: Create src/controllers/tasks.controller.ts**

```typescript
import { prisma } from '../plugins/prisma';
import { CreateTaskBody, UpdateTaskBody } from '../types';

export async function list(userId: string, date?: string) {
  if (!date) {
    return prisma.task.findMany({ where: { userId }, orderBy: { dueDate: 'asc' } });
  }

  const day = new Date(date);
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  return prisma.task.findMany({
    where: {
      userId,
      dueDate: { gte: day, lt: nextDay },
    },
    orderBy: { dueDate: 'asc' },
  });
}

export async function create(body: CreateTaskBody) {
  return prisma.task.create({
    data: {
      userId: body.userId,
      title: body.title,
      ...(body.subjectId ? { subjectId: body.subjectId } : {}),
      ...(body.dueDate ? { dueDate: new Date(body.dueDate) } : {}),
    },
  });
}

export async function update(id: string, body: UpdateTaskBody) {
  return prisma.task.update({
    where: { id },
    data: {
      ...body,
      ...(body.completedAt ? { completedAt: new Date(body.completedAt) } : {}),
      ...(body.dueDate ? { dueDate: new Date(body.dueDate) } : {}),
    } as any,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/tasks.test.ts --no-coverage
```

Expected: PASS (4 tests).

- [ ] **Step 5: Create src/routes/tasks.ts**

```typescript
import { FastifyInstance } from 'fastify';
import { verifyJWT } from '../middleware/auth';
import * as TasksController from '../controllers/tasks.controller';

const createSchema = {
  body: {
    type: 'object',
    required: ['userId', 'title'],
    properties: {
      userId: { type: 'string' },
      title: { type: 'string', minLength: 1 },
      subjectId: { type: 'string' },
      dueDate: { type: 'string' },
    },
  },
};

const updateSchema = {
  body: {
    type: 'object',
    properties: {
      title: { type: 'string', minLength: 1 },
      completed: { type: 'boolean' },
      completedAt: { type: 'string' },
      carriedOver: { type: 'boolean' },
      dueDate: { type: 'string' },
    },
  },
};

export default async function taskRoutes(fastify: FastifyInstance) {
  fastify.get('/tasks', { preHandler: verifyJWT }, async (request, reply) => {
    const { userId, date } = request.query as { userId: string; date?: string };
    const tasks = await TasksController.list(userId, date);
    return reply.send({ data: tasks });
  });

  fastify.post('/tasks', { preHandler: verifyJWT, schema: createSchema }, async (request, reply) => {
    const body = request.body as any;
    const task = await TasksController.create(body);
    return reply.code(201).send({ data: task });
  });

  fastify.patch('/tasks/:id', { preHandler: verifyJWT, schema: updateSchema }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = request.body as any;
    const task = await TasksController.update(id, body);
    return reply.send({ data: task });
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/controllers/tasks.controller.ts src/routes/tasks.ts __tests__/tasks.test.ts
git commit -m "feat: add tasks CRUD endpoints"
```

---

## Task 11: Leaderboard — controller, routes, tests

**Files:**
- Create: `src/controllers/leaderboard.controller.ts`
- Create: `src/routes/leaderboard.ts`
- Create: `__tests__/leaderboard.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/leaderboard.test.ts`:

```typescript
jest.mock('../src/plugins/prisma', () => ({
  prisma: {
    groupMember: {
      findMany: jest.fn(),
    },
    session: {
      aggregate: jest.fn(),
    },
  },
}));

import { prisma } from '../src/plugins/prisma';
import * as LeaderboardController from '../src/controllers/leaderboard.controller';

const prismaMock = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe('LeaderboardController.getGroupLeaderboard', () => {
  it('returns members ranked by totalSeconds descending', async () => {
    prismaMock.groupMember.findMany.mockResolvedValue([
      { userId: 'user-1', user: { name: 'Alice', handle: 'alice', avatar: null } },
      { userId: 'user-2', user: { name: 'Bob', handle: 'bob', avatar: null } },
    ]);
    prismaMock.session.aggregate
      .mockResolvedValueOnce({ _sum: { durationSeconds: 7200 } }) // Alice
      .mockResolvedValueOnce({ _sum: { durationSeconds: 3600 } }); // Bob

    const result = await LeaderboardController.getGroupLeaderboard('group-1');
    expect(result[0].name).toBe('Alice');
    expect(result[0].totalSeconds).toBe(7200);
    expect(result[1].totalSeconds).toBe(3600);
  });

  it('returns empty array for empty group', async () => {
    prismaMock.groupMember.findMany.mockResolvedValue([]);
    const result = await LeaderboardController.getGroupLeaderboard('group-1');
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/leaderboard.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../src/controllers/leaderboard.controller'`

- [ ] **Step 3: Create src/controllers/leaderboard.controller.ts**

```typescript
import { prisma } from '../plugins/prisma';

export async function getGroupLeaderboard(groupId: string) {
  const members = await prisma.groupMember.findMany({
    where: { groupId },
    include: { user: true },
  });

  if (members.length === 0) return [];

  const startOfWeek = new Date();
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const entries = await Promise.all(
    members.map(async (m) => {
      const agg = await prisma.session.aggregate({
        where: {
          userId: m.userId,
          startedAt: { gte: startOfWeek },
          durationSeconds: { not: null },
        },
        _sum: { durationSeconds: true },
      });
      return {
        userId: m.userId,
        name: m.user.name,
        handle: m.user.handle,
        avatar: m.user.avatar,
        totalSeconds: agg._sum.durationSeconds || 0,
      };
    })
  );

  return entries.sort((a, b) => b.totalSeconds - a.totalSeconds);
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/leaderboard.test.ts --no-coverage
```

Expected: PASS (2 tests).

- [ ] **Step 5: Create src/routes/leaderboard.ts**

```typescript
import { FastifyInstance } from 'fastify';
import { verifyJWT } from '../middleware/auth';
import * as LeaderboardController from '../controllers/leaderboard.controller';

export default async function leaderboardRoutes(fastify: FastifyInstance) {
  fastify.get('/leaderboard', { preHandler: verifyJWT }, async (request, reply) => {
    const { scope, groupId } = request.query as { scope: string; groupId?: string };

    if (scope === 'group') {
      if (!groupId) return reply.code(400).send({ error: 'groupId is required for scope=group' });
      const data = await LeaderboardController.getGroupLeaderboard(groupId);
      return reply.send({ data });
    }

    return reply.code(400).send({ error: 'Unsupported scope' });
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/controllers/leaderboard.controller.ts src/routes/leaderboard.ts __tests__/leaderboard.test.ts
git commit -m "feat: add group leaderboard endpoint"
```

---

## Task 12: Achievements — controller, routes, tests

**Files:**
- Create: `src/controllers/achievements.controller.ts`
- Create: `src/routes/achievements.ts`
- Create: `__tests__/achievements.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `__tests__/achievements.test.ts`:

```typescript
jest.mock('../src/plugins/prisma', () => ({
  prisma: {
    achievement: {
      findMany: jest.fn(),
    },
  },
}));

import { prisma } from '../src/plugins/prisma';
import * as AchievementsController from '../src/controllers/achievements.controller';

const prismaMock = prisma as any;

beforeEach(() => jest.clearAllMocks());

describe('AchievementsController.list', () => {
  it('returns achievements for a user', async () => {
    const mock = [
      { id: 'ach-1', userId: 'user-1', type: 'FIRST_SESSION', unlockedAt: new Date() },
    ];
    prismaMock.achievement.findMany.mockResolvedValue(mock);
    const result = await AchievementsController.list('user-1');
    expect(result).toHaveLength(1);
    expect(result[0].type).toBe('FIRST_SESSION');
  });

  it('returns empty array when no achievements', async () => {
    prismaMock.achievement.findMany.mockResolvedValue([]);
    const result = await AchievementsController.list('user-1');
    expect(result).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest __tests__/achievements.test.ts --no-coverage
```

Expected: FAIL — `Cannot find module '../src/controllers/achievements.controller'`

- [ ] **Step 3: Create src/controllers/achievements.controller.ts**

```typescript
import { prisma } from '../plugins/prisma';

export async function list(userId: string) {
  return prisma.achievement.findMany({
    where: { userId },
    orderBy: { unlockedAt: 'desc' },
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest __tests__/achievements.test.ts --no-coverage
```

Expected: PASS (2 tests).

- [ ] **Step 5: Create src/routes/achievements.ts**

```typescript
import { FastifyInstance } from 'fastify';
import { verifyJWT } from '../middleware/auth';
import * as AchievementsController from '../controllers/achievements.controller';

export default async function achievementRoutes(fastify: FastifyInstance) {
  fastify.get('/users/:id/achievements', { preHandler: verifyJWT }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const data = await AchievementsController.list(id);
    return reply.send({ data });
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add src/controllers/achievements.controller.ts src/routes/achievements.ts __tests__/achievements.test.ts
git commit -m "feat: add achievements endpoint"
```

---

## Task 13: Server entry point — wire everything together

**Files:**
- Create: `server.ts`

- [ ] **Step 1: Create server.ts**

```typescript
import 'dotenv/config';
import Fastify from 'fastify';
import errorHandler from './src/middleware/errorHandler';
import prismaPlugin from './src/plugins/prisma';
import jwtPlugin from './src/plugins/jwt';
import corsPlugin from './src/plugins/cors';
import socketPlugin from './src/plugins/socket';
import authRoutes from './src/routes/auth';
import userRoutes from './src/routes/users';
import subjectRoutes from './src/routes/subjects';
import sessionRoutes from './src/routes/sessions';
import statsRoutes from './src/routes/stats';
import taskRoutes from './src/routes/tasks';
import leaderboardRoutes from './src/routes/leaderboard';
import achievementRoutes from './src/routes/achievements';

const server = Fastify({ logger: true });

async function start() {
  server.setErrorHandler(errorHandler);

  await server.register(corsPlugin);
  await server.register(jwtPlugin);
  await server.register(prismaPlugin);
  await server.register(socketPlugin);

  await server.register(authRoutes, { prefix: '/api' });
  await server.register(userRoutes, { prefix: '/api' });
  await server.register(subjectRoutes, { prefix: '/api' });
  await server.register(sessionRoutes, { prefix: '/api' });
  await server.register(statsRoutes, { prefix: '/api' });
  await server.register(taskRoutes, { prefix: '/api' });
  await server.register(leaderboardRoutes, { prefix: '/api' });
  await server.register(achievementRoutes, { prefix: '/api' });

  const port = Number(process.env.PORT) || 3000;
  await server.listen({ port, host: '0.0.0.0' });
}

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run all tests to confirm everything passes**

```bash
npx jest --no-coverage
```

Expected: all test suites pass.

- [ ] **Step 3: Start dev server and verify it boots**

```bash
npx ts-node server.ts
```

Expected: Fastify logs `Server listening at http://0.0.0.0:3000` with no errors.

- [ ] **Step 4: Smoke test auth endpoints**

```bash
curl -s -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@test.com","name":"Dev User","handle":"devuser","password":"password123"}' | python -m json.tool
```

Expected: `{ "data": { "token": "...", "user": { "id": "...", "email": "dev@test.com", ... } } }`

```bash
curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"dev@test.com","password":"password123"}' | python -m json.tool
```

Expected: `{ "data": { "token": "...", "user": { ... } } }`

- [ ] **Step 5: Commit**

```bash
git add server.ts
git commit -m "feat: wire all routes and plugins into server entry point"
```
