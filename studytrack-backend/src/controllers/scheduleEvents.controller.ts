import { FastifyRequest, FastifyReply } from 'fastify'

export async function listScheduleEvents(request: FastifyRequest, reply: FastifyReply) {
  const query = request.query as { date?: string }
  const userId = request.user.id

  if (!query.date) {
    return reply.status(400).send({ error: 'date query param required' })
  }

  // Parse the date to get day of week (0=Sun ... 6=Sat)
  const dateObj = new Date(`${query.date}T12:00:00Z`)
  if (isNaN(dateObj.getTime())) {
    return reply.status(400).send({ error: 'Invalid date format. Use YYYY-MM-DD.' })
  }
  const dayOfWeek = dateObj.getUTCDay()

  const prisma = request.server.prisma

  const events = await prisma.scheduleEvent.findMany({
    where: {
      userId,
      OR: [
        { date: query.date, isRecurring: false },
        { isRecurring: true, recurringDays: { has: dayOfWeek } },
      ],
    },
    orderBy: { startTime: 'asc' },
  })

  return reply.send({ data: { events } })
}

export async function createScheduleEvent(request: FastifyRequest, reply: FastifyReply) {
  const body = request.body as {
    title: string
    date: string
    startTime: string
    durationMinutes?: number
    subjectId?: string
    isRecurring?: boolean
    recurringDays?: number[]
    color?: string
  }

  const prisma = request.server.prisma

  const event = await prisma.scheduleEvent.create({
    data: {
      userId: request.user.id,
      title: body.title,
      date: body.date,
      startTime: body.startTime,
      durationMinutes: body.durationMinutes ?? 60,
      subjectId: body.subjectId ?? null,
      isRecurring: body.isRecurring ?? false,
      recurringDays: body.recurringDays ?? [],
      color: body.color ?? null,
    },
  })

  return reply.status(201).send({ data: { event } })
}

export async function updateScheduleEvent(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { id: string }
  const body = request.body as {
    title?: string
    date?: string
    startTime?: string
    durationMinutes?: number
    subjectId?: string | null
    isRecurring?: boolean
    recurringDays?: number[]
    color?: string | null
  }

  const prisma = request.server.prisma

  const existing = await prisma.scheduleEvent.findUnique({ where: { id: params.id } })
  if (!existing) return reply.status(404).send({ error: 'Event not found' })
  if (existing.userId !== request.user.id) return reply.status(403).send({ error: 'Forbidden' })

  const event = await prisma.scheduleEvent.update({
    where: { id: params.id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.date !== undefined && { date: body.date }),
      ...(body.startTime !== undefined && { startTime: body.startTime }),
      ...(body.durationMinutes !== undefined && { durationMinutes: body.durationMinutes }),
      ...(body.subjectId !== undefined && { subjectId: body.subjectId }),
      ...(body.isRecurring !== undefined && { isRecurring: body.isRecurring }),
      ...(body.recurringDays !== undefined && { recurringDays: body.recurringDays }),
      ...(body.color !== undefined && { color: body.color }),
    },
  })

  return reply.send({ data: { event } })
}

export async function deleteScheduleEvent(request: FastifyRequest, reply: FastifyReply) {
  const params = request.params as { id: string }
  const prisma = request.server.prisma

  const existing = await prisma.scheduleEvent.findUnique({ where: { id: params.id } })
  if (!existing) return reply.status(404).send({ error: 'Event not found' })
  if (existing.userId !== request.user.id) return reply.status(403).send({ error: 'Forbidden' })

  await prisma.scheduleEvent.delete({ where: { id: params.id } })
  return reply.send({ data: { success: true } })
}
