import { Server, Socket } from 'socket.io'
import { PrismaClient } from '../../generated/prisma/client'

export function registerGroupSocketHandlers(io: Server, prisma: PrismaClient) {
  const namespace = io.of('/groups')

  namespace.on('connection', (socket: Socket) => {
    console.log('[Socket] connected:', socket.id)

    socket.on('join_group_room', async ({ groupId, userId }: { groupId: string; userId: string }) => {
      const room = `group_${groupId}`
      socket.join(room)
      socket.data.userId = userId
      socket.data.groupId = groupId
      console.log(`[Socket] User ${userId} joined room ${room}`)

      try {
        const members = await prisma.groupMember.findMany({
          where: { groupId },
          include: { user: true },
        })
        socket.emit('room_state', { members })
      } catch (err) {
        console.error('[Socket] room_state fetch failed:', err)
      }
    })

    socket.on('session_started', ({ userId, subjectName, subjectColor, elapsedSeconds }: {
      userId: string; subjectName: string; subjectColor: string; elapsedSeconds: number
    }) => {
      const room = `group_${socket.data.groupId}`
      namespace.to(room).emit('member_status_update', {
        userId,
        status: 'studying',
        subjectName,
        subjectColor,
        elapsedSeconds,
      })
      namespace.to(room).emit('activity_feed_update', {
        type: 'session_start',
        userId,
        subjectName,
        createdAt: new Date().toISOString(),
      })
    })

    socket.on('session_tick', ({ userId, elapsedSeconds }: { userId: string; elapsedSeconds: number }) => {
      const room = `group_${socket.data.groupId}`
      namespace.to(room).emit('member_status_update', {
        userId,
        status: 'studying',
        elapsedSeconds,
      })
    })

    socket.on('session_paused', ({ userId }: { userId: string }) => {
      const room = `group_${socket.data.groupId}`
      namespace.to(room).emit('member_status_update', {
        userId,
        status: 'paused',
        elapsedSeconds: 0,
      })
    })

    socket.on('session_completed', async ({ userId, subjectName, durationSeconds }: {
      userId: string; subjectName: string; durationSeconds: number
    }) => {
      const room = `group_${socket.data.groupId}`
      namespace.to(room).emit('member_status_update', {
        userId,
        status: 'idle',
        elapsedSeconds: 0,
      })
      namespace.to(room).emit('activity_feed_update', {
        type: 'session_complete',
        userId,
        subjectName,
        durationSeconds,
        createdAt: new Date().toISOString(),
      })
      namespace.to(room).emit('leaderboard_update')
    })

    socket.on('streak_milestone', ({ userId, streakCount }: { userId: string; streakCount: number }) => {
      const room = `group_${socket.data.groupId}`
      namespace.to(room).emit('activity_feed_update', {
        type: 'streak_milestone',
        userId,
        metadata: { streakCount },
        createdAt: new Date().toISOString(),
      })
    })

    socket.on('leave_group_room', ({ groupId }: { groupId: string }) => {
      socket.leave(`group_${groupId}`)
      console.log(`[Socket] ${socket.id} left group_${groupId}`)
    })

    socket.on('disconnect', () => {
      console.log('[Socket] disconnected:', socket.id)
      if (socket.data.userId && socket.data.groupId) {
        const room = `group_${socket.data.groupId}`
        namespace.to(room).emit('member_status_update', {
          userId: socket.data.userId,
          status: 'idle',
          elapsedSeconds: 0,
        })
      }
    })
  })
}
