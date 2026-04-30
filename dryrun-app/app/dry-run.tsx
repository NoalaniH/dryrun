import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { loadDryRunById } from '../src/storage/dryRunStorage';
import { getSelectedRunId } from '../src/storage/selectedRunStore';
import { setRunSummary } from '../src/storage/runSummaryStore';
import { saveRunSession } from '../src/storage/runHistoryStorage';
import type { DryRun } from '../src/types/dryRun';
import type { RunBlockResult } from '../src/types/runHistory';
import { colors } from '../src/utils/theme';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function formatClock(seconds: number): string {
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}

export default function DryRunScreen() {
  const router = useRouter();
  const [run, setRun] = useState<DryRun | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [blockIndex, setBlockIndex] = useState(0);
  const [blockElapsed, setBlockElapsed] = useState(0);
  const [runElapsed, setRunElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const interval = useRef<ReturnType<typeof setInterval> | null>(null);
  const blockResults = useRef(new Map<string, number>());
  const startedAt = useRef('');

  useEffect(() => {
    const runId = getSelectedRunId();
    (runId ? loadDryRunById(runId) : Promise.resolve(null)).then((r) => {
      setRun(r);
      setLoaded(true);
      blockResults.current = new Map();
      startedAt.current = new Date().toISOString();
    });
  }, []);

  // Navigate back if there's nothing to run
  useEffect(() => {
    if (loaded && (!run || run.blocks.length === 0)) {
      router.back();
    }
  }, [loaded, run]);

  // Timer — clears when paused, restarts when resumed
  useEffect(() => {
    if (!run || paused) return;
    interval.current = setInterval(() => {
      setBlockElapsed((e) => e + 1);
      setRunElapsed((e) => e + 1);
    }, 1000);
    return () => {
      if (interval.current) clearInterval(interval.current);
    };
  }, [run, paused]);

  function goNext() {
    if (!run || blockIndex >= run.blocks.length - 1) return;
    blockResults.current.set(run.blocks[blockIndex].id, blockElapsed);
    setBlockIndex((i) => i + 1);
    setBlockElapsed(0);
  }

  function goPrev() {
    if (blockIndex === 0) return;
    setBlockIndex((i) => i - 1);
    setBlockElapsed(0);
  }

  function handleEnd() {
    if (interval.current) clearInterval(interval.current);
    router.back();
  }

  function handleFinish() {
    if (!run) return;
    if (interval.current) clearInterval(interval.current);
    blockResults.current.set(run.blocks[blockIndex].id, blockElapsed);

    const endedAt = new Date().toISOString();
    const completedBlocks = run.blocks.filter((block) => blockResults.current.has(block.id));

    const sessionBlockResults: RunBlockResult[] = completedBlocks.map((block) => ({
      id: `br_${block.id}_${Date.now()}`,
      blockId: block.id,
      libraryItemId: block.libraryItemId,
      title: block.title,
      type: block.type,
      order: block.order,
      plannedDurationSeconds: block.durationSeconds,
      actualDurationSeconds: blockResults.current.get(block.id)!,
      notes: block.notes || undefined,
    }));

    void saveRunSession({
      id: `session_${Date.now()}`,
      dryRunId: run.id,
      dryRunName: run.title,
      startedAt: startedAt.current,
      endedAt,
      targetDurationSeconds: run.targetDurationSeconds,
      totalActualDurationSeconds: runElapsed,
      blockResults: sessionBlockResults,
    });

    setRunSummary({
      runTitle: run.title,
      targetDurationSeconds: run.targetDurationSeconds,
      totalActualDurationSeconds: runElapsed,
      blocks: completedBlocks.map((block) => ({
        id: block.id,
        title: block.title,
        type: block.type,
        order: block.order,
        plannedDurationSeconds: block.durationSeconds,
        actualDurationSeconds: blockResults.current.get(block.id)!,
      })),
    });

    router.replace('/run-summary');
  }

  if (!loaded || !run || run.blocks.length === 0) return null;

  const block = run.blocks[blockIndex];
  const isLast = blockIndex === run.blocks.length - 1;
  const hasDuration = block.durationSeconds != null && block.durationSeconds > 0;
  const progress = hasDuration
    ? Math.min(1, blockElapsed / block.durationSeconds!)
    : null;

  return (
    <View style={styles.container}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity
          onPress={handleEnd}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <Text style={styles.endBtn}>× END</Text>
        </TouchableOpacity>

        <Text style={styles.counter}>
          {pad(blockIndex + 1)} / {pad(run.blocks.length)}
        </Text>

        <TouchableOpacity
          onPress={() => setPaused((p) => !p)}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <Text style={styles.holdBtn}>{paused ? '▶ RESUME' : '‖ HOLD'}</Text>
        </TouchableOpacity>
      </View>

      {/* Current block */}
      <View style={styles.main}>
        <Text style={styles.nowLabel}>● NOW</Text>

        <Text style={styles.blockTitle} numberOfLines={2}>
          {block.title}
        </Text>

        <Text style={styles.blockType}>{block.type.toUpperCase()}</Text>

        {block.vibe ? (
          <Text style={styles.vibe} numberOfLines={1}>
            {block.vibe}
          </Text>
        ) : null}

        {block.verbiage ? (
          <Text style={styles.verbiage} numberOfLines={4}>
            {block.verbiage}
          </Text>
        ) : null}

        {block.notes ? (
          <Text style={styles.notes} numberOfLines={2}>
            {block.notes}
          </Text>
        ) : null}

        {/* Block elapsed timer */}
        <Text style={styles.clock}>{formatClock(blockElapsed)}</Text>

        {/* Total run timer */}
        <Text style={styles.runTimer}>RUN  {formatClock(runElapsed)}</Text>

        {/* Progress bar — only shown when block has an estimated duration */}
        {progress !== null ? (
          <View style={styles.progressTrack}>
            <View
              style={[styles.progressFill, { width: `${progress * 100}%` }]}
            />
          </View>
        ) : (
          <View style={styles.progressTrackEmpty} />
        )}
      </View>

      {/* Bottom nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity
          style={styles.prevBtn}
          onPress={goPrev}
          disabled={blockIndex === 0}
        >
          <Text style={[styles.prevText, blockIndex === 0 && styles.disabled]}>
            ← Prev
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.nextBtn} onPress={isLast ? handleFinish : goNext}>
          <Text style={styles.nextText}>
            {isLast ? 'Finish Run' : 'Next →'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingTop: 60,
    paddingBottom: 40,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 0,
  },
  endBtn: { color: colors.muted, fontSize: 12, letterSpacing: 1.5 },
  counter: { color: colors.muted, fontSize: 12, letterSpacing: 2 },
  holdBtn: { color: colors.muted, fontSize: 12, letterSpacing: 1.5 },
  main: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  nowLabel: {
    color: colors.gold,
    fontSize: 11,
    letterSpacing: 2.5,
    marginBottom: 20,
  },
  blockTitle: {
    color: colors.cream,
    fontSize: 34,
    fontFamily: 'Georgia',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 42,
  },
  blockType: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 3,
    marginBottom: 12,
  },
  vibe: {
    color: colors.gold,
    fontSize: 11,
    fontStyle: 'italic',
    letterSpacing: 1.5,
    marginTop: 4,
    marginBottom: 12,
    opacity: 0.85,
  },
  verbiage: {
    color: colors.cream,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 8,
    maxWidth: 300,
  },
  notes: {
    color: colors.muted,
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 0,
    maxWidth: 280,
  },
  clock: {
    color: colors.cream,
    fontSize: 80,
    fontWeight: '200',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
    marginTop: 32,
    marginBottom: 8,
  },
  runTimer: {
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 2.5,
    fontVariant: ['tabular-nums'],
    marginBottom: 28,
  },
  progressTrack: {
    width: '100%',
    height: 2,
    backgroundColor: colors.border,
    borderRadius: 1,
    overflow: 'hidden',
  },
  progressTrackEmpty: {
    width: '100%',
    height: 2,
    backgroundColor: colors.border,
    borderRadius: 1,
    opacity: 0.3,
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.gold,
    borderRadius: 1,
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  prevBtn: {
    flex: 1,
    paddingVertical: 18,
    alignItems: 'center',
  },
  prevText: { color: colors.cream, fontSize: 15 },
  nextBtn: {
    flex: 2,
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 18,
    alignItems: 'center',
  },
  nextText: { color: '#1a1100', fontSize: 15, fontWeight: '700' },
  disabled: { color: colors.border },
});
