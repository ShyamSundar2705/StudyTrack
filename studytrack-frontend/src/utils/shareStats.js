import { Share } from 'react-native';
import { formatDuration } from './dateTime';

export const shareInsightsStats = async ({
  period,
  totalSeconds,
  dailyAverageSeconds,
  bestDaySeconds,
  bySubject,
  streak,
  userName,
  subjectName,
}) => {
  const periodLabel = {
    week: 'this week',
    month: 'this month',
    allTime: 'all time',
  }[period] ?? 'this week';

  const topSubjects = (bySubject ?? [])
    .slice(0, 3)
    .map(s => `  • ${s.name}: ${formatDuration(s.seconds)}`)
    .join('\n');

  const heading = subjectName
    ? `📊 ${subjectName} — ${periodLabel}`
    : `📊 My StudyTrack stats — ${periodLabel}`;

  const lines = [
    heading,
    ``,
    `⏱ Total studied: ${formatDuration(totalSeconds)}`,
    `📅 Daily average: ${formatDuration(dailyAverageSeconds)}`,
    `🏆 Best day: ${formatDuration(bestDaySeconds)}`,
    streak > 1 ? `🔥 Current streak: ${streak} days` : null,
    topSubjects ? `\n📚 Top subjects:\n${topSubjects}` : null,
    ``,
    `Tracked with StudyTrack`,
  ].filter(line => line !== null);

  try {
    await Share.share({
      message: lines.join('\n'),
      title: 'My Study Stats',
    });
  } catch (err) {
    console.error('Share stats failed:', err);
  }
};
