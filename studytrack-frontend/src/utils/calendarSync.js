import * as Calendar from 'expo-calendar'
import AsyncStorage from '@react-native-async-storage/async-storage'

const STORAGE_KEY = 'calendar_sync_enabled'

export async function requestCalendarPermission() {
  const { status } = await Calendar.requestCalendarPermissionsAsync()
  return status === 'granted'
}

export async function isCalendarSyncEnabled() {
  const value = await AsyncStorage.getItem(STORAGE_KEY)
  return value === 'true'
}

export async function setCalendarSyncEnabled(enabled) {
  await AsyncStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false')
}

export async function getDeviceCalendarEvents(dateISO) {
  const { status } = await Calendar.getCalendarPermissionsAsync()
  if (status !== 'granted') return []
  try {
    const [year, month, day] = dateISO.split('-').map(Number)
    const startDate = new Date(year, month - 1, day, 0, 0, 0)
    const endDate   = new Date(year, month - 1, day, 23, 59, 59)

    const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT)
    const calendarMap = {}
    for (const cal of calendars) calendarMap[cal.id] = cal.title

    const events = await Calendar.getEventsAsync(
      calendars.map(c => c.id),
      startDate,
      endDate
    )

    return events.map(event => {
      const start = new Date(event.startDate)
      const end   = new Date(event.endDate)
      const pad   = n => String(n).padStart(2, '0')
      return {
        id:              `device_${event.id}`,
        title:           event.title ?? 'Untitled Event',
        startTime:       `${pad(start.getHours())}:${pad(start.getMinutes())}`,
        endTime:         `${pad(end.getHours())}:${pad(end.getMinutes())}`,
        durationMinutes: Math.round((end - start) / 60000),
        isDeviceEvent:   true,
        calendarName:    calendarMap[event.calendarId] ?? 'Calendar',
        color:           event.color ?? '#4A90E2',
        notes:           event.notes ?? null,
      }
    })
  } catch (err) {
    console.error('getDeviceCalendarEvents error:', err)
    return []
  }
}
