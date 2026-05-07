import { FastifyRequest, FastifyReply } from 'fastify'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function supabaseLogin(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Missing Supabase token' })
  }
  const accessToken = authHeader.slice(7)

  const { data: { user: supabaseUser }, error } = await supabaseAdmin.auth.getUser(accessToken)
  if (error || !supabaseUser) {
    return reply.status(401).send({ error: 'Invalid Supabase token' })
  }

  const supabaseUid = supabaseUser.id
  const email = supabaseUser.email!
  const name = supabaseUser.user_metadata?.full_name ?? supabaseUser.user_metadata?.name ?? email.split('@')[0]
  const avatar = supabaseUser.user_metadata?.avatar_url ?? null

  const prisma = request.server.prisma

  let isNewUser = false
  let user = await prisma.user.findUnique({ where: { supabaseUid } })

  if (!user) {
    const emailPrefix = email.split('@')[0].replace(/[^a-z0-9_]/gi, '')
    let handle = `@${emailPrefix}`
    const taken = await prisma.user.findUnique({ where: { handle } })
    if (taken) handle = `@${emailPrefix}_${Date.now()}`

    user = await prisma.user.create({
      data: { supabaseUid, email, name, handle, avatar }
    })
    isNewUser = true
  } else {
    user = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    })
  }

  // Compute streak: consecutive days (from today backwards) with ≥1 completed session
  const sessionDays = await prisma.session.findMany({
    where: { userId: user.id, endedAt: { not: null } },
    select: { endedAt: true },
    orderBy: { endedAt: 'desc' }
  })

  const daySet = new Set(
    sessionDays.map((s) => s.endedAt!.toISOString().slice(0, 10))
  )

  let streak = 0
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  while (daySet.has(cursor.toISOString().slice(0, 10))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }

  const token = request.server.jwt.sign(
    { id: user.id, email: user.email, supabaseUid: user.supabaseUid },
    { expiresIn: '30d' }
  )

  return reply.send({
    data: {
      token,
      user: {
        id: user.id,
        name: user.name,
        handle: user.handle,
        email: user.email,
        avatar: user.avatar,
        streak,
        dailyGoalSeconds: user.dailyGoalSeconds,
        isNewUser
      }
    }
  })
}
