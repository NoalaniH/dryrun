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
  Animated,
  PanResponder,
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
        decelerationRate={0.985}
        scrollEventThrottle={16}
        onMomentumScrollEnd={settle}
        onScrollEndDrag={settle}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
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

const DELETE_W = 80;

interface SwipeableRowProps {
  onDelete: () => void;
  children: React.ReactNode;
}

function SwipeableRow({ onDelete, children }: SwipeableRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > 6 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_, g) => {
        const x = isOpen.current ? g.dx - DELETE_W : g.dx;
        translateX.setValue(Math.min(0, x));
      },
      onPanResponderRelease: (_, g) => {
        const movedLeft = g.dx < -DELETE_W / 2;
        const shouldOpen = isOpen.current ? g.dx > -DELETE_W / 2 ? false : true : movedLeft;
        isOpen.current = shouldOpen;
        Animated.spring(translateX, {
          toValue: shouldOpen ? -DELETE_W : 0,
          useNativeDriver: true,
          bounciness: 0,
        }).start();
      },
    })
  ).current;

  function close() {
    isOpen.current = false;
    Animated.spring(translateX, { toValue: 0, useNativeDriver: true, bounciness: 0 }).start();
  }

  return (
    <View style={{ overflow: 'hidden', marginBottom: 8, borderRadius: 8 }}>
      {/* Delete button behind the row */}
      <View style={swipe.deleteBack}>
        <TouchableOpacity
          style={swipe.deleteBtn}
          onPress={() => { close(); onDelete(); }}
        >
          <Text style={swipe.deleteTxt}>Delete</Text>
        </TouchableOpacity>
      </View>
      {/* Sliding row */}
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const swipe = StyleSheet.create({
  deleteBack: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: DELETE_W,
    backgroundColor: '#c0392b',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: { flex: 1, width: '100%', justifyContent: 'center', alignItems: 'center' },
  deleteTxt: { color: '#fff', fontSize: 13, fontWeight: '600', letterSpacing: 0.5 },
});

type LibraryTab = 'runs' | 'tricks' | 'bits';
type ModalMode = 'closed' | 'add' | 'edit';
type DeleteTarget =
  | { kind: 'run'; run: DryRun }
  | { kind: 'item'; item: LibraryItem }
  | null;

export default function LibraryScreen() {
  const router = useRouter();
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [runs, setRuns] = useState<DryRun[]>([]);
  const [tab, setTab] = useState<LibraryTab>('runs');
  const [modalMode, setModalMode] = useState<ModalMode>('closed');
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);

  const [title, setTitle] = useState('');
  const [type, setType] = useState<LibraryItemType>('trick');
  const [durationMin, setDurationMin] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [durationSkipped, setDurationSkipped] = useState(false);
  const [modalScrollEnabled, setModalScrollEnabled] = useState(true);
  const [description, setDescription] = useState('');
  const [vibe, setVibe] = useState('');
  const [verbiage, setVerbiage] = useState('');
  const [cues, setCues] = useState('');
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
    setType(tab === 'bits' ? 'bit' : 'trick'); // 'runs' tab falls through to 'trick'
    setDurationMin(0);
    setDurationSec(0);
    setDurationSkipped(false);
    setDescription('');
    setVibe('');
    setVerbiage('');
    setCues('');
    setNotes('');
    setModalMode('add');
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
    setCues(item.defaultCues ?? '');
    setNotes(item.notes);
    setModalMode('edit');
  }

  function openRun(run: DryRun) {
    setSelectedRunId(run.id);
    router.push('/builder');
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    if (deleteTarget.kind === 'run') {
      await deleteDryRun(deleteTarget.run.id);
      setRuns((prev) => prev.filter((r) => r.id !== deleteTarget.run.id));
    } else {
      const updated = library.filter((i) => i.id !== deleteTarget.item.id);
      setLibrary(updated);
      setModalMode('closed');
      await saveLibrary(updated);
    }
    setDeleteTarget(null);
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
        defaultCues: cues.trim() || undefined,
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
        defaultCues: cues.trim() || undefined,
        notes: notes.trim(),
        createdAt: now,
        updatedAt: now,
      };
      updated = [...library, item];
    }

    setLibrary(updated);
    setModalMode('closed');
    await saveLibrary(updated);
  }

  function handleDeleteItem() {
    if (!editingItem) return;
    setDeleteTarget({ kind: 'item', item: editingItem });
  }

  const tabItems = library.filter((i) => i.type === (tab === 'tricks' ? 'trick' : 'bit'));

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>LIBRARY</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Tabs */}
        <View style={styles.tabs}>
          {(['runs', 'tricks', 'bits'] as LibraryTab[]).map((t) => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* + New link */}
        <TouchableOpacity
          onPress={tab === 'runs' ? () => router.push('/create-run') : openAdd}
          style={styles.newLink}
        >
          <Text style={styles.newLinkText}>+ New</Text>
        </TouchableOpacity>

        {/* Runs tab */}
        {tab === 'runs' && (
          runs.length === 0 ? (
            <Text style={styles.emptyTab}>No runs saved yet.</Text>
          ) : (
            runs.map((run) => (
              <SwipeableRow key={run.id} onDelete={() => setDeleteTarget({ kind: 'run', run })}>
                <TouchableOpacity
                  style={styles.runRow}
                  onPress={() => openRun(run)}
                  activeOpacity={0.7}
                >
                  <View style={styles.runInfo}>
                    <Text style={styles.runTitle}>{run.title}</Text>
                    <Text style={styles.runMeta}>{runMeta(run)}</Text>
                  </View>
                  <Text style={styles.editChevron}>›</Text>
                </TouchableOpacity>
              </SwipeableRow>
            ))
          )
        )}

        {/* Tricks / Bits tab */}
        {tab !== 'runs' && (
          tabItems.length === 0 ? (
            <Text style={styles.emptyTab}>{`No ${tab} in your library yet.`}</Text>
          ) : (
            tabItems.map((item) => (
              <SwipeableRow key={item.id} onDelete={() => setDeleteTarget({ kind: 'item', item })}>
                <TouchableOpacity
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
              </SwipeableRow>
            ))
          )
        )}
      </ScrollView>

      {/* Add / Edit modal — full screen */}
      <Modal visible={modalMode !== 'closed'} animationType="slide">
        <View style={styles.fullScreen}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={styles.fullScreenHeader}>
              <Text style={styles.sheetHeading}>
                {modalMode === 'edit' ? `EDIT ${type.toUpperCase()}` : `NEW ${type.toUpperCase()}`}
              </Text>
              <TouchableOpacity
                onPress={() => setModalMode('closed')}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              >
                <Text style={styles.fullScreenClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false} scrollEnabled={modalScrollEnabled}>
              <TextInput
                style={styles.sheetInput}
                placeholder="Title"
                placeholderTextColor={colors.muted}
                value={title}
                onChangeText={setTitle}
                autoFocus={modalMode === 'add'}
              />

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
                  <View
                    style={styles.drumRow}
                    onTouchStart={() => setModalScrollEnabled(false)}
                    onTouchEnd={() => setModalScrollEnabled(true)}
                    onTouchCancel={() => setModalScrollEnabled(true)}
                  >
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

              <Text style={styles.fieldLabel}>VERBIAGE</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Full script or phrasing..."
                placeholderTextColor={colors.muted}
                value={verbiage}
                onChangeText={setVerbiage}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Text style={styles.fieldLabel}>CUES</Text>
              <TextInput
                style={styles.notesInput}
                placeholder="Keyword cues, one per line (e.g. reach for hat)"
                placeholderTextColor={colors.muted}
                value={cues}
                onChangeText={setCues}
                multiline
                numberOfLines={3}
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
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalMode('closed')}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>

              {modalMode === 'edit' ? (
                <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteItem}>
                  <Text style={styles.deleteBtnText}>Delete this item</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Delete confirmation */}
      <Modal visible={deleteTarget !== null} animationType="fade" transparent>
        <View style={styles.exitOverlay}>
          <View style={styles.exitCard}>
            <Text style={styles.exitTitle}>
              {deleteTarget?.kind === 'run' ? 'Delete run?' : 'Delete item?'}
            </Text>
            <Text style={styles.exitBody}>
              {deleteTarget?.kind === 'run'
                ? `"${deleteTarget.run.title}" and all its blocks will be removed.`
                : `"${deleteTarget?.item.title}" will be removed from your library. Existing routine blocks are not affected.`}
            </Text>
            <TouchableOpacity style={styles.exitDiscardBtn} onPress={confirmDelete}>
              <Text style={styles.exitDiscardBtnText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.exitCancelBtn} onPress={() => setDeleteTarget(null)}>
              <Text style={styles.exitCancelBtnText}>Keep it</Text>
            </TouchableOpacity>
          </View>
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
  content: { paddingHorizontal: 24, paddingBottom: 40 },
  sectionLabel: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 2.5,
    marginBottom: 12,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 28,
  },
  // Runs
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
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
  // Tabs
  tabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  tabText: {
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '600',
  },
  tabTextActive: { color: '#1a1100' },
  newLink: { marginBottom: 20 },
  newLinkText: {
    color: colors.gold,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  emptyTab: {
    color: colors.muted,
    fontSize: 14,
    marginTop: 8,
  },
  // Library items
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
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
  // Full-screen modal
  fullScreen: { flex: 1, backgroundColor: colors.bg },
  fullScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  fullScreenClose: { color: colors.muted, fontSize: 18 },
  sheetHeading: { color: colors.muted, fontSize: 11, letterSpacing: 2.5 },
  formContent: { paddingHorizontal: 24, paddingBottom: 40 },
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
  // Delete confirmation modal
  exitOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  exitCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 28,
    width: '100%',
  },
  exitTitle: {
    color: colors.cream,
    fontSize: 22,
    fontFamily: 'Georgia',
    marginBottom: 8,
  },
  exitBody: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 28,
  },
  exitDiscardBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  exitDiscardBtnText: { color: '#c0392b', fontSize: 15, fontWeight: '500' },
  exitCancelBtn: { alignItems: 'center', paddingVertical: 4 },
  exitCancelBtnText: { color: colors.muted, fontSize: 14, letterSpacing: 0.5 },
});
