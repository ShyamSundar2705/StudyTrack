import { Share } from 'react-native';

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}h ${m}m`;
  if (h > 0) return `${h}h`;
  return `${m}m`;
}

export const shareSession = async ({ durationSeconds, subjectName, streak }) => {
  const duration = formatDuration(durationSeconds);

  const lines = [
    `📚 Just studied ${duration} of ${subjectName}!`,
    streak > 1 ? `🔥 ${streak} day streak and counting.` : null,
    '',
    'Tracking my study sessions with StudyTrack.',
  ].filter((l) => l !== null);

  try {
    await Share.share({ message: lines.join('\n'), title: 'My Study Session' });
  } catch (e) {
    console.error('Share failed:', e);
  }
};
