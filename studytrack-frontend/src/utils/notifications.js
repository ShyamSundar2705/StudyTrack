import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import AsyncStorage from '@react-native-async-storage/async-storage';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ── Permission ───────────────────────────────────────────────────

export async function requestNotificationPermission() {
  if (!Device.isDevice) {
    console.log('Not a physical device — skipping notification permission');
    return false;
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  if (existing === 'granted') return true;
  const { status } = await Notifications.requestPermissionsAsync();
  return status === 'granted';
}

// ── Pomodoro phase alerts ────────────────────────────────────────

export async function schedulePomoPhaseEndAlert(currentPhase, durationSeconds) {
  const useUserStore = require('../store/useUserStore').default;
  const { preferences } = useUserStore.getState();
  if (preferences?.notificationsEnabled === false) return;
  if (preferences?.pomodoroSounds === false) return;

  await Notifications.cancelAllScheduledNotificationsAsync();

  const content = {
    focus: {
      title: '🍅 Focus session complete!',
      body: 'Great work. Time for a break.',
    },
    short_break: {
      title: '☕ Break over!',
      body: 'Ready to focus again?',
    },
    long_break: {
      title: '🎉 Long break over!',
      body: "You've earned this. Back to it!",
    },
  }[currentPhase];

  if (!content) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      ...content,
      sound: true,
      priority: Notifications.AndroidNotificationPriority.HIGH,
      vibrationPattern: [0, 250, 250, 250],
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: durationSeconds,
    },
  });
}

export async function cancelPomoAlert() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

// ── Daily study reminder ─────────────────────────────────────────

export async function scheduleDailyReminder(timeString) {
  const useUserStore = require('../store/useUserStore').default;
  const { preferences } = useUserStore.getState();
  if (preferences?.notificationsEnabled === false) return;

  await cancelDailyReminder();

  const [hour, minute] = timeString.split(':').map(Number);

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '📚 Time to study!',
      body: "You haven't hit your daily goal yet. Start a session now.",
      sound: true,
      priority: Notifications.AndroidNotificationPriority.DEFAULT,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour,
      minute,
    },
  });

  await AsyncStorage.setItem('reminder_scheduled_time', timeString);
}

export async function cancelDailyReminder() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  for (const notif of scheduled) {
    if (notif.content.title?.includes('Time to study')) {
      await Notifications.cancelScheduledNotificationAsync(notif.identifier);
    }
  }
  await AsyncStorage.removeItem('reminder_scheduled_time');
}

// ── Session milestone alerts ─────────────────────────────────────

const MILESTONE_SECONDS = [
 1800,
 3600,
 7200,
];

export async function checkAndFireMilestone(elapsedSeconds, dailyGoalSeconds, subjectName) {
  const milestone = MILESTONE_SECONDS.find((m) => elapsedSeconds === m);

  if (milestone) {
    const label = milestone >= 3600 ? `${milestone / 3600}h` : `${milestone / 60}m`;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `🔥 ${label} streak!`,
        body: `${label} of ${subjectName} done. Keep going!`,
        sound: true,
        priority: Notifications.AndroidNotificationPriority.LOW,
      },
      trigger: null,
    });
  }

  if (elapsedSeconds > 0 && dailyGoalSeconds > 0 && elapsedSeconds === dailyGoalSeconds) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎯 Daily goal reached!',
        body: 'You hit your study goal for today. Amazing work!',
        sound: true,
        priority: Notifications.AndroidNotificationPriority.HIGH,
        vibrate: [0, 500, 200, 500],
      },
      trigger: null,
    });
  }
}

// ── Notification tap handler ─────────────────────────────────────

export function registerNotificationTapHandler(navigationRef) {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const title = response.notification.request.content.title;
    if (title?.includes('Time to study')) {
      navigationRef.current?.navigate('Main');
    } else if (
      title?.includes('Focus session complete') ||
      title?.includes('Break over')
    ) {
      navigationRef.current?.navigate('Main');
    } else {
      navigationRef.current?.navigate('Main');
    }
  });
}
