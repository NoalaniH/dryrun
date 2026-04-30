import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { loadLibrary, saveLibrary } from '../src/storage/libraryStorage';
import { loadAllDryRuns, deleteDryRun } from '../src/storage/dryRunStorage';
import { setSelectedRunId } from '../src/storage/selectedRunStore';
import type { LibraryItem, LibraryItemType, DryRun } from '../src/types/dryRun';
import { colors } from '../src/utils/theme';

const ITEM_H = 54;
const VISIBLE = 5;
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
        decelerationRate="fast"
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
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
  wrapper: { flex: 1, height: DRUM_H, overflow: 'hidden' },
  item: { height: ITEM_H, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 30, fontWeight: '200', fontVariant: ['tabular-nums'], letterSpacing: 1 },
  textOn: { color: colors.cream },
  textOff: { color: colors.muted },
  highlight: {
    position: 'absolute',
    top: ITEM_H * 2,
    left: 0,
    right: 0,
    height: ITEM_H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderTopColor: colors.border,
    borderBottomColor: colors.border,
  },
});

function formatMinSec(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function runMeta(run: DryRun): string {
  const parts: string[] = [];
  if (run.blocks.length > 0) {
    parts.push(`${run.blocks.length} block${run.blocks.length === 1 ? '' : 's'}`);
  }
  if (run.targetDurationSeconds) {
    const m = Math.floor(run.targetDurationSeconds / 60);
    const s = run.targetDurationSeconds % 60;
    parts.push(s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')}`);
  }
  return parts.length > 0 ? parts.join('  ·  ') : 'No blocks yet';
}

export default function LibraryScreen() {
  const router = useRouter();
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [runs, setRuns] = useState<DryRun[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<LibraryItemType>('trick');
  const [durationMin, setDurationMin] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [durationSkipped, setDurationSkipped] = useState(true);
  const [description, setDescription] = useState('');
  const [vibe, setVibe] = useState('');
  const [verbiage, setVerbiage] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    loadLibrary().then(setLibrary);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadAllDryRuns().then((all) =>
        setRuns([...all].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
      );
    }, [])
  );

  function openAdd() {
    setEditingItem(null);
    setTitle('');
    setType('trick');
    setDurationMin(0);
    setDurationSec(0);
    setDurationSkipped(true);
    setDescription('');
    setVibe('');
    setVerbiage('');
    setNotes('');
    setShowModal(true);
  }

  function openEdit(item: LibraryItem) {
    setEditingItem(item);
    setTitle(item.title);
    setType(item.type);
    if (item.defaultDurationSeconds != null) {
      setDurationMin(Math.floor(item.defaultDurationSeconds / 60));
      setDurationSec(item.defaultDurationSeconds % 60);
      setDurationSkipped(false);
    } else {
      setDurationMin(0);
      setDurationSec(0);
      setDurationSkipped(true);
    }
    setDescription(item.description);
    setVibe(item.defaultVibe ?? '');
    setVerbiage(item.defaultVerbiage ?? '');
    setNotes(item.notes);
    setShowModal(true);
  }

  function openRun(run: DryRun) {
    setSelectedRunId(run.id);
    router.push('/builder');
  }

  function confirmDeleteRun(run: DryRun) {
    Alert.alert(
      'Delete run?',
      `"${run.title}" and all its blocks will be removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteDryRun(run.id);
            setRuns((prev) => prev.filter((r) => r.id !== run.id));
          },
        },
      ]
    );
  }

  async function handleSave() {
    if (!title.trim()) return;
    const now = new Date().toISOString();
    const defaultDurationSeconds = durationSkipped ? null : durationMin * 60 + durationSec;

    let updated: LibraryItem[];

    if (editingItem) {
      const edited: LibraryItem = {
        ...editingItem,
        title: title.trim(),
        type,
        defaultDurationSeconds,
        description: description.trim(),
        defaultVibe: vibe.trim() || undefined,
        defaultVerbiage: verbiage.trim() || undefined,
        notes: notes.trim(),
        updatedAt: now,
      };
      updated = library.map((i) => (i.id === editingItem.id ? edited : i));
    } else {
      const item: LibraryItem = {
        id: `lib_${Date.now()}`,
        title: title.trim(),
        type,
        defaultDurationSeconds,
        description: description.trim(),
        defaultVibe: vibe.trim() || undefined,
        defaultVerbiage: verbiage.trim() || undefined,
        notes: notes.trim(),
        createdAt: now,
        updatedAt: now,
      };
      updated = [...library, item];
    }

    setLibrary(updated);
    setShowModal(false);
    await saveLibrary(updated);
  }

  function handleDeleteItem() {
    if (!editingItem) return;
    Alert.alert(
      'Delete item?',
      `"${editingItem.title}" will be removed from your library. Existing routine blocks will not be affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = library.filter((i) => i.id !== editingItem.id);
            setLibrary(updated);
            setShowModal(false);
            await saveLibrary(updated);
          },
        },
      ],
    );
  }

  const tricks = library.filter((i) => i.type === 'trick');
  const bits = library.filter((i) => i.type === 'bit');
  const hasItems = library.length > 0 || runs.length > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>LIBRARY</Text>
        <TouchableOpacity onPress={openAdd}>
          <Text style={styles.addBtn}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {!hasItems ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing here yet.</Text>
            <Text style={styles.emptyBody}>
              Add tricks and bits to reuse across runs.
            </Text>
            <TouchableOpacity style={styles.addFirstButton} onPress={openAdd}>
              <Text style={styles.addFirstText}>+ Add first item</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {runs.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>RUNS</Text>
                {runs.map((run) => (
                  <TouchableOpacity
                    key={run.id}
                    style={styles.runRow}
                    onPress={() => openRun(run)}
                    onLongPress={() => confirmDeleteRun(run)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.runInfo}>
                      <Text style={styles.runTitle}>{run.title}</Text>
                      <Text style={styles.runMeta}>{runMeta(run)}</Text>
                    </View>
                    <Text style={styles.editChevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {tricks.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, runs.length > 0 && { marginTop: 28 }]}>
                  TRICKS
                </Text>
                {tricks.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.itemRow}
                    onPress={() => openEdit(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      {item.description ? (
                        <Text style={styles.itemDescription} numberOfLines={1}>
                          {item.description}
                        </Text>
                      ) : null}
                      {(item.defaultDurationSeconds != null || item.notes) && (
                        <Text style={styles.itemMeta}>
                          {item.defaultDurationSeconds != null
                            ? formatMinSec(item.defaultDurationSeconds)
                            : ''}
                          {item.defaultDurationSeconds != null && item.notes ? '  ·  ' : ''}
                          {item.notes ? item.notes : ''}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.editChevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {bits.length > 0 && (
              <>
                <Text style={[styles.sectionLabel, (runs.length > 0 || tricks.length > 0) && { marginTop: 28 }]}>
                  BITS
                </Text>
                {bits.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.itemRow}
                    onPress={() => openEdit(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
                      {item.description ? (
                        <Text style={styles.itemDescription} numberOfLines={1}>
                          {item.description}
                        </Text>
                      ) : null}
                      {(item.defaultDurationSeconds != null || item.notes) && (
                        <Text style={styles.itemMeta}>
                          {item.defaultDurationSeconds != null
                            ? formatMinSec(item.defaultDurationSeconds)
                            : ''}
                          {item.defaultDurationSeconds != null && item.notes ? '  ·  ' : ''}
                          {item.notes ? item.notes : ''}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.editChevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" transparent>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.sheet}
          >
            <ScrollView keyboardShouldPersistTaps="handled">
              <View style={styles.handle} />
              <Text style={styles.sheetHeading}>
                {editingItem ? 'EDIT TRICK OR BIT' : 'NEW TRICK OR BIT'}
              </Text>

              <TextInput
                style={styles.sheetInput}
                placeholder="Title"
                placeholderTextColor={colors.muted}
                value={title}
                onChangeText={setTitle}
                autoFocus={!editingItem}
              />

              <Text style={styles.fieldLabel}>TYPE</Text>
              <View style={styles.typeToggle}>
                {(['trick', 'bit'] as LibraryItemType[]).map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={[styles.typeChip, type === t && styles.typeChipActive]}
                    onPress={() => setType(t)}
                  >
                    <Text style={[styles.typeChipText, type === t && styles.typeChipTextActive]}>
                      {t.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.durationHeader}>
                <Text style={styles.fieldLabel}>DURATION</Text>
                <TouchableOpacity onPress={() => setDurationSkipped((s) => !s)}>
                  <Text style={styles.skip}>{durationSkipped ? 'SET' : 'SKIP'}</Text>
                </TouchableOpacity>
              </View>
              {durationSkipped ? (
                <TouchableOpacity style={styles.skippedRow} onPress={() => setDurationSkipped(false)}>
                  <Text style={styles.skipped}>Tap to set duration</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <View style={styles.drumRow}>
                    <DrumColumn values={MINUTES} selectedIndex={durationMin} onSelect={setDurationMin} />
                    <Text style={styles.colon}>:</Text>
                    <DrumColumn values={SECONDS} selectedIndex={durationSec} onSelect={setDurationSec} />
                  </View>
                  <View style={styles.drumLabels}>
                    <Text style={styles.drumLabel}>MIN</Text>
                    <Text style={styles.drumLabel}>SEC</Text>
                  </View>
                  <View style={styles.presetRow}>
                    {PRESETS.map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[styles.preset, durationMin === m && durationSec === 0 && styles.presetActive]}
                        onPress={() => { setDurationMin(m); setDurationSec(0); }}
                      >
                        <Text style={[styles.presetText, durationMin === m && durationSec === 0 && styles.presetTextActive]}>
                          {m} MIN
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={[styles.fieldLabel, { marginTop: 24 }]}>DESCRIPTION</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="What is this trick or bit about?"
                placeholderTextColor={colors.muted}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <Text style={styles.fieldLabel}>VIBE</Text>
              <TextInput
                style={styles.singleInput}
                placeholder="e.g. dark, slow build, playful"
                placeholderTextColor={colors.muted}
                value={vibe}
                onChangeText={setVibe}
              />

              <Text style={styles.fieldLabel}>VERBIAGE / CUES</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Words, phrasing, or performance reminders..."
                placeholderTextColor={colors.muted}
                value={verbiage}
                onChangeText={setVerbiage}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Text style={styles.fieldLabel}>NOTES</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Setup, props, private reminders..."
                placeholderTextColor={colors.muted}
                value={notes}
                onChangeText={setNotes}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowModal(false)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>

              {editingItem ? (
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteItem}>
                  <Text style={styles.deleteBtnText}>Delete this item</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 16,
  },
  back: { color: colors.cream, fontSize: 24 },
  headerTitle: { color: colors.muted, fontSize: 11, letterSpacing: 2.5 },
  addBtn: { color: colors.gold, fontSize: 14 },
  content: { paddingHorizontal: 24, paddingBottom: 40 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: {
    color: colors.muted,
    fontSize: 18,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
  },
  emptyBody: {
    color: colors.muted,
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 240,
    marginBottom: 24,
  },
  addFirstButton: {
    backgroundColor: colors.gold,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
  },
  addFirstText: { color: '#1a1100', fontSize: 15, fontWeight: '600' },
  sectionLabel: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 2.5,
    marginBottom: 12,
  },
  // Runs
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  runInfo: { flex: 1 },
  runTitle: {
    color: colors.cream,
    fontSize: 17,
    fontFamily: 'Georgia',
    marginBottom: 3,
  },
  runMeta: { color: colors.muted, fontSize: 12 },
  // Library items
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 8,
  },
  itemInfo: { flex: 1 },
  itemTitle: {
    color: colors.cream,
    fontSize: 16,
    fontFamily: 'Georgia',
    marginBottom: 3,
  },
  itemDescription: {
    color: colors.muted,
    fontSize: 12,
    fontStyle: 'italic',
    marginBottom: 2,
  },
  itemMeta: { color: colors.muted, fontSize: 12, fontVariant: ['tabular-nums'] },
  editChevron: { color: colors.muted, fontSize: 20, marginLeft: 8 },
  // Modal
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: colors.muted,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 24,
  },
  sheetHeading: { color: colors.muted, fontSize: 11, letterSpacing: 2.5, marginBottom: 20 },
  sheetInput: {
    color: colors.cream,
    fontSize: 26,
    fontFamily: 'Georgia',
    borderBottomWidth: 1,
    borderBottomColor: colors.gold,
    paddingVertical: 8,
    marginBottom: 32,
  },
  fieldLabel: { color: colors.muted, fontSize: 11, letterSpacing: 2, marginBottom: 12 },
  typeToggle: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  typeChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  typeChipActive: { borderColor: colors.gold, backgroundColor: colors.gold },
  typeChipText: { color: colors.muted, fontSize: 13 },
  typeChipTextActive: { color: '#1a1100', fontWeight: '600' },
  durationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  skip: { color: colors.muted, fontSize: 11, letterSpacing: 1.5 },
  skippedRow: { marginBottom: 24 },
  skipped: { color: colors.gold, fontSize: 14 },
  drumRow: { flexDirection: 'row', alignItems: 'center', height: DRUM_H, marginBottom: 8 },
  colon: { color: colors.muted, fontSize: 28, fontWeight: '200', paddingHorizontal: 8, paddingBottom: 4 },
  drumLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  drumLabel: { color: colors.muted, fontSize: 11, letterSpacing: 2 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 },
  preset: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  presetActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  presetText: { color: colors.muted, fontSize: 12, letterSpacing: 1 },
  presetTextActive: { color: '#1a1100', fontWeight: '600' },
  singleInput: {
    backgroundColor: colors.bg,
    borderRadius: 8,
    color: colors.cream,
    padding: 14,
    fontSize: 14,
    marginBottom: 24,
  },
  notesInput: {
    backgroundColor: colors.bg,
    borderRadius: 8,
    color: colors.cream,
    padding: 14,
    fontSize: 14,
    lineHeight: 22,
    minHeight: 80,
    marginBottom: 24,
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelBtnText: { color: colors.cream, fontSize: 15, fontWeight: '500' },
  saveBtn: {
    flex: 1,
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveBtnText: { color: '#1a1100', fontSize: 15, fontWeight: '700' },
  deleteBtn: { alignItems: 'center', paddingVertical: 20 },
  deleteBtnText: { color: '#c0392b', fontSize: 14, fontWeight: '500' },
});
