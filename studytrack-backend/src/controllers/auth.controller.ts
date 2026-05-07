import { FastifyRequest, FastifyReply } from 'fastify'
import bcrypt from 'bcrypt'

const SALT_ROUNDS = 10

export async function register(request: FastifyRequest, reply: FastifyReply) {
  const { email, password, name, handle, avatar } = request.body as {
    email: string
    password: string
    name: string
    handle: string
    avatar?: string
  }

  const prisma = request.server.prisma
  const existing = await prisma.user.findFirst({ where: { OR: [{ email }, { handle }] } })
  if (existing) {
    return reply.status(409).send({ error: 'Email or handle already in use' })
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)
  const user = await prisma.user.create({
    data: { email, name, handle, avatar, passwordHash }
  })

  const token = request.server.jwt.sign({ id: user.id, email: user.email })

  return reply.status(201).send({
    data: {
      token,
      user: { id: user.id, email: user.email, name: user.name, handle: user.handle, avatar: user.avatar }
    }
  })
}

export async function login(request: FastifyRequest, reply: FastifyReply) {
  const { email, password } = request.body as { email: string; password: string }

  const prisma = request.server.prisma
  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    return reply.status(401).send({ error: 'Invalid credentials' })
  }

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid) {
    return reply.status(401).send({ error: 'Invalid credentials' })
  }

  const token = request.server.jwt.sign({ id: user.id, email: user.email })

  return reply.send({
    data: {
      token,
      user: { id: user.id, email: user.email, name: user.name, handle: user.handle, avatar: user.avatar }
    }
  })
}
