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
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { loadDryRunById, saveDryRun, deleteDryRun } from '../src/storage/dryRunStorage';
import { getSelectedRunId, getPendingRun, clearPendingRun } from '../src/storage/selectedRunStore';
import { loadLibrary, saveLibrary } from '../src/storage/libraryStorage';
import type { DryRun, RoutineBlock, RoutineBlockType, LibraryItem } from '../src/types/dryRun';
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
  wrapper: { flex: 1, height: DRUM_H, overflow: 'hidden' },
  item: { height: ITEM_H, justifyContent: 'center', alignItems: 'center' },
  text: { fontSize: 30, fontWeight: '200', fontVariant: ['tabular-nums'], letterSpacing: 1 },
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

function formatSec(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatMinSec(total: number): string {
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

type ModalView = 'closed' | 'picker' | 'create' | 'edit' | 'runInfo';

export default function BuilderScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const mainScrollRef = useRef<ScrollView>(null);
  const [atBottom, setAtBottom] = useState(false);
  const [isScrollable, setIsScrollable] = useState(false);
  const scrollLayoutHeight = useRef(0);
  const [run, setRun] = useState<DryRun | null>(null);
  const [library, setLibrary] = useState<LibraryItem[]>([]);
  const [modalView, setModalView] = useState<ModalView>('closed');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isNewRun, setIsNewRun] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [exitPrompt, setExitPrompt] = useState<'new' | 'dirty' | null>(null);
  const [discardCreatePrompt, setDiscardCreatePrompt] = useState(false);
  const pendingNavAction = useRef<any>(null);
  const originalRun = useRef<DryRun | null>(null);
  const [modalScrollEnabled, setModalScrollEnabled] = useState(true);

  // Create form state (new library item)
  const [newTitle, setNewTitle] = useState('');
  const [newDurationMin, setNewDurationMin] = useState(0);
  const [newDurationSec, setNewDurationSec] = useState(0);
  const [newDurationSkipped, setNewDurationSkipped] = useState(false);
  const [newDescription, setNewDescription] = useState('');
  const [newVibe, setNewVibe] = useState('');
  const [newVerbiage, setNewVerbiage] = useState('');
  const [newCues, setNewCues] = useState('');
  const [newNotes, setNewNotes] = useState('');

  // Run info form state
  const [runInfoTitle, setRunInfoTitle] = useState('');
  const [runInfoDurationMin, setRunInfoDurationMin] = useState(0);
  const [runInfoDurationSec, setRunInfoDurationSec] = useState(0);
  const [runInfoDurationSkipped, setRunInfoDurationSkipped] = useState(true);
  const [runInfoPromptEnabled, setRunInfoPromptEnabled] = useState(false);
  const [runInfoPromptContent, setRunInfoPromptContent] = useState<'cues' | 'verbiage'>('cues');
  const [runInfoPromptAdvance, setRunInfoPromptAdvance] = useState<'auto' | 'manual'>('auto');

  // Edit block form state (block instance only)
  const [editTitle, setEditTitle] = useState('');
  const [editType, setEditType] = useState<RoutineBlockType>('custom');
  const [editDurationMin, setEditDurationMin] = useState(0);
  const [editDurationSec, setEditDurationSec] = useState(0);
  const [editDurationSkipped, setEditDurationSkipped] = useState(true);
  const [editVibe, setEditVibe] = useState('');
  const [editVerbiage, setEditVerbiage] = useState('');
  const [editCues, setEditCues] = useState('');
  const [editNotes, setEditNotes] = useState('');

  // Collapsible section state (shared — only one form open at a time)
  const [vibeOpen, setVibeOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [verbiageOpen, setVerbiageOpen] = useState(false);
  const [cuesOpen, setCuesOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);

  useEffect(() => {
    const pending = getPendingRun();
    if (pending) {
      clearPendingRun();
      setRun(pending);
      setIsNewRun(true);
      loadLibrary().then(setLibrary);
      return;
    }
    const runId = getSelectedRunId();
    Promise.all([runId ? loadDryRunById(runId) : Promise.resolve(null), loadLibrary()]).then(([r, lib]) => {
      setRun(r);
      if (r) originalRun.current = r;
      setLibrary(lib);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!run) return;
      loadDryRunById(run.id).then((saved) => {
        if (saved) {
          setIsNewRun(false);
          setIsDirty(false);
          originalRun.current = saved;
          setRun(saved);
        }
      });
      setVibeOpen(false);
      setDescriptionOpen(false);
      setVerbiageOpen(true);
      setCuesOpen(false);
      setNotesOpen(false);
    }, [run?.id])
  );

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e: any) => {
      if (!isNewRun && !isDirty) return;
      e.preventDefault();
      pendingNavAction.current = e.data.action;
      setExitPrompt(isNewRun ? 'new' : 'dirty');
    });
  }, [navigation, isNewRun, isDirty]);

  function handleExit() {
    if (!run) { router.navigate('/'); return; }
    if (isNewRun) { setExitPrompt('new'); return; }
    if (isDirty) { setExitPrompt('dirty'); return; }
    router.navigate('/');
  }

  async function handleExitSave() {
    setExitPrompt(null);
    setIsNewRun(false);
    setIsDirty(false);
    await saveDryRun(run!);
    if (pendingNavAction.current) {
      navigation.dispatch(pendingNavAction.current);
      pendingNavAction.current = null;
    } else {
      router.navigate('/');
    }
  }

  async function handleExitDiscard() {
    const prompt = exitPrompt;
    setExitPrompt(null);
    setIsNewRun(false);
    setIsDirty(false);
    if (prompt === 'new') {
      await deleteDryRun(run!.id);
    } else if (originalRun.current) {
      await saveDryRun(originalRun.current);
    }
    if (pendingNavAction.current) {
      navigation.dispatch(pendingNavAction.current);
      pendingNavAction.current = null;
    } else {
      router.navigate('/');
    }
  }

  function openRunInfo() {
    if (!run) return;
    setRunInfoTitle(run.title);
    if (run.targetDurationSeconds != null) {
      setRunInfoDurationMin(Math.floor(run.targetDurationSeconds / 60));
      setRunInfoDurationSec(run.targetDurationSeconds % 60);
      setRunInfoDurationSkipped(false);
    } else {
      setRunInfoDurationMin(0);
      setRunInfoDurationSec(0);
      setRunInfoDurationSkipped(true);
    }
    setRunInfoPromptEnabled(run.promptEnabled ?? false);
    setRunInfoPromptContent(run.promptContent ?? 'cues');
    setRunInfoPromptAdvance(run.promptAdvance ?? 'auto');
    setModalView('runInfo');
  }

  async function handleSaveRunInfo() {
    if (!run || !runInfoTitle.trim()) return;
    const updated: DryRun = {
      ...run,
      title: runInfoTitle.trim(),
      targetDurationSeconds: runInfoDurationSkipped ? null : runInfoDurationMin * 60 + runInfoDurationSec,
      promptEnabled: runInfoPromptEnabled,
      promptContent: runInfoPromptContent,
      promptAdvance: runInfoPromptAdvance,
      updatedAt: new Date().toISOString(),
    };
    setRun(updated);
    setIsDirty(true);
    closeModal();
    await saveDryRun(updated);
  }

  function openPicker() {
    setModalView('picker');
  }

  function isCreateDirty() {
    return !!(newTitle || newDescription || newVibe || newVerbiage || newCues || newNotes
      || newDurationMin > 0 || newDurationSec > 0);
  }

  function maybeCloseCreate() {
    if (isCreateDirty()) {
      setDiscardCreatePrompt(true);
    } else {
      setModalView('picker');
    }
  }

  function openCreate() {
    setNewTitle('');
    setNewDurationMin(0);
    setNewDurationSec(0);
    setNewDurationSkipped(false);
    setNewDescription('');
    setNewVibe('');
    setNewVerbiage('');
    setNewCues('');
    setNewNotes('');
    setVibeOpen(false);
    setDescriptionOpen(false);
    setVerbiageOpen(true);
    setCuesOpen(false);
    setNotesOpen(false);
    setModalView('create');
  }

  function openEdit(block: RoutineBlock) {
    setEditTitle(block.title);
    if (block.durationSeconds != null) {
      setEditDurationMin(Math.floor(block.durationSeconds / 60));
      setEditDurationSec(block.durationSeconds % 60);
      setEditDurationSkipped(false);
    } else {
      setEditDurationMin(0);
      setEditDurationSec(0);
      setEditDurationSkipped(true);
    }
    setEditVibe(block.vibe ?? '');
    setEditVerbiage(block.verbiage ?? '');
    setEditCues(block.cues ?? '');
    setEditNotes(block.notes);
    setVibeOpen(false);
    setDescriptionOpen(false);
    setVerbiageOpen(true);
    setCuesOpen(false);
    setNotesOpen(false);
    setEditingId(block.id);
    setModalView('edit');
  }

  function closeModal() {
    setModalView('closed');
    setEditingId(null);
    setVibeOpen(false);
    setDescriptionOpen(false);
    setVerbiageOpen(true);
    setCuesOpen(false);
    setNotesOpen(false);
  }

  async function handleAddFromLibrary(item: LibraryItem) {
    if (!run) return;
    const block: RoutineBlock = {
      id: Date.now().toString(),
      title: item.title,
      durationSeconds: item.defaultDurationSeconds,
      notes: item.notes,
      vibe: item.defaultVibe,
      verbiage: item.defaultVerbiage,
      cues: item.defaultCues,
      order: run.blocks.length,
      libraryItemId: item.id,
    };
    const updated: DryRun = {
      ...run,
      blocks: [...run.blocks, block],
      updatedAt: new Date().toISOString(),
    };
    setRun(updated);
    setIsNewRun(false);
    closeModal();
    await saveDryRun(updated);
  }

  async function handleCreateNew() {
    if (!run || !newTitle.trim()) return;
    const now = new Date().toISOString();
    const itemId = `lib_${Date.now()}`;
    const newDuration = newDurationSkipped ? null : newDurationMin * 60 + newDurationSec;
    const item: LibraryItem = {
      id: itemId,
      title: newTitle.trim(),
      defaultDurationSeconds: newDuration,
      description: newDescription.trim(),
      defaultVibe: newVibe.trim() || undefined,
      defaultVerbiage: newVerbiage.trim() || undefined,
      defaultCues: newCues.trim() || undefined,
      notes: newNotes.trim(),
      createdAt: now,
      updatedAt: now,
    };
    const block: RoutineBlock = {
      id: `blk_${Date.now()}`,
      title: item.title,
      durationSeconds: item.defaultDurationSeconds,
      notes: item.notes,
      vibe: item.defaultVibe,
      verbiage: item.defaultVerbiage,
      cues: item.defaultCues,
      order: run.blocks.length,
      libraryItemId: item.id,
    };
    const updatedLib = [...library, item];
    const updatedRun: DryRun = {
      ...run,
      blocks: [...run.blocks, block],
      updatedAt: now,
    };
    setLibrary(updatedLib);
    setRun(updatedRun);
    setIsNewRun(false);
    closeModal();
    await Promise.all([saveLibrary(updatedLib), saveDryRun(updatedRun)]);
  }

  async function handleSaveEdit() {
    if (!run || !editingId || !editTitle.trim()) return;
    const editedDuration = editDurationSkipped ? null : editDurationMin * 60 + editDurationSec;
    const blocks = run.blocks.map((b) =>
      b.id === editingId
        ? {
            ...b,
            title: editTitle.trim(),
            type: editType,
            durationSeconds: editedDuration,
            vibe: editVibe.trim() || undefined,
            verbiage: editVerbiage.trim() || undefined,
            cues: editCues.trim() || undefined,
            notes: editNotes.trim(),
          }
        : b
    );
    const updated: DryRun = { ...run, blocks, updatedAt: new Date().toISOString() };
    setRun(updated);
    setIsDirty(true);
    closeModal();
    await saveDryRun(updated);
  }

  async function handleDelete(id: string) {
    if (!run) return;
    const blocks = run.blocks
      .filter((b) => b.id !== id)
      .map((b, i) => ({ ...b, order: i }));
    const updated: DryRun = { ...run, blocks, updatedAt: new Date().toISOString() };
    setRun(updated);
    await saveDryRun(updated);
  }

  async function move(id: string, dir: 'up' | 'down') {
    if (!run) return;
    const idx = run.blocks.findIndex((b) => b.id === id);
    if (dir === 'up' && idx === 0) return;
    if (dir === 'down' && idx === run.blocks.length - 1) return;
    const next = [...run.blocks];
    const swap = dir === 'up' ? idx - 1 : idx + 1;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    const blocks = next.map((b, i) => ({ ...b, order: i }));
    const updated: DryRun = { ...run, blocks, updatedAt: new Date().toISOString() };
    setRun(updated);
    await saveDryRun(updated);
  }

  if (!run) return null;

  const totalSec = run.blocks.reduce((sum, b) => sum + (b.durationSeconds ?? 0), 0);
  const targetSec = run.targetDurationSeconds;
  const diffSec = targetSec != null ? targetSec - totalSec : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.back}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>ACT BUILDER</Text>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
        >
          <Text style={styles.closeBtn}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={mainScrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onLayout={(e) => { scrollLayoutHeight.current = e.nativeEvent.layout.height; }}
        onContentSizeChange={(_, contentHeight) => {
          setIsScrollable(contentHeight > scrollLayoutHeight.current);
        }}
        onScroll={(e) => {
          const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
          setAtBottom(contentOffset.y + layoutMeasurement.height >= contentSize.height - 20);
        }}
      >
        <TouchableOpacity onPress={openRunInfo} style={styles.runInfoTouchable}>
          <Text style={styles.runTitle}>{run.title}</Text>
          <Feather name="edit-2" size={18} color={colors.cream} style={{ marginTop: 10 }} />
        </TouchableOpacity>

        {/* Time summary */}
        <TouchableOpacity onPress={openRunInfo}>
          <View style={styles.timeRow}>
            <View style={styles.timeLeft}>
              <Text style={styles.timeBig}>{formatSec(totalSec)}</Text>
              {targetSec != null && (
                <Text style={styles.timeTarget}> / {formatSec(targetSec)}</Text>
              )}
            </View>
            {diffSec != null && (
              <Text style={[styles.timeDiff, diffSec < 0 && styles.timeDiffOver]}>
                {diffSec >= 0
                  ? `-${formatSec(diffSec)} UNDER`
                  : `+${formatSec(Math.abs(diffSec))} OVER`}
              </Text>
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.divider} />

        {run.blocks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>An empty stage.</Text>
            <Text style={styles.emptyBody}>Add the first beat of your act.</Text>
            <TouchableOpacity style={styles.addFirstButton} onPress={openPicker}>
              <Text style={styles.addFirstText}>+ Add first block</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {run.blocks.map((block, index) => (
              <TouchableOpacity
                key={block.id}
                style={styles.blockRow}
                onPress={() => openEdit(block)}
              >
                <Text style={styles.blockIndex}>
                  {String(index + 1).padStart(2, '0')}
                </Text>
                <View style={styles.blockInfo}>
                  <Text style={styles.blockTitle}>{block.title}</Text>
                  <View style={styles.blockMeta}>
                    <Text style={styles.blockType}>DURATION</Text>
                    {block.durationSeconds != null && (
                      <Text style={styles.blockDuration}>
                        {formatMinSec(block.durationSeconds)}
                      </Text>
                    )}
                  </View>
                  {block.vibe ? (
                    <Text style={styles.vibePreview} numberOfLines={1}>
                      {block.vibe}
                    </Text>
                  ) : null}
                  {block.notes ? (
                    <Text style={styles.notesPreview} numberOfLines={1}>
                      {block.notes}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.blockActions}>
                  <TouchableOpacity
                    onPress={() => move(block.id, 'up')}
                    style={styles.iconBtn}
                  >
                    <Text style={styles.iconBtnText}>↑</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => move(block.id, 'down')}
                    style={styles.iconBtn}
                  >
                    <Text style={styles.iconBtnText}>↓</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDelete(block.id)}
                    style={styles.iconBtn}
                  >
                    <Text style={styles.iconBtnText}>×</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}

            <TouchableOpacity style={styles.addMore} onPress={openPicker}>
              <Text style={styles.addMoreText}>+ Add block</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Scroll arrow */}
      {isScrollable && (
        <TouchableOpacity
          style={styles.scrollArrow}
          onPress={() => {
            if (atBottom) {
              mainScrollRef.current?.scrollTo({ y: 0, animated: true });
            } else {
              mainScrollRef.current?.scrollToEnd({ animated: true });
            }
          }}
        >
          <Feather name={atBottom ? 'arrow-up' : 'arrow-down'} size={18} color={colors.cream} />
        </TouchableOpacity>
      )}

      {/* Footer */}
      <View style={styles.footer}>
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
      </View>

      {/* Exit prompt */}
      <Modal visible={exitPrompt !== null} animationType="fade" transparent>
        <View style={styles.exitOverlay}>
          <View style={styles.exitCard}>
            <Text style={styles.exitTitle}>
              {exitPrompt === 'new' ? 'Save this run?' : 'Unsaved changes'}
            </Text>
            <Text style={styles.exitBody}>
              {exitPrompt === 'new'
                ? `"${run.title}" hasn't been saved to your library yet.`
                : 'Do you want to save your changes?'}
            </Text>

            <TouchableOpacity style={styles.exitSaveBtn} onPress={handleExitSave}>
              <Text style={styles.exitSaveBtnText}>Save</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.exitDiscardBtn} onPress={handleExitDiscard}>
              <Text style={styles.exitDiscardBtnText}>
                {exitPrompt === 'new' ? 'Discard run' : 'Discard changes'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.exitCancelBtn}
              onPress={() => setExitPrompt(null)}
            >
              <Text style={styles.exitCancelBtnText}>Keep editing</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Run info modal */}
      <Modal visible={modalView === 'runInfo'} animationType="slide">
        <View style={styles.fullScreen}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={styles.fullScreenHeader}>
              <Text style={styles.sheetHeading}>EDIT RUN</Text>
              <TouchableOpacity
                onPress={closeModal}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              >
                <Text style={styles.fullScreenClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.formContent} showsVerticalScrollIndicator={false} scrollEnabled={modalScrollEnabled}>
              <Text style={styles.sectionLabel}>NAME</Text>
              <TextInput
                style={styles.sheetInput}
                placeholder="Run name"
                placeholderTextColor={colors.muted}
                value={runInfoTitle}
                onChangeText={setRunInfoTitle}
                autoFocus
              />

              <View style={styles.durationHeader}>
                <Text style={styles.sectionLabel}>TARGET DURATION</Text>
                <TouchableOpacity onPress={() => setRunInfoDurationSkipped((s) => !s)}>
                  <Text style={styles.skip}>{runInfoDurationSkipped ? 'SET' : 'SKIP'}</Text>
                </TouchableOpacity>
              </View>
              {runInfoDurationSkipped ? (
                <TouchableOpacity style={styles.skippedRow} onPress={() => setRunInfoDurationSkipped(false)}>
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
                    <DrumColumn
                      values={MINUTES}
                      selectedIndex={runInfoDurationMin}
                      onSelect={setRunInfoDurationMin}
                    />
                    <Text style={styles.colon}>:</Text>
                    <DrumColumn
                      values={SECONDS}
                      selectedIndex={runInfoDurationSec}
                      onSelect={setRunInfoDurationSec}
                    />
                  </View>
                  <View style={styles.drumLabels}>
                    <Text style={styles.drumLabel}>MIN</Text>
                    <Text style={styles.drumLabel}>SEC</Text>
                  </View>
                  <View style={styles.presetRow}>
                    {PRESETS.map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.preset,
                          runInfoDurationMin === m && runInfoDurationSec === 0 && styles.presetActive,
                        ]}
                        onPress={() => { setRunInfoDurationMin(m); setRunInfoDurationSec(0); }}
                      >
                        <Text
                          style={[
                            styles.presetText,
                            runInfoDurationMin === m && runInfoDurationSec === 0 && styles.presetTextActive,
                          ]}
                        >
                          {m} MIN
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <View style={[styles.promptSettingRow, { marginTop: 32, marginBottom: runInfoPromptEnabled ? 12 : 32 }]}>
                <Text style={styles.sectionLabel}>PROMPTER</Text>
                <TouchableOpacity
                  style={[styles.promptChip, runInfoPromptEnabled && styles.promptChipActive]}
                  onPress={() => setRunInfoPromptEnabled((v) => !v)}
                >
                  <Text style={[styles.promptChipText, runInfoPromptEnabled && styles.promptChipTextActive]}>
                    {runInfoPromptEnabled ? 'ON' : 'OFF'}
                  </Text>
                </TouchableOpacity>
              </View>

              {runInfoPromptEnabled && (
                <>
                  <View style={styles.promptSettingRow}>
                    <Text style={styles.promptSettingLabel}>Content</Text>
                    <View style={styles.promptChipGroup}>
                      {(['cues', 'verbiage'] as const).map((v) => (
                        <TouchableOpacity
                          key={v}
                          style={[styles.promptChip, runInfoPromptContent === v && styles.promptChipActive]}
                          onPress={() => setRunInfoPromptContent(v)}
                        >
                          <Text style={[styles.promptChipText, runInfoPromptContent === v && styles.promptChipTextActive]}>
                            {v.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  <View style={[styles.promptSettingRow, { marginBottom: 32 }]}>
                    <Text style={styles.promptSettingLabel}>Advance</Text>
                    <View style={styles.promptChipGroup}>
                      {(['auto', 'manual'] as const).map((v) => (
                        <TouchableOpacity
                          key={v}
                          style={[styles.promptChip, runInfoPromptAdvance === v && styles.promptChipActive]}
                          onPress={() => setRunInfoPromptAdvance(v)}
                        >
                          <Text style={[styles.promptChipText, runInfoPromptAdvance === v && styles.promptChipTextActive]}>
                            {v.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveBtn} onPress={handleSaveRunInfo}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Block modal */}
      <Modal visible={modalView !== 'closed' && modalView !== 'runInfo'} animationType="slide" onShow={() => setModalScrollEnabled(true)}>
        <View style={styles.fullScreen}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={{ flex: 1 }}
          >
            <View style={styles.fullScreenHeader}>
              <Text style={styles.sheetHeading}>
                {modalView === 'picker'
                  ? 'ADD BLOCK'
                  : modalView === 'create'
                  ? 'NEW BLOCK'
                  : 'EDIT BLOCK'}
              </Text>
              <TouchableOpacity
                onPress={modalView === 'create' ? maybeCloseCreate : closeModal}
                hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}
              >
                <Text style={styles.fullScreenClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.blockFormContent} showsVerticalScrollIndicator={false}>

              {/* ── PICKER: select from library or choose action ── */}
              {modalView === 'picker' && (
                <>
                  <TouchableOpacity onPress={openCreate} style={styles.pickerNewLink}>
                    <Text style={styles.pickerNewLinkText}>+ New</Text>
                  </TouchableOpacity>

                  {/* Library items */}
                  {library.length === 0 ? (
                    <Text style={styles.emptyLibrary}>
                      No bits in your library yet.
                    </Text>
                  ) : (
                    library
                      .map((item) => (
                        <TouchableOpacity
                          key={item.id}
                          style={styles.libraryRow}
                          onPress={() => handleAddFromLibrary(item)}
                        >
                          <View style={styles.libraryInfo}>
                            <Text style={styles.libraryTitle}>{item.title}</Text>
                            <Text style={styles.libraryMeta}>
                              {item.defaultDurationSeconds != null
                                ? formatMinSec(item.defaultDurationSeconds)
                                : 'no duration set'}
                            </Text>
                          </View>
                          <Text style={styles.libraryPlus}>+</Text>
                        </TouchableOpacity>
                      ))
                  )}
                </>
              )}

              {/* ── CREATE: new library item ── */}
              {modalView === 'create' && (
                <View style={styles.blockFormInner}>
                  <TextInput
                    style={styles.sheetInput}
                    placeholder="Title"
                    placeholderTextColor={colors.muted}
                    value={newTitle}
                    onChangeText={setNewTitle}
                    autoFocus
                  />

                  <View style={styles.durationHeader}>
                    <Text style={styles.sectionLabel}>DURATION</Text>
                    <TouchableOpacity onPress={() => setNewDurationSkipped((s) => !s)}>
                      <Text style={styles.skip}>{newDurationSkipped ? 'SET' : 'SKIP'}</Text>
                    </TouchableOpacity>
                  </View>
                  {newDurationSkipped ? (
                    <TouchableOpacity
                      style={styles.skippedRow}
                      onPress={() => setNewDurationSkipped(false)}
                    >
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
                        <DrumColumn
                          values={MINUTES}
                          selectedIndex={newDurationMin}
                          onSelect={setNewDurationMin}
                        />
                        <Text style={styles.colon}>:</Text>
                        <DrumColumn
                          values={SECONDS}
                          selectedIndex={newDurationSec}
                          onSelect={setNewDurationSec}
                        />
                      </View>
                      <View style={styles.drumLabels}>
                        <Text style={styles.drumLabel}>MIN</Text>
                        <Text style={styles.drumLabel}>SEC</Text>
                      </View>
                      <View style={styles.presetRow}>
                        {PRESETS.map((m) => (
                          <TouchableOpacity
                            key={m}
                            style={[
                              styles.preset,
                              newDurationMin === m && newDurationSec === 0 && styles.presetActive,
                            ]}
                            onPress={() => { setNewDurationMin(m); setNewDurationSec(0); }}
                          >
                            <Text
                              style={[
                                styles.presetText,
                                newDurationMin === m && newDurationSec === 0 && styles.presetTextActive,
                              ]}
                            >
                              {m} MIN
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  <TouchableOpacity style={styles.collapsibleRow} onPress={() => setDescriptionOpen(o => !o)}>
                    <Text style={styles.sectionLabel}>DESCRIPTION</Text>
                    <Feather name={descriptionOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} />
                  </TouchableOpacity>
                  {descriptionOpen && (
                    <TextInput
                      style={[styles.notesInput, { maxHeight: 94 }]}
                      placeholder="What is this bit about?"
                      placeholderTextColor={colors.muted}
                      value={newDescription}
                      onChangeText={setNewDescription}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  )}

                  <TouchableOpacity style={styles.collapsibleRow} onPress={() => setVibeOpen(o => !o)}>
                    <Text style={styles.sectionLabel}>VIBE</Text>
                    <Feather name={vibeOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} />
                  </TouchableOpacity>
                  {vibeOpen && (
                    <TextInput
                      style={[styles.notesInput, { maxHeight: 94 }]}
                      placeholder="e.g. dark, slow build, playful"
                      placeholderTextColor={colors.muted}
                      value={newVibe}
                      onChangeText={setNewVibe}
                      multiline
                      textAlignVertical="top"
                    />
                  )}

                  <TouchableOpacity style={styles.collapsibleRow} onPress={() => setVerbiageOpen(o => !o)}>
                    <Text style={styles.sectionLabel}>VERBIAGE</Text>
                    <Feather name={verbiageOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} />
                  </TouchableOpacity>
                  {verbiageOpen && (
                    <TextInput
                      style={[styles.notesInput, { maxHeight: 140 }]}
                      placeholder="Full script or phrasing..."
                      placeholderTextColor={colors.muted}
                      value={newVerbiage}
                      onChangeText={setNewVerbiage}
                      multiline
                      textAlignVertical="top"
                    />
                  )}

                  <TouchableOpacity style={styles.collapsibleRow} onPress={() => setCuesOpen(o => !o)}>
                    <Text style={styles.sectionLabel}>CUES</Text>
                    <Feather name={cuesOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} />
                  </TouchableOpacity>
                  {cuesOpen && (
                    <TextInput
                      style={[styles.notesInput, { maxHeight: 94 }]}
                      placeholder="Keyword cues, one per line (e.g. reach for hat)"
                      placeholderTextColor={colors.muted}
                      value={newCues}
                      onChangeText={setNewCues}
                      multiline
                      textAlignVertical="top"
                    />
                  )}

                  <TouchableOpacity style={styles.collapsibleRow} onPress={() => setNotesOpen(o => !o)}>
                    <Text style={styles.sectionLabel}>NOTES</Text>
                    <Feather name={notesOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} />
                  </TouchableOpacity>
                  {notesOpen && (
                    <TextInput
                      style={[styles.notesInput, { maxHeight: 94 }]}
                      placeholder="Setup, props, private reminders..."
                      placeholderTextColor={colors.muted}
                      value={newNotes}
                      onChangeText={setNewNotes}
                      multiline
                      textAlignVertical="top"
                    />
                  )}

                  <View style={styles.modalButtons}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={maybeCloseCreate}>
                      <Text style={styles.cancelBtnText}>Back</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleCreateNew}>
                      <Text style={styles.saveBtnText}>Save & Add</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {/* ── EDIT: modify a routine block (does not update library) ── */}
              {modalView === 'edit' && (
                <View style={styles.blockFormInner}>
                  <TextInput
                    style={styles.sheetInput}
                    placeholder="Block title"
                    placeholderTextColor={colors.muted}
                    value={editTitle}
                    onChangeText={setEditTitle}
                    autoFocus
                  />

                  <View style={styles.durationHeader}>
                    <Text style={styles.sectionLabel}>DURATION</Text>
                    <TouchableOpacity onPress={() => setEditDurationSkipped((s) => !s)}>
                      <Text style={styles.skip}>{editDurationSkipped ? 'SET' : 'SKIP'}</Text>
                    </TouchableOpacity>
                  </View>
                  {editDurationSkipped ? (
                    <TouchableOpacity
                      style={styles.skippedRow}
                      onPress={() => setEditDurationSkipped(false)}
                    >
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
                        <DrumColumn
                          values={MINUTES}
                          selectedIndex={editDurationMin}
                          onSelect={setEditDurationMin}
                        />
                        <Text style={styles.colon}>:</Text>
                        <DrumColumn
                          values={SECONDS}
                          selectedIndex={editDurationSec}
                          onSelect={setEditDurationSec}
                        />
                      </View>
                      <View style={styles.drumLabels}>
                        <Text style={styles.drumLabel}>MIN</Text>
                        <Text style={styles.drumLabel}>SEC</Text>
                      </View>
                      <View style={styles.presetRow}>
                        {PRESETS.map((m) => (
                          <TouchableOpacity
                            key={m}
                            style={[
                              styles.preset,
                              editDurationMin === m && editDurationSec === 0 && styles.presetActive,
                            ]}
                            onPress={() => { setEditDurationMin(m); setEditDurationSec(0); }}
                          >
                            <Text
                              style={[
                                styles.presetText,
                                editDurationMin === m && editDurationSec === 0 && styles.presetTextActive,
                              ]}
                            >
                              {m} MIN
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </>
                  )}

                  <TouchableOpacity style={styles.collapsibleRow} onPress={() => setDescriptionOpen(o => !o)}>
                    <Text style={styles.sectionLabel}>DESCRIPTION</Text>
                    <Feather name={descriptionOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} />
                  </TouchableOpacity>
                  {descriptionOpen && (
                    <TextInput
                      style={[styles.notesInput, { maxHeight: 94 }]}
                      placeholder="What is this bit about?"
                      placeholderTextColor={colors.muted}
                      value={newDescription}
                      onChangeText={setNewDescription}
                      multiline
                      numberOfLines={3}
                      textAlignVertical="top"
                    />
                  )}

                  <TouchableOpacity style={styles.collapsibleRow} onPress={() => setVibeOpen(o => !o)}>
                    <Text style={styles.sectionLabel}>VIBE</Text>
                    <Feather name={vibeOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} />
                  </TouchableOpacity>
                  {vibeOpen && (
                    <TextInput
                      style={[styles.notesInput, { maxHeight: 94 }]}
                      placeholder="e.g. dark, slow build, playful"
                      placeholderTextColor={colors.muted}
                      value={editVibe}
                      onChangeText={setEditVibe}
                      multiline
                      textAlignVertical="top"
                    />
                  )}

                  <TouchableOpacity style={styles.collapsibleRow} onPress={() => setVerbiageOpen(o => !o)}>
                    <Text style={styles.sectionLabel}>VERBIAGE</Text>
                    <Feather name={verbiageOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} />
                  </TouchableOpacity>
                  {verbiageOpen && (
                    <TextInput
                      style={[styles.notesInput, { maxHeight: 140 }]}
                      placeholder="Full script or phrasing..."
                      placeholderTextColor={colors.muted}
                      value={editVerbiage}
                      onChangeText={setEditVerbiage}
                      multiline
                      textAlignVertical="top"
                    />
                  )}

                  <TouchableOpacity style={styles.collapsibleRow} onPress={() => setCuesOpen(o => !o)}>
                    <Text style={styles.sectionLabel}>CUES</Text>
                    <Feather name={cuesOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} />
                  </TouchableOpacity>
                  {cuesOpen && (
                    <TextInput
                      style={[styles.notesInput, { maxHeight: 94 }]}
                      placeholder="Keyword cues, one per line (e.g. reach for hat)"
                      placeholderTextColor={colors.muted}
                      value={editCues}
                      onChangeText={setEditCues}
                      multiline
                      textAlignVertical="top"
                    />
                  )}

                  <TouchableOpacity style={styles.collapsibleRow} onPress={() => setNotesOpen(o => !o)}>
                    <Text style={styles.sectionLabel}>NOTES</Text>
                    <Feather name={notesOpen ? 'chevron-up' : 'chevron-down'} size={14} color={colors.muted} />
                  </TouchableOpacity>
                  {notesOpen && (
                    <TextInput
                      style={[styles.notesInput, { maxHeight: 94 }]}
                      placeholder="Setup, props, private reminders..."
                      placeholderTextColor={colors.muted}
                      value={editNotes}
                      onChangeText={setEditNotes}
                      multiline
                      textAlignVertical="top"
                    />
                  )}

                  <View style={styles.modalButtons}>
                    <TouchableOpacity style={styles.cancelBtn} onPress={closeModal}>
                      <Text style={styles.cancelBtnText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.saveBtn} onPress={handleSaveEdit}>
                      <Text style={styles.saveBtnText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Discard new block prompt — rendered inside the modal to avoid iOS stacking issue */}
            {discardCreatePrompt && (
              <View style={[styles.exitOverlay, { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }]}>
                <View style={styles.exitCard}>
                  <Text style={styles.exitTitle}>Discard bit?</Text>
                  <Text style={styles.exitBody}>
                    This bit hasn't been saved. Going back will lose what you've entered.
                  </Text>
                  <TouchableOpacity
                    style={styles.exitDiscardBtn}
                    onPress={() => { setDiscardCreatePrompt(false); setModalView('picker'); }}
                  >
                    <Text style={styles.exitDiscardBtnText}>Discard</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.exitCancelBtn}
                    onPress={() => setDiscardCreatePrompt(false)}
                  >
                    <Text style={styles.exitCancelBtnText}>Keep editing</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
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
  closeBtn: { color: colors.muted, fontSize: 18 },
  content: { paddingHorizontal: 24, paddingBottom: 24 },
  runInfoTouchable: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  runTitle: {
    color: colors.cream,
    fontSize: 32,
    fontFamily: 'Georgia',
    flex: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timeLeft: { flexDirection: 'row', alignItems: 'baseline' },
  timeBig: {
    color: colors.cream,
    fontSize: 24,
    fontWeight: '300',
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  timeTarget: { color: colors.muted, fontSize: 16 },
  timeDiff: { color: colors.gold, fontSize: 11, letterSpacing: 1.5 },
  timeDiffOver: { color: '#e05555' },
  divider: {
    height: 1,
    backgroundColor: colors.gold,
    opacity: 0.3,
    marginBottom: 32,
  },
  empty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  emptyTitle: {
    color: colors.muted,
    fontSize: 18,
    fontFamily: 'Georgia',
    fontStyle: 'italic',
  },
  emptyBody: { color: colors.muted, fontSize: 14, marginBottom: 24 },
  addFirstButton: {
    backgroundColor: colors.gold,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
  },
  addFirstText: { color: '#1a1100', fontSize: 15, fontWeight: '600' },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    backgroundColor: colors.surface,
    borderRadius: 8,
    gap: 12,
  },
  blockIndex: {
    color: colors.muted,
    fontSize: 13,
    fontVariant: ['tabular-nums'],
    width: 24,
  },
  blockInfo: { flex: 1 },
  blockTitle: {
    color: colors.cream,
    fontSize: 16,
    fontFamily: 'Georgia',
    marginBottom: 4,
  },
  blockMeta: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  blockType: { color: colors.gold, fontSize: 10, letterSpacing: 1.5 },
  blockDuration: {
    color: colors.muted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  libraryBadge: {
    color: colors.gold,
    fontSize: 9,
    letterSpacing: 1,
    opacity: 0.6,
  },
  vibePreview: {
    color: colors.gold,
    fontSize: 11,
    fontStyle: 'italic',
    letterSpacing: 0.5,
    marginTop: 4,
    opacity: 0.8,
  },
  notesPreview: {
    color: colors.muted,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },
  blockActions: { flexDirection: 'row', gap: 2 },
  iconBtn: { padding: 6 },
  iconBtnText: { color: colors.muted, fontSize: 18 },
  addMore: { paddingVertical: 20, alignItems: 'center' },
  addMoreText: { color: colors.gold, fontSize: 14, letterSpacing: 1 },
  scrollArrow: {
    position: 'absolute',
    right: 24,
    bottom: 116,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { paddingHorizontal: 24, paddingBottom: 40, paddingTop: 16 },
  startButton: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 18,
    alignItems: 'center',
  },
  startButtonDisabled: { opacity: 0.35 },
  startButtonText: { color: '#1a1100', fontSize: 16, fontWeight: '700' },
  // Modal shell
  fullScreen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  fullScreenHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 20,
  },
  fullScreenClose: { color: colors.muted, fontSize: 18 },
  formContent: { paddingHorizontal: 24, paddingBottom: 40 },
  blockFormContent: { paddingHorizontal: 24, paddingBottom: 40, flexGrow: 1 },
  blockFormInner: { flex: 1, justifyContent: 'space-between' },
  sheetHeading: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 2.5,
  },
  sectionLabel: {
    color: colors.muted,
    fontSize: 14,
    letterSpacing: 2
  },
  sheetInput: {
    color: colors.cream,
    fontSize: 26,
    fontFamily: 'Georgia',
    borderBottomWidth: 1,
    borderBottomColor: colors.gold,
    paddingVertical: 8,
    marginBottom: 32,
  },
  // Picker tabs
  pickerTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  pickerTab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pickerTabActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  pickerTabText: {
    color: colors.muted,
    fontSize: 12,
    letterSpacing: 2,
    fontWeight: '600',
  },
  pickerTabTextActive: {
    color: '#1a1100',
  },
  pickerNewLink: {
    marginBottom: 20,
  },
  pickerNewLinkText: {
    color: colors.gold,
    fontSize: 13,
    letterSpacing: 0.5,
  },
  // Picker
  emptyLibrary: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 16,
  },
  libraryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  libraryInfo: { flex: 1 },
  libraryTitle: { color: colors.cream, fontSize: 16, fontFamily: 'Georgia', marginBottom: 2 },
  libraryMeta: { color: colors.muted, fontSize: 11, letterSpacing: 1.5 },
  libraryPlus: { color: colors.gold, fontSize: 22, paddingLeft: 12 },
  pickerActions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  pickerActionBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.gold,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pickerActionText: {
    color: colors.gold,
    fontSize: 13,
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  pickerDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginVertical: 20,
  },
  // Create / Edit form
  typeToggle: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 28 },
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
  skippedRow: { marginBottom: 24, alignItems: 'center' },
  skipped: { color: colors.gold, fontSize: 14, textAlign: 'center' },
  drumRow: {
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
    paddingTop: 10,
    fontSize: 14,
    lineHeight: 22,
    minHeight: 80,
    marginBottom: 24,
  },
  collapsibleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    marginBottom: 4,
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 16,
    backgroundColor: colors.bg,
  },
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
  // Exit prompt
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
  exitSaveBtn: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
  },
  exitSaveBtnText: { color: '#1a1100', fontSize: 15, fontWeight: '700' },
  exitDiscardBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  exitDiscardBtnText: { color: '#c0392b', fontSize: 15, fontWeight: '500' },
  exitCancelBtn: { alignItems: 'center', paddingVertical: 4 },
  exitCancelBtnText: { color: colors.muted, fontSize: 14, letterSpacing: 0.5 },
  promptSettingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  promptSettingLabel: { color: colors.muted, fontSize: 11, letterSpacing: 2 },
  promptChipGroup: { flexDirection: 'row', gap: 8 },
  promptChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  promptChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  promptChipText: { color: colors.muted, fontSize: 11, letterSpacing: 1 },
  promptChipTextActive: { color: '#1a1100', fontWeight: '600' },
});
