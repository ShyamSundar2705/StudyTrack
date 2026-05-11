import { FastifyRequest, FastifyReply } from 'fastify'

export async function listTasks(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id
  const { date } = request.query as { date?: string }
  const prisma = request.server.prisma

  if (!date) {
    const tasks = await prisma.task.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send({ data: { tasks } })
  }

  // Day of week: use noon UTC to avoid DST edge cases (0=Sun…6=Sat)
  const dayOfWeek = new Date(`${date}T12:00:00.000Z`).getUTCDay()

  // Compute half-open date range [date, next day)
  const nextDate = new Date(`${date}T00:00:00.000Z`)
  nextDate.setUTCDate(nextDate.getUTCDate() + 1)

  const [dateTasks, recurringTasks] = await Promise.all([
    prisma.task.findMany({
      where: {
        userId,
        isRecurring: false,
        dueDate: {
          gte: new Date(`${date}T00:00:00.000Z`),
          lt: nextDate,
        },
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.task.findMany({
      where: {
        userId,
        isRecurring: true,
        recurringDays: { has: dayOfWeek },
      },
      include: {
        completions: { where: { date, userId } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const recurringWithCompletion = recurringTasks.map((task) => {
    const completion = task.completions[0] ?? null
    const { completions, ...rest } = task
    return {
      ...rest,
      completedOnDate: completion !== null,
      completedAtOnDate: completion?.completedAt?.toISOString() ?? null,
    }
  })

  return reply.send({ data: { tasks: [...dateTasks, ...recurringWithCompletion] } })
}

export async function createTask(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id
  const { title, subjectId, dueDate } = request.body as {
    title: string
    subjectId?: string
    dueDate?: string
  }

  const prisma = request.server.prisma
  const task = await prisma.task.create({
    data: {
      userId,
      title,
      subjectId,
      ...(dueDate ? { dueDate: new Date(dueDate) } : {})
    }
  })

  return reply.status(201).send({ data: { task } })
}

export async function updateTask(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { id: string }
  const body = request.body as {
    title?: string
    subjectId?: string | null
    estimatedMinutes?: number | null
    completed?: boolean
    completedAt?: string | null
    carriedOver?: boolean
    dueDate?: string
  }

  const prisma = request.server.prisma

  const existing = await prisma.task.findUnique({ where: { id: params.id } })
  if (!existing) return reply.status(404).send({ error: 'Task not found' })
  if (existing.userId !== request.user.id) return reply.status(403).send({ error: 'Forbidden' })

  // Build date mutations
  const dateUpdates: Record<string, Date | null> = {}
  if (body.completed !== undefined) {
    if (body.completed) {
      dateUpdates.completedAt = body.completedAt ? new Date(body.completedAt) : new Date()
    } else {
      dateUpdates.completedAt = null
    }
  } else if (body.completedAt !== undefined) {
    dateUpdates.completedAt = body.completedAt ? new Date(body.completedAt) : null
  }

  const task = await prisma.task.update({
    where: { id: params.id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.subjectId !== undefined && { subjectId: body.subjectId }),
      ...(body.estimatedMinutes !== undefined && { estimatedMinutes: body.estimatedMinutes }),
      ...(body.completed !== undefined && { completed: body.completed }),
      ...('completedAt' in dateUpdates && { completedAt: dateUpdates.completedAt }),
      ...(body.carriedOver !== undefined && { carriedOver: body.carriedOver }),
      ...(body.dueDate !== undefined && { dueDate: new Date(body.dueDate) }),
    }
  })

  return reply.send({ data: { task } })
}

export async function deleteTask(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { id: string }
  const prisma = request.server.prisma
  const existing = await prisma.task.findUnique({ where: { id: params.id } })
  if (!existing) return reply.status(404).send({ error: 'Task not found' })
  if (existing.userId !== request.user.id) return reply.status(403).send({ error: 'Forbidden' })
  await prisma.task.delete({ where: { id: params.id } })
  return reply.status(200).send({ data: { success: true } })
}
