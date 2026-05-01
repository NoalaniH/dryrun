import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { getRunSummary, type RunSummary } from '../src/storage/runSummaryStore';
import { colors } from '../src/utils/theme';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatClock(seconds: number): string {
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

function formatDiff(actualS: number, plannedS: number): string {
  const diff = actualS - plannedS;
  if (diff === 0) return 'on time';
  const abs = Math.abs(diff);
  const str = abs >= 60 ? formatClock(abs) : `${abs}s`;
  return diff > 0 ? `+${str}` : `−${str}`;
}

function formatTotalDiff(actual: number, target: number): string {
  const diff = actual - target;
  if (diff === 0) return 'on time';
  const str = formatClock(Math.abs(diff));
  return diff > 0 ? `+${str} over` : `−${str} under`;
}

export default function RunSummaryScreen() {
  const router = useRouter();
  const [summary, setSummary] = useState<RunSummary | null>(null);

  useEffect(() => {
    const s = getRunSummary();
    if (!s) {
      router.back();
      return;
    }
    setSummary(s);
  }, []);

  if (!summary) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/')}>
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Text style={styles.completeLabel}>RUN COMPLETE</Text>
        <Text style={styles.totalTime}>{formatClock(summary.totalActualDurationSeconds)}</Text>
        {summary.targetDurationSeconds !== null && (
          <Text style={styles.targetLine}>
            {'Target '}
            {formatClock(summary.targetDurationSeconds)}
            {'  '}
            <Text style={styles.diffText}>
              {formatTotalDiff(
                summary.totalActualDurationSeconds,
                summary.targetDurationSeconds,
              )}
            </Text>
          </Text>
        )}

        <View style={styles.divider} />

        {/* Block breakdown */}
        {summary.blocks.map((block) => (
          <View key={block.id} style={styles.blockRow}>
            <Text style={styles.blockNum}>{pad(block.order + 1)}</Text>
            <View style={styles.blockInfo}>
              <Text style={styles.blockTitle} numberOfLines={1}>
                {block.title}
              </Text>
              <Text style={styles.blockTimes}>
                {block.plannedDurationSeconds != null
                  ? `Planned ${formatClock(block.plannedDurationSeconds)}  ·  `
                  : ''}
                {`Actual ${formatClock(block.actualDurationSeconds)}`}
                {block.plannedDurationSeconds != null
                  ? `  ·  ${formatDiff(block.actualDurationSeconds, block.plannedDurationSeconds)}`
                  : ''}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.back()}>
          <Text style={styles.secondaryBtnText}>Back to Builder</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.replace('/dry-run')}
        >
          <Text style={styles.primaryBtnText}>Run Again</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
  },
  closeBtn: {
    color: colors.muted,
    fontSize: 18,
  },
  scrollContent: {
    paddingHorizontal: 28,
    paddingTop: 16,
    paddingBottom: 24,
  },
  completeLabel: {
    color: colors.gold,
    fontSize: 11,
    letterSpacing: 2.5,
    marginBottom: 16,
  },
  totalTime: {
    color: colors.cream,
    fontSize: 64,
    fontWeight: '200',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
    marginBottom: 8,
  },
  targetLine: {
    color: colors.muted,
    fontSize: 13,
    letterSpacing: 0.5,
    fontVariant: ['tabular-nums'],
  },
  diffText: {
    color: colors.cream,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 28,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 22,
    gap: 14,
  },
  blockNum: {
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
    paddingTop: 2,
    width: 24,
  },
  blockInfo: {
    flex: 1,
  },
  blockTitle: {
    color: colors.cream,
    fontSize: 16,
    fontFamily: 'Georgia',
    marginBottom: 4,
  },
  blockTimes: {
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 0.3,
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 18,
    alignItems: 'center',
  },
  secondaryBtnText: {
    color: colors.cream,
    fontSize: 15,
  },
  primaryBtn: {
    flex: 2,
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 18,
    alignItems: 'center',
  },
  primaryBtnText: {
    color: '#1a1100',
    fontSize: 15,
    fontWeight: '700',
  },
});
