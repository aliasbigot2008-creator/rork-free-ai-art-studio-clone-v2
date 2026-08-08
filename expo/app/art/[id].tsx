import { useArt } from '@/contexts/ArtContext';
import { router, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { Download, Edit2, Images, Share2, Trash2, X } from 'lucide-react-native';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ArtDetailModal() {
  const { id } = useLocalSearchParams();
  const { gallery, batches, deleteArt, editMutation, getImageUri, saveArtToMediaLibrary } = useArt();
  const insets = useSafeAreaInsets();
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editPrompt, setEditPrompt] = useState<string>('');

  const artwork = gallery.find((art) => art.id === id);
  const linkedBatch = artwork ? batches[artwork.batchId ?? artwork.id] ?? [artwork] : [];

  if (!artwork) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}> 
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.closeButton}><X color="#F1F5F9" size={24} /></Pressable>
        </View>
        <View style={styles.errorContainer}><Text style={styles.errorText}>Artwork not found</Text></View>
      </View>
    );
  }

  const handleDelete = (): void => {
    Alert.alert('Delete Artwork', 'Are you sure you want to delete this artwork? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteArt(artwork.id); router.back(); } },
    ]);
  };

  const handleEdit = async (): Promise<void> => {
    if (!editPrompt.trim()) return;
    try {
      const imageUri = getImageUri(artwork);
      const originalImage = artwork.imageData || await uriToBase64(imageUri);
      await editMutation.mutateAsync({ originalImage, editPrompt: editPrompt.trim(), aspectRatio: '1:1' });
      setIsEditing(false);
      setEditPrompt('');
      router.back();
    } catch (error) {
      console.error('Edit error:', error);
      Alert.alert('Error', 'Failed to edit artwork. Please try again.');
    }
  };

  const handleDownload = async (): Promise<void> => {
    try {
      await saveArtToMediaLibrary([artwork.id]);
      Alert.alert('Saved', 'Artwork was saved to your photo library.');
    } catch (error) {
      Alert.alert('Could not save', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeButton}><X color="#F1F5F9" size={24} /></Pressable>
        <View style={styles.headerActions}>
          <Pressable style={styles.iconButton}><Share2 color="#F1F5F9" size={20} /></Pressable>
          <Pressable style={styles.iconButton} onPress={handleDownload}><Download color="#F1F5F9" size={20} /></Pressable>
          <Pressable style={styles.iconButton} onPress={handleDelete}><Trash2 color="#EF4444" size={20} /></Pressable>
        </View>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: getImageUri(artwork) }} style={styles.image} resizeMode="contain" />
        </View>

        <View style={styles.infoSection}>
          <View style={styles.styleBadge}><Text style={styles.styleBadgeText}>{artwork.style.toUpperCase()}</Text></View>
          <Text style={styles.prompt}>{artwork.prompt}</Text>
          <Text style={styles.metadata}>{new Date(artwork.createdAt).toLocaleDateString()} • {artwork.size}</Text>
          {linkedBatch.length > 1 && (
            <View style={styles.batchPanel}>
              <View style={styles.batchTitleRow}><Images color="#67E8F9" size={16} /><Text style={styles.batchTitle}>Linked batch</Text></View>
              <Text style={styles.batchSubtitle}>{linkedBatch.length} variations generated together</Text>
              <View style={styles.batchThumbRow}>
                {linkedBatch.map((item) => (
                  <Pressable key={item.id} onPress={() => router.replace(`/art/${item.id}`)} style={styles.batchThumbButton}>
                    <Image source={{ uri: getImageUri(item) }} style={styles.batchThumb} resizeMode="cover" />
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </View>

        {!isEditing && <Pressable style={styles.editButton} onPress={() => setIsEditing(true)}><Edit2 color="#F1F5F9" size={20} /><Text style={styles.editButtonText}>Remix this artwork</Text></Pressable>}

        {isEditing && (
          <View style={styles.editSection}>
            <Text style={styles.editTitle}>Remix Artwork</Text>
            <Text style={styles.editSubtitle}>Describe how you want to modify this artwork</Text>
            <TextInput style={styles.editInput} placeholder="e.g., make it sunset, add mountains, change to winter..." placeholderTextColor="#64748B" value={editPrompt} onChangeText={setEditPrompt} multiline numberOfLines={4} textAlignVertical="top" />
            <View style={styles.editActions}>
              <Pressable style={styles.editCancelButton} onPress={() => { setIsEditing(false); setEditPrompt(''); }}><Text style={styles.editCancelText}>Cancel</Text></Pressable>
              <Pressable style={[styles.editSubmitButton, (!editPrompt.trim() || editMutation.isPending) && styles.editSubmitButtonDisabled]} onPress={handleEdit} disabled={!editPrompt.trim() || editMutation.isPending}>
                {editMutation.isPending ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.editSubmitText}>Apply Changes</Text>}
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', gap: 12 },
  iconButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1 },
  scrollContent: { paddingBottom: 40 },
  imageContainer: { width: '100%', aspectRatio: 1, backgroundColor: '#1E293B' },
  image: { width: '100%', height: '100%' },
  infoSection: { padding: 20 },
  styleBadge: { alignSelf: 'flex-start', backgroundColor: '#8B5CF6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, marginBottom: 12 },
  styleBadgeText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' as const },
  prompt: { color: '#F1F5F9', fontSize: 18, fontWeight: '600' as const, lineHeight: 28, marginBottom: 8 },
  metadata: { color: '#64748B', fontSize: 14 },
  batchPanel: { marginTop: 18, padding: 14, borderRadius: 18, backgroundColor: '#101C2F', borderWidth: 1, borderColor: 'rgba(103, 232, 249, 0.22)' },
  batchTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  batchTitle: { color: '#F8FAFC', fontSize: 14, fontWeight: '800' as const },
  batchSubtitle: { color: '#94A3B8', fontSize: 12, marginTop: 4, marginBottom: 12 },
  batchThumbRow: { flexDirection: 'row', gap: 8 },
  batchThumbButton: { width: 58, height: 58, borderRadius: 14, overflow: 'hidden', backgroundColor: '#1E293B' },
  batchThumb: { width: '100%', height: '100%' },
  editButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 20, backgroundColor: '#1E293B', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#334155' },
  editButtonText: { color: '#F1F5F9', fontSize: 16, fontWeight: '600' as const },
  editSection: { padding: 20 },
  editTitle: { color: '#F1F5F9', fontSize: 20, fontWeight: '700' as const, marginBottom: 4 },
  editSubtitle: { color: '#94A3B8', fontSize: 14, marginBottom: 16 },
  editInput: { backgroundColor: '#1E293B', borderRadius: 12, padding: 16, color: '#F1F5F9', fontSize: 16, minHeight: 120, borderWidth: 1, borderColor: '#334155', marginBottom: 16 },
  editActions: { flexDirection: 'row', gap: 12 },
  editCancelButton: { flex: 1, backgroundColor: '#1E293B', padding: 16, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  editCancelText: { color: '#F1F5F9', fontSize: 16, fontWeight: '600' as const },
  editSubmitButton: { flex: 1, backgroundColor: '#8B5CF6', padding: 16, borderRadius: 12, alignItems: 'center' },
  editSubmitButtonDisabled: { backgroundColor: '#334155', opacity: 0.5 },
  editSubmitText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' as const },
  errorContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: '#F1F5F9', fontSize: 18 },
});

async function uriToBase64(uri: string): Promise<string> {
  if (uri.startsWith('data:')) return uri.split(',')[1] ?? '';
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}
