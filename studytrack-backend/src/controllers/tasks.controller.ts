import { FastifyRequest, FastifyReply } from 'fastify'

export async function listTasks(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.id
  const { date } = request.query as { date?: string }
  const prisma = request.server.prisma

  const where: any = { userId }
  if (date) {
    where.dueDate = {
      gte: new Date(`${date}T00:00:00.000Z`),
      lte: new Date(`${date}T23:59:59.999Z`)
    }
  }

  const tasks = await prisma.task.findMany({ where, orderBy: { dueDate: 'asc' } })

  return reply.send({ data: { tasks } })
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
