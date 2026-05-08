import { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { setPendingRun } from '../src/storage/selectedRunStore';
import type { DryRun } from '../src/types/dryRun';
import { colors } from '../src/utils/theme';

const ITEM_H = 48;
const VISIBLE = 3;
const DRUM_H = ITEM_H * VISIBLE;

const MINUTES = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0'));
const SECONDS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const PRESETS = [5, 10, 15, 20, 30, 45];

interface DrumProps {
  values: string[];
  selectedIndex: number;
  onSelect: (i: number) => void;
}

function DrumColumn({ values, selectedIndex, onSelect }: DrumProps) {
  const scrollRef = useRef<ScrollView>(null);
  const isFirstRender = useRef(true);

  useEffect(() => {
    const y = selectedIndex * ITEM_H;
    if (isFirstRender.current) {
      isFirstRender.current = false;
      const t = setTimeout(() => {
        scrollRef.current?.scrollTo({ y, animated: false });
      }, 60);
      return () => clearTimeout(t);
    }
    scrollRef.current?.scrollTo({ y, animated: true });
  }, [selectedIndex]);

  function settle(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    onSelect(Math.max(0, Math.min(values.length - 1, i)));
  }

  return (
    <View style={drum.wrapper}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate={0.985}
        scrollEventThrottle={16}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        contentContainerStyle={{ paddingVertical: ITEM_H * Math.floor(VISIBLE / 2) }}
        nestedScrollEnabled={false}
      >
        {values.map((v, i) => (
          <View key={i} style={drum.item}>
            <Text style={[drum.text, i === selectedIndex ? drum.textOn : drum.textOff]}>
              {v}
            </Text>
          </View>
        ))}
      </ScrollView>
      <View style={drum.highlight} pointerEvents="none" />
    </View>
  );
}

const drum = StyleSheet.create({
  wrapper: {
    flex: 1,
    height: DRUM_H,
    overflow: 'hidden',
  },
  item: {
    height: ITEM_H,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontSize: 30,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    letterSpacing: 1,
  },
  textOn: { color: colors.cream },
  textOff: { color: colors.muted },
  highlight: {
    position: 'absolute',
    top: ITEM_H * Math.floor(VISIBLE / 2),
    left: 0,
    right: 0,
    height: ITEM_H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: colors.border,
    borderBottomColor: colors.border,
  },
});

export default function CreateRunScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(15);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [skipped, setSkipped] = useState(false);
  const [promptEnabled, setPromptEnabled] = useState(false);
  const [promptContent, setPromptContent] = useState<'cues' | 'verbiage'>('cues');
  const [promptAdvance] = useState<'auto' | 'manual'>('auto');
  const [error, setError] = useState('');

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Name is required.');
      return;
    }

    const now = new Date().toISOString();
    const run: DryRun = {
      id: Date.now().toString(),
      title: trimmed,
      targetDurationSeconds: skipped ? null : durationMinutes * 60 + durationSeconds,
      blocks: [],
      promptEnabled,
      promptContent,
      promptAdvance,
      createdAt: now,
      updatedAt: now,
    };

    setPendingRun(run);
    router.push('/builder');
  }

  function applyPreset(minutes: number) {
    setDurationMinutes(minutes);
    setDurationSeconds(0);
  }

  const presetActive = (m: number) => durationMinutes === m && durationSeconds === 0;

  return (
    <View style={styles.root}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
      {/* Static content above drum */}
      <View style={styles.above}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.back}>‹ Back</Text>
          </TouchableOpacity>
          <Text style={styles.step}>NEW RUN · 1 OF 1</Text>
        </View>

        <Text style={styles.heading}>What are we{'\n'}rehearsing?</Text>

        <Text style={styles.label}>NAME</Text>
        <TextInput
          style={[styles.input, !!error && styles.inputError]}
          placeholder="e.g. Friday late set"
          placeholderTextColor={colors.muted}
          value={name}
          onChangeText={(v) => {
            setName(v);
            if (error) setError('');
          }}
          returnKeyType="done"
        />
        {!!error && <Text style={styles.error}>{error}</Text>}

        <View style={styles.durationHeader}>
          <Text style={styles.label}>TARGET DURATION</Text>
          <TouchableOpacity onPress={() => setSkipped((s) => !s)}>
            <Text style={styles.skip}>{skipped ? 'SET' : 'SKIP'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Drum and presets live outside any ScrollView */}
      {skipped ? (
        <TouchableOpacity style={styles.skippedArea} onPress={() => setSkipped(false)}>
          <Text style={styles.skipped}>Tap to set duration</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.below}>
          <View style={styles.pickerRow}>
            <DrumColumn
              values={MINUTES}
              selectedIndex={durationMinutes}
              onSelect={setDurationMinutes}
            />
            <Text style={styles.colon}>:</Text>
            <DrumColumn
              values={SECONDS}
              selectedIndex={durationSeconds}
              onSelect={setDurationSeconds}
            />
          </View>

          <View style={styles.pickerLabels}>
            <Text style={styles.pickerLabel}>MIN</Text>
            <Text style={styles.pickerLabel}>SEC</Text>
          </View>

          <View style={styles.presetRow}>
            {PRESETS.map((m) => (
              <TouchableOpacity
                key={m}
                style={[styles.preset, presetActive(m) && styles.presetActive]}
                onPress={() => applyPreset(m)}
              >
                <Text style={[styles.presetText, presetActive(m) && styles.presetTextActive]}>
                  {m} MIN
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.prompterSection}>
        <View style={styles.toggleRow}>
          <Text style={styles.label}>PROMPTER</Text>
          <TouchableOpacity
            style={[styles.masterToggle, promptEnabled && styles.masterToggleOn]}
            onPress={() => setPromptEnabled((v) => !v)}
          >
            <Text style={[styles.masterToggleText, promptEnabled && styles.masterToggleTextOn]}>
              {promptEnabled ? 'ON' : 'OFF'}
            </Text>
          </TouchableOpacity>
        </View>

        {promptEnabled && (
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Content</Text>
            <View style={styles.toggleGroup}>
              {(['cues', 'verbiage'] as const).map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.toggleChip, promptContent === v && styles.toggleChipActive]}
                  onPress={() => setPromptContent(v)}
                >
                  <Text style={[styles.toggleChipText, promptContent === v && styles.toggleChipTextActive]}>
                    {v.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}
        {/* Advance option hidden until auto-scroll ships
        {promptEnabled && (
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>Advance</Text>
            <View style={styles.toggleGroup}>
              {(['auto', 'manual'] as const).map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.toggleChip, promptAdvance === v && styles.toggleChipActive]}
                  onPress={() => setPromptAdvance(v)}
                >
                  <Text style={[styles.toggleChipText, promptAdvance === v && styles.toggleChipTextActive]}>
                    {v.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )} */}
      </View>
      {/* Footer */}
      {/* <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.startButton,
            run.blocks.length === 0 && styles.startButtonDisabled,
          ]}
          onPress={() => run.blocks.length > 0 && router.push('/dry-run')}
          disabled={run.blocks.length === 0}
        >
          <Text style={styles.startButtonText}>▶ Start Dry Run</Text>
        </TouchableOpacity>
      </View> */}
      </ScrollView>
      <View style={styles.stickyFooter}>
        <TouchableOpacity style={styles.startButton} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Start building →</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  above: {
    paddingHorizontal: 28,
    paddingTop: 60,
  },
  below: {
    paddingHorizontal: 28,
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 40,
  },
  back: { color: colors.cream, fontSize: 16 },
  step: { color: colors.muted, fontSize: 11, letterSpacing: 2 },
  heading: {
    color: colors.cream,
    fontSize: 36,
    fontFamily: 'Georgia',
    lineHeight: 44,
    marginBottom: 40,
  },
  label: { color: colors.muted, fontSize: 11, letterSpacing: 2, marginBottom: 10 },
  input: {
    color: colors.cream,
    fontSize: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.gold,
    paddingVertical: 8,
    marginBottom: 8,
  },
  inputError: { borderBottomColor: '#e05555' },
  error: { color: '#e05555', fontSize: 12, marginBottom: 8 },
  durationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 36,
    marginBottom: 20,
  },
  skip: { color: colors.muted, fontSize: 11, letterSpacing: 1.5 },
  skippedArea: {
    height: DRUM_H + 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipped: { color: colors.gold, fontSize: 14 },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: DRUM_H,
    marginBottom: 8,
  },
  colon: {
    color: colors.muted,
    fontSize: 28,
    fontWeight: '200',
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  pickerLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  pickerLabel: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 2,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  preset: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  presetActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  presetText: {
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 1,
  },
  presetTextActive: {
    color: '#1a1100',
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 28,
    paddingBottom: 40,
    paddingTop: 16,
  },
  stickyFooter: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bg,
  },
  startButton: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 18,
    alignItems: 'center',
  },
  // stickyFooter: {
  //   flexDirection: 'row',
  //   // gap: 12,
  //   paddingHorizontal: 28,
  //   paddingTop: 16,
  //   paddingBottom: 40,
  //   borderTopWidth: 1,
  //   borderTopColor: colors.border,
  //   backgroundColor: colors.bg,
  // },
  button: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 18,
    alignItems: 'center',
  },
  buttonText: {
    color: '#1a1100',
    fontSize: 16,
    fontWeight: '700',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  toggleLabel: { color: colors.muted, fontSize: 11, letterSpacing: 2 },
  toggleGroup: { flexDirection: 'row', gap: 8 },
  toggleChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  toggleChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  toggleChipText: { color: colors.muted, fontSize: 11, letterSpacing: 1 },
  toggleChipTextActive: { color: '#1a1100', fontWeight: '600' },
  masterToggle: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  masterToggleOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  masterToggleText: { color: colors.muted, fontSize: 11, letterSpacing: 1.5 },
  masterToggleTextOn: { color: '#1a1100', fontWeight: '600' },
  prompterSection: { paddingHorizontal: 28, marginTop: 24 },
  scrollContent: { flexGrow: 1 },
});
