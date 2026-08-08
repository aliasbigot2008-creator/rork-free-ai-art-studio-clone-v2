import { DEFAULT_FOLDER, GeneratedArt, GalleryFolder, useArt } from '@/contexts/ArtContext';
import { router } from 'expo-router';
import {
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  Check,
  Folder,
  ImageOff,
  Images,
  PenLine,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react-native';
import React, { memo, useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  ListRenderItemInfo,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

const GRID_GAP = 10;
const HORIZONTAL_PADDING = 16;
const MAX_RENDERED_IMAGE_EDGE = 420;

type SortMode = 'newest' | 'oldest';

// ── Gallery card ───────────────────────────────────────────────────────

type GalleryItemProps = {
  item: GeneratedArt;
  cardSize: number;
  imageUri: string;
  linkedCount: number;
};

const GalleryItem = memo(({ item, cardSize, imageUri, linkedCount }: GalleryItemProps) => {
  const [hasImageError, setHasImageError] = useState<boolean>(false);

  const openArtwork = useCallback((): void => {
    router.push(`/art/${item.id}`);
  }, [item.id]);

  const handleImageError = useCallback(() => setHasImageError(true), []);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.artCard,
        { width: cardSize, height: cardSize },
        pressed && styles.artCardPressed,
      ]}
      onPress={openArtwork}
      accessibilityRole="button"
      accessibilityLabel={`Open artwork: ${item.prompt}`}
    >
      {imageUri && !hasImageError ? (
        <Image
          source={{ uri: imageUri }}
          style={styles.artImage}
          resizeMode="cover"
          resizeMethod="resize"
          fadeDuration={180}
          onError={handleImageError}
        />
      ) : (
        <View style={styles.brokenImageState}>
          <ImageOff color="#94A3B8" size={30} />
          <Text style={styles.brokenImageText}>Preview unavailable</Text>
        </View>
      )}
      {linkedCount > 1 && (
        <View style={styles.stackBadge}>
          <Images color="#F8FAFC" size={12} />
          <Text style={styles.stackBadgeText}>{linkedCount}</Text>
        </View>
      )}
      <View style={styles.artOverlay}>
        <Text style={styles.artPrompt} numberOfLines={2}>
          {item.prompt || 'Untitled artwork'}
        </Text>
        <View style={styles.artStyleBadge}>
          <Sparkles color="#F8FAFC" size={10} />
          <Text style={styles.artStyleText} numberOfLines={1}>
            {formatStyleName(item.style)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
});

GalleryItem.displayName = 'GalleryItem';

// ── Folder chip ────────────────────────────────────────────────────────

type FolderChipProps = {
  folder: GalleryFolder;
  count: number;
  isSelected: boolean;
  onPress: (id: string) => void;
  onLongPress: (id: string, name: string) => void;
};

const FolderChip = memo(
  ({ folder, count, isSelected, onPress, onLongPress }: FolderChipProps) => {
    const handlePress = useCallback(() => onPress(folder.id), [folder.id, onPress]);
    const handleLongPress = useCallback(
      () => onLongPress(folder.id, folder.name),
      [folder.id, folder.name, onLongPress],
    );

    return (
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={400}
        style={({ pressed }) => [
          styles.folderChip,
          isSelected && styles.folderChipSelected,
          pressed && styles.folderChipPressed,
        ]}
        accessibilityRole="button"
        accessibilityLabel={`Folder: ${folder.name}`}
      >
        <Folder color={isSelected ? '#020617' : '#CBD5E1'} size={16} />
        <View style={styles.folderTextGroup}>
          <Text
            style={[styles.folderName, isSelected && styles.folderNameSelected]}
            numberOfLines={1}
          >
            {folder.name}
          </Text>
          <Text
            style={[styles.folderCount, isSelected && styles.folderCountSelected]}
          >
            {count} image{count === 1 ? '' : 's'}
          </Text>
        </View>
      </Pressable>
    );
  },
);

FolderChip.displayName = 'FolderChip';

// ── Create folder modal ────────────────────────────────────────────────

type CreateFolderModalProps = {
  visible: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
};

function CreateFolderModal({ visible, onClose, onCreate }: CreateFolderModalProps) {
  const [name, setName] = useState<string>('');

  const handleCreate = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setName('');
    onClose();
  }, [name, onCreate, onClose]);

  const handleClose = useCallback(() => {
    setName('');
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Gallery</Text>
            <Pressable onPress={handleClose} style={styles.modalCloseButton}>
              <X color="#94A3B8" size={20} />
            </Pressable>
          </View>

          <Text style={styles.modalLabel}>Gallery name</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="e.g. Cyberpunk Portraits, Ink Sketches…"
            placeholderTextColor="#475569"
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />

          <View style={styles.modalActions}>
            <Pressable style={styles.modalCancel} onPress={handleClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.modalConfirm, !name.trim() && styles.modalConfirmDisabled]}
              onPress={handleCreate}
              disabled={!name.trim()}
            >
              <Check color="#fff" size={18} />
              <Text style={styles.modalConfirmText}>Create</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Rename folder modal ────────────────────────────────────────────────

type RenameFolderModalProps = {
  visible: boolean;
  folderId: string;
  currentName: string;
  onClose: () => void;
  onRename: (folderId: string, name: string) => void;
};

function RenameFolderModal({
  visible,
  folderId,
  currentName,
  onClose,
  onRename,
}: RenameFolderModalProps) {
  const [name, setName] = useState<string>(currentName);

  const handleRename = useCallback(() => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onRename(folderId, trimmed);
    onClose();
  }, [name, folderId, onRename, onClose]);

  const handleClose = useCallback(() => {
    setName(currentName);
    onClose();
  }, [currentName, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Rename Gallery</Text>
            <Pressable onPress={handleClose} style={styles.modalCloseButton}>
              <X color="#94A3B8" size={20} />
            </Pressable>
          </View>

          <Text style={styles.modalLabel}>New name</Text>
          <TextInput
            style={styles.modalInput}
            placeholder="Enter a new name…"
            placeholderTextColor="#475569"
            value={name}
            onChangeText={setName}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={handleRename}
          />

          <View style={styles.modalActions}>
            <Pressable style={styles.modalCancel} onPress={handleClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.modalConfirm, !name.trim() && styles.modalConfirmDisabled]}
              onPress={handleRename}
              disabled={!name.trim()}
            >
              <PenLine color="#fff" size={18} />
              <Text style={styles.modalConfirmText}>Rename</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Main screen ────────────────────────────────────────────────────────

export default function GalleryScreen() {
  const {
    gallery,
    folders,
    batches,
    getImageUri,
    isLoading,
    createFolder,
    renameFolder,
    deleteFolder,
  } = useArt();

  const [selectedFolderId, setSelectedFolderId] = useState<string>(DEFAULT_FOLDER.id);
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [isCreateModalOpen, setCreateModalOpen] = useState<boolean>(false);
  const [renameTarget, setRenameTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const { width } = useWindowDimensions();

  const cardSize = useMemo<number>(() => {
    const availableWidth = width - HORIZONTAL_PADDING * 2 - GRID_GAP;
    return Math.min(Math.floor(availableWidth / 2), MAX_RENDERED_IMAGE_EDGE);
  }, [width]);

  const folderCounts = useMemo<Record<string, number>>(() => {
    return gallery.reduce<Record<string, number>>(
      (accumulator, art) => {
        const id = art.folderId ?? DEFAULT_FOLDER.id;
        accumulator[DEFAULT_FOLDER.id] = (accumulator[DEFAULT_FOLDER.id] ?? 0) + 1;
        accumulator[id] = (accumulator[id] ?? 0) + 1;
        return accumulator;
      },
      { [DEFAULT_FOLDER.id]: 0 },
    );
  }, [gallery]);

  const visibleGallery = useMemo<GeneratedArt[]>(() => {
    const filtered =
      selectedFolderId === DEFAULT_FOLDER.id
        ? gallery
        : gallery.filter((art) => (art.folderId ?? DEFAULT_FOLDER.id) === selectedFolderId);

    return [...filtered].sort((a, b) =>
      sortMode === 'newest' ? b.createdAt - a.createdAt : a.createdAt - b.createdAt,
    );
  }, [gallery, selectedFolderId, sortMode]);

  const handleSortToggle = useCallback(() => {
    setSortMode((prev) => (prev === 'newest' ? 'oldest' : 'newest'));
  }, []);

  const handleCreateFolder = useCallback(
    (name: string) => {
      createFolder(name);
    },
    [createFolder],
  );

  const handleFolderLongPress = useCallback(
    (folderId: string, folderName: string) => {
      if (folderId === DEFAULT_FOLDER.id) return;

      Alert.alert(folderName, 'What would you like to do?', [
        {
          text: 'Rename',
          onPress: () => setRenameTarget({ id: folderId, name: folderName }),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete Gallery',
              `Move all artwork in "${folderName}" back to "All Artwork" and delete this gallery?`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    deleteFolder(folderId);
                    if (selectedFolderId === folderId) {
                      setSelectedFolderId(DEFAULT_FOLDER.id);
                    }
                  },
                },
              ],
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    },
    [deleteFolder, selectedFolderId],
  );

  const handleRenameFolder = useCallback(
    (folderId: string, newName: string) => {
      renameFolder(folderId, newName);
      setRenameTarget(null);
    },
    [renameFolder],
  );

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<GeneratedArt>) => (
      <GalleryItem
        item={item}
        cardSize={cardSize}
        imageUri={getImageUri(item)}
        linkedCount={batches[item.batchId ?? item.id]?.length ?? 1}
      />
    ),
    [batches, cardSize, getImageUri],
  );

  const renderFolder = useCallback(
    (folder: GalleryFolder) => (
      <FolderChip
        key={folder.id}
        folder={folder}
        count={folderCounts[folder.id] ?? 0}
        isSelected={folder.id === selectedFolderId}
        onPress={setSelectedFolderId}
        onLongPress={handleFolderLongPress}
      />
    ),
    [folderCounts, selectedFolderId, handleFolderLongPress],
  );

  const itemSeparator = useCallback(() => <View style={styles.rowSeparator} />, []);
  const keyExtractor = useCallback((item: GeneratedArt): string => item.id, []);

  const getItemLayout = useCallback(
    (_: ArrayLike<GeneratedArt> | null | undefined, index: number) => ({
      length: cardSize + GRID_GAP,
      offset: Math.floor(index / 2) * (cardSize + GRID_GAP),
      index,
    }),
    [cardSize],
  );

  // ── Loading ──────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#38BDF8" />
      </View>
    );
  }

  // ── Empty ────────────────────────────────────────────────────────────

  if (gallery.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <View style={styles.emptyIconContainer}>
          <ImageOff color="#475569" size={64} />
        </View>
        <Text style={styles.emptyTitle}>No artwork yet</Text>
        <Text style={styles.emptyText}>
          Generate your first image from the Create tab and it will appear here.
          You can then organize it into your own custom galleries.
        </Text>
      </View>
    );
  }

  // ── Full UI ──────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.headerBlock}>
        <Text style={styles.headerEyebrow}>Library Vault</Text>
        <View style={styles.headerTitleRow}>
          <Text style={styles.headerTitle}>My Galleries</Text>
          <Pressable
            style={({ pressed }) => [styles.sortButton, pressed && styles.sortButtonPressed]}
            onPress={handleSortToggle}
            accessibilityLabel={`Sort: ${sortMode === 'newest' ? 'newest first' : 'oldest first'}`}
          >
            {sortMode === 'newest' ? (
              <ArrowDownNarrowWide color="#67E8F9" size={18} />
            ) : (
              <ArrowUpNarrowWide color="#67E8F9" size={18} />
            )}
          </Pressable>
        </View>
        <Text style={styles.headerSubtitle}>
          {gallery.length} images · {folders.length} galleries · sorted by{' '}
          {sortMode === 'newest' ? 'newest' : 'oldest'}
        </Text>
      </View>

      {/* Folder rail */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.folderRail}
      >
        {folders.map(renderFolder)}

        {/* New folder button */}
        <Pressable
          onPress={() => setCreateModalOpen(true)}
          style={({ pressed }) => [
            styles.newFolderChip,
            pressed && styles.newFolderChipPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Create new gallery"
        >
          <Plus color="#67E8F9" size={18} />
          <Text style={styles.newFolderText}>New</Text>
        </Pressable>
      </ScrollView>

      {/* Grid */}
      <FlatList
        data={visibleGallery}
        keyExtractor={keyExtractor}
        numColumns={2}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.columnWrapper}
        renderItem={renderItem}
        ItemSeparatorComponent={itemSeparator}
        getItemLayout={getItemLayout}
        initialNumToRender={8}
        maxToRenderPerBatch={6}
        windowSize={9}
        removeClippedSubviews
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.folderEmptyState}>
            <Folder color="#64748B" size={42} />
            <Text style={styles.folderEmptyText}>This gallery is empty.</Text>
            <Text style={styles.folderEmptyHint}>
              Move artwork here from another gallery.
            </Text>
          </View>
        }
      />

      {/* Create folder modal */}
      <CreateFolderModal
        visible={isCreateModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onCreate={handleCreateFolder}
      />

      {/* Rename folder modal */}
      {renameTarget && (
        <RenameFolderModal
          visible={!!renameTarget}
          folderId={renameTarget.id}
          currentName={renameTarget.name}
          onClose={() => setRenameTarget(null)}
          onRename={handleRenameFolder}
        />
      )}
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#07111F' },
  centerContainer: {
    flex: 1,
    backgroundColor: '#07111F',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Empty state ──────────────────────────────────────────────────────

  emptyContainer: {
    flex: 1,
    backgroundColor: '#07111F',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    color: '#F1F5F9',
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 8,
  },
  emptyText: {
    color: '#94A3B8',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },

  // ── Header ───────────────────────────────────────────────────────────

  headerBlock: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 10 },
  headerEyebrow: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '800' as const,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  headerTitle: {
    color: '#F8FAFC',
    fontSize: 28,
    fontWeight: '900' as const,
  },
  sortButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: '#0B1A30',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(103, 232, 249, 0.25)',
  },
  sortButtonPressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
  headerSubtitle: { color: '#94A3B8', fontSize: 13, marginTop: 4 },

  // ── Folder rail ──────────────────────────────────────────────────────

  folderRail: { paddingHorizontal: 16, paddingBottom: 14, gap: 10 },
  folderChip: {
    minWidth: 140,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: '#101C2F',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.16)',
  },
  folderChipSelected: {
    backgroundColor: '#67E8F9',
    borderColor: '#A5F3FC',
  },
  folderChipPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  folderTextGroup: { flexShrink: 1 },
  folderName: {
    color: '#E2E8F0',
    fontSize: 13,
    fontWeight: '800' as const,
    maxWidth: 96,
  },
  folderNameSelected: { color: '#020617' },
  folderCount: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  folderCountSelected: { color: '#164E63' },

  // ── New folder chip ─────────────────────────────────────────────────

  newFolderChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: 'rgba(103, 232, 249, 0.4)',
    borderStyle: 'dashed' as const,
    backgroundColor: 'transparent',
  },
  newFolderChipPressed: { opacity: 0.7, borderColor: '#67E8F9' },
  newFolderText: {
    color: '#67E8F9',
    fontSize: 13,
    fontWeight: '800' as const,
  },

  // ── Grid ─────────────────────────────────────────────────────────────

  grid: { paddingHorizontal: HORIZONTAL_PADDING, paddingTop: 2, paddingBottom: 28 },
  columnWrapper: { gap: GRID_GAP },
  rowSeparator: { height: GRID_GAP },
  artCard: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#111C2E',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.16)',
  },
  artCardPressed: { opacity: 0.84, transform: [{ scale: 0.985 }] },
  artImage: { width: '100%', height: '100%', backgroundColor: '#111827' },
  brokenImageState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    backgroundColor: '#111827',
  },
  brokenImageText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600' as const,
    marginTop: 8,
    textAlign: 'center',
  },
  stackBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(2, 6, 23, 0.78)',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  stackBadgeText: { color: '#F8FAFC', fontSize: 11, fontWeight: '900' as const },
  artOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(7, 17, 31, 0.82)',
  },
  artPrompt: { color: '#F1F5F9', fontSize: 12, fontWeight: '500' as const, marginBottom: 6 },
  artStyleBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
    backgroundColor: '#2563EB',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  artStyleText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700' as const,
    maxWidth: 100,
  },

  // ── Folder empty state ───────────────────────────────────────────────

  folderEmptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 64 },
  folderEmptyText: {
    color: '#94A3B8',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '700' as const,
  },
  folderEmptyHint: { color: '#64748B', fontSize: 13, marginTop: 6 },

  // ── Modals ───────────────────────────────────────────────────────────

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.82)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#101C2F',
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.16)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  modalTitle: { color: '#F1F5F9', fontSize: 20, fontWeight: '800' as const },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalLabel: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '700' as const,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.6,
  },
  modalInput: {
    backgroundColor: '#07111F',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#F1F5F9',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 22,
  },
  modalActions: { flexDirection: 'row', gap: 12 },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#1E293B',
    alignItems: 'center',
  },
  modalCancelText: { color: '#F1F5F9', fontSize: 15, fontWeight: '600' as const },
  modalConfirm: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  modalConfirmDisabled: { backgroundColor: '#1E293B', opacity: 0.5 },
  modalConfirmText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' as const },
});

// ── Helpers ────────────────────────────────────────────────────────────

function formatStyleName(style: string): string {
  return style
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}
