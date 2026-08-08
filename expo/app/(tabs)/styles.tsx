import { useArt } from '@/contexts/ArtContext';
import * as ImagePicker from 'expo-image-picker';
import { Plus, Trash2, ImageOff } from 'lucide-react-native';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function StylesScreen() {
  const { customStyles, addCustomStyleMutation, deleteCustomStyle } = useArt();
  const [modalVisible, setModalVisible] = useState(false);
  const [styleName, setStyleName] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const pickImage = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets[0]) {
      setSelectedImage(result.assets[0].uri);
    }
  };

  const handleCreateStyle = async () => {
    if (!styleName.trim() || !selectedImage) {
      Alert.alert('Error', 'Please provide a name and select an image');
      return;
    }

    try {
      await addCustomStyleMutation.mutateAsync({
        name: styleName.trim(),
        imageUri: selectedImage,
      });
      
      setModalVisible(false);
      setStyleName('');
      setSelectedImage(null);
    } catch (error) {
      console.error('Error creating style:', error);
      Alert.alert('Error', 'Failed to create custom style');
    }
  };

  const handleDeleteStyle = (id: string, name: string) => {
    Alert.alert(
      'Delete Style',
      `Are you sure you want to delete "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => deleteCustomStyle(id),
        },
      ]
    );
  };

  return (
    <View style={styles.container}>
      {customStyles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconContainer}>
            <ImageOff color="#475569" size={64} />
          </View>
          <Text style={styles.emptyTitle}>No custom styles yet</Text>
          <Text style={styles.emptyText}>
            Create your own art styles by uploading reference images
          </Text>
        </View>
      ) : (
        <FlatList
          data={customStyles}
          keyExtractor={(item) => item.id}
          numColumns={2}
          contentContainerStyle={styles.grid}
          renderItem={({ item }) => (
            <View style={styles.styleCard}>
              <Image
                source={{
                  uri: `data:${item.mimeType};base64,${item.referenceImage}`,
                }}
                style={styles.styleImage}
                resizeMode="cover"
              />
              <View style={styles.styleInfo}>
                <Text style={styles.styleName} numberOfLines={1}>
                  {item.name}
                </Text>
              </View>
              <Pressable
                style={styles.deleteButton}
                onPress={() => handleDeleteStyle(item.id, item.name)}
              >
                <Trash2 color="#EF4444" size={18} />
              </Pressable>
            </View>
          )}
        />
      )}

      <Pressable
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <Plus color="#FFFFFF" size={28} />
      </Pressable>

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create Custom Style</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Style name (e.g., My Painting Style)"
              placeholderTextColor="#94A3B8"
              value={styleName}
              onChangeText={setStyleName}
            />

            <Pressable style={styles.imagePicker} onPress={pickImage}>
              {selectedImage ? (
                <Image
                  source={{ uri: selectedImage }}
                  style={styles.selectedImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.imagePickerEmpty}>
                  <Plus color="#8B5CF6" size={32} />
                  <Text style={styles.imagePickerText}>
                    Upload Reference Image
                  </Text>
                </View>
              )}
            </Pressable>

            <Text style={styles.helpText}>
              Upload an image that represents the style you want to replicate.
              The AI will use this as a style reference for your generations.
            </Text>

            <View style={styles.modalButtons}>
              <Pressable
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setModalVisible(false);
                  setStyleName('');
                  setSelectedImage(null);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
              
              <Pressable
                style={[
                  styles.modalButton,
                  styles.createButton,
                  (!styleName.trim() || !selectedImage || addCustomStyleMutation.isPending) &&
                    styles.createButtonDisabled,
                ]}
                onPress={handleCreateStyle}
                disabled={!styleName.trim() || !selectedImage || addCustomStyleMutation.isPending}
              >
                {addCustomStyleMutation.isPending ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.createButtonText}>Create Style</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  emptyContainer: {
    flex: 1,
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
  grid: {
    padding: 12,
    paddingBottom: 80,
  },
  styleCard: {
    flex: 1,
    margin: 6,
    aspectRatio: 1,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    maxWidth: '48%',
  },
  styleImage: {
    width: '100%',
    height: '100%',
  },
  styleInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
  },
  styleName: {
    color: '#F1F5F9',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(15, 23, 42, 0.9)',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: {
    color: '#F1F5F9',
    fontSize: 24,
    fontWeight: '700' as const,
    marginBottom: 24,
  },
  input: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 16,
    color: '#F1F5F9',
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  imagePicker: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    height: 200,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed' as const,
    overflow: 'hidden',
  },
  imagePickerEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  imagePickerText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: '600' as const,
    marginTop: 8,
  },
  selectedImage: {
    width: '100%',
    height: '100%',
  },
  helpText: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#334155',
  },
  cancelButtonText: {
    color: '#F1F5F9',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  createButton: {
    backgroundColor: '#8B5CF6',
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
  },
});
