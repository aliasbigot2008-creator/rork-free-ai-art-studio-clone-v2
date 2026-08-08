import { useArt, type GeneratedArt } from '@/contexts/ArtContext';
import { generateText } from '@rork-ai/toolkit-sdk';
import { useMutation } from '@tanstack/react-query';
import { Wand2, Sparkles } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const STYLES = [
  { id: 'anime', label: 'Anime', emoji: '🎨' },
  { id: 'realistic', label: 'Realistic', emoji: '📷' },
  { id: 'digital-art', label: 'Digital Art', emoji: '🖼️' },
  { id: 'oil-painting', label: 'Oil Paint', emoji: '🎭' },
  { id: 'watercolor', label: 'Watercolor', emoji: '💧' },
  { id: 'concept-art', label: 'Concept', emoji: '🎬' },
  { id: 'cyberpunk', label: 'Cyberpunk', emoji: '🌃' },
  { id: 'fantasy', label: 'Fantasy', emoji: '✨' },
  { id: 'portrait', label: 'Portrait', emoji: '👤' },
  { id: 'landscape', label: 'Landscape', emoji: '🏔️' },
] as const;

const ASPECT_RATIOS = [
  { id: '1024x1024', label: 'Square', ratio: '1:1' },
  { id: '1024x1792', label: 'Portrait', ratio: '9:16' },
  { id: '1792x1024', label: 'Landscape', ratio: '16:9' },
] as const;

const VARIATIONS = [1, 2, 3, 4] as const;

export default function CreateScreen() {
  const { generateMutation, customStyles, getImageUri } = useArt();
  const [prompt, setPrompt] = useState<string>('');
  const [selectedStyle, setSelectedStyle] = useState<string>('anime');
  const [selectedSize, setSelectedSize] = useState<string>('1024x1024');
  const [variationCount, setVariationCount] = useState<number>(1);

  const promptAssistantMutation = useMutation({
    mutationFn: async ({ mode, input }: { mode: 'generate' | 'refine'; input: string }) => {
      const instruction = mode === 'generate'
        ? 'Create one premium AI art prompt for an image generator. Return only the prompt text. Make it vivid, specific, cinematic, and production-ready in under 90 words.'
        : `Refine this AI art prompt into a richer, more vivid, production-ready image prompt. Preserve the original intent. Return only the improved prompt text. Original prompt: ${input}`;

      console.log('[CreateScreen] Prompt assistant request', {
        mode,
        inputLength: input.length,
      });

      const result = await generateText(instruction);
      return result.trim();
    },
    onSuccess: (nextPrompt) => {
      console.log('[CreateScreen] Prompt assistant success', {
        outputLength: nextPrompt.length,
      });
      setPrompt(nextPrompt);
    },
    onError: (error) => {
      console.error('[CreateScreen] Prompt assistant error', error);
      Alert.alert('Prompt helper unavailable', 'Please try again in a moment.');
    }
  });

  const latestResults = useMemo<GeneratedArt[]>(() => {
    return Array.isArray(generateMutation.data) ? generateMutation.data : [];
  }, [generateMutation.data]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      Alert.alert('Add a prompt', 'Describe the image you want to create first.');
      return;
    }
    
    Keyboard.dismiss();
    
    try {
      await generateMutation.mutateAsync({
        prompt: prompt.trim(),
        style: selectedStyle,
        size: selectedSize,
        variations: variationCount,
      });
    } catch (error) {
      console.error('[CreateScreen] Generation error', error);
      Alert.alert('Generation failed', 'Please check your connection and try again.');
    }
  };

  const handlePromptAssist = async (mode: 'generate' | 'refine') => {
    if (mode === 'refine' && !prompt.trim()) {
      Alert.alert('Add a base prompt', 'Write something first, then tap Refine Prompt.');
      return;
    }

    await promptAssistantMutation.mutateAsync({
      mode,
      input: prompt.trim(),
    });
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        testID="create-scroll-view"
      >
        {(generateMutation.isPending || promptAssistantMutation.isPending) && (
          <View style={styles.generatingContainer}>
            <View style={styles.generatingCard}>
              <ActivityIndicator size="large" color="#F97316" />
              <Text style={styles.generatingText}>
                {generateMutation.isPending ? 'Creating your set...' : 'Sharpening your prompt...'}
              </Text>
              <Text style={styles.generatingSubtext}>
                {generateMutation.isPending
                  ? `Generating ${variationCount} variation${variationCount > 1 ? 's' : ''}`
                  : 'This usually takes a few seconds'}
              </Text>
            </View>
          </View>
        )}

        {latestResults.length > 0 && !generateMutation.isPending && (
          <View style={styles.resultContainer}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultTitle}>Latest set</Text>
              <Text style={styles.resultCount}>{latestResults.length} image{latestResults.length > 1 ? 's' : ''}</Text>
            </View>
            <View style={styles.resultGrid}>
              {latestResults.map((item) => (
                <Image
                  key={item.id}
                  source={{ uri: getImageUri(item) }}
                  style={styles.resultImage}
                  resizeMode="cover"
                  testID={`generated-image-${item.id}`}
                />
              ))}
            </View>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Prompt</Text>
            <View style={styles.promptActionsRow}>
              <Pressable
                style={[styles.promptActionButton, promptAssistantMutation.isPending && styles.promptActionButtonDisabled]}
                onPress={() => handlePromptAssist('generate')}
                disabled={promptAssistantMutation.isPending || generateMutation.isPending}
                testID="generate-prompt-button"
              >
                <Sparkles color="#FED7AA" size={14} />
                <Text style={styles.promptActionText}>Generate Prompt</Text>
              </Pressable>
              <Pressable
                style={[styles.promptActionButton, promptAssistantMutation.isPending && styles.promptActionButtonDisabled]}
                onPress={() => handlePromptAssist('refine')}
                disabled={promptAssistantMutation.isPending || generateMutation.isPending}
                testID="refine-prompt-button"
              >
                <Wand2 color="#FED7AA" size={14} />
                <Text style={styles.promptActionText}>Refine Prompt</Text>
              </Pressable>
            </View>
          </View>
          <TextInput
            style={styles.input}
            placeholder="Describe your artwork..."
            placeholderTextColor="#7C8AA5"
            value={prompt}
            onChangeText={setPrompt}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            testID="prompt-input"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Variations</Text>
          <View style={styles.variationRow}>
            {VARIATIONS.map((count) => (
              <Pressable
                key={count}
                style={[
                  styles.variationButton,
                  variationCount === count && styles.variationButtonActive,
                ]}
                onPress={() => setVariationCount(count)}
                testID={`variation-button-${count}`}
              >
                <Text style={[
                  styles.variationLabel,
                  variationCount === count && styles.variationLabelActive,
                ]}>
                  {count}
                </Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.helperText}>Choose up to 4 images per generation.</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Style</Text>
          
          {customStyles.length > 0 && (
            <>
              <Text style={styles.subsectionTitle}>Custom Styles</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.customStylesScroll}
                contentContainerStyle={styles.customStylesContent}
              >
                {customStyles.map((style) => (
                  <Pressable
                    key={style.id}
                    style={[
                      styles.customStyleCard,
                      selectedStyle === style.id && styles.customStyleCardActive,
                    ]}
                    onPress={() => setSelectedStyle(style.id)}
                    testID={`custom-style-${style.id}`}
                  >
                    <Image
                      source={{
                        uri: `data:${style.mimeType};base64,${style.referenceImage}`,
                      }}
                      style={styles.customStyleImage}
                      resizeMode="cover"
                    />
                    <View style={[
                      styles.customStyleOverlay,
                      selectedStyle === style.id && styles.customStyleOverlayActive,
                    ]}>
                      <Text style={[
                        styles.customStyleLabel,
                        selectedStyle === style.id && styles.customStyleLabelActive,
                      ]} numberOfLines={1}>
                        {style.name}
                      </Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
              
              <Text style={[styles.subsectionTitle, styles.subsectionTitleSpaced]}>Preset Styles</Text>
            </>
          )}
          
          <View style={styles.stylesGrid}>
            {STYLES.map((style) => (
              <Pressable
                key={style.id}
                style={[
                  styles.styleCard,
                  selectedStyle === style.id && styles.styleCardActive,
                ]}
                onPress={() => setSelectedStyle(style.id)}
                testID={`style-${style.id}`}
              >
                <Text style={styles.styleEmoji}>{style.emoji}</Text>
                <Text style={[
                  styles.styleLabel,
                  selectedStyle === style.id && styles.styleLabelActive,
                ]}>
                  {style.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Aspect Ratio</Text>
          <View style={styles.ratiosContainer}>
            {ASPECT_RATIOS.map((aspect) => (
              <Pressable
                key={aspect.id}
                style={[
                  styles.ratioButton,
                  selectedSize === aspect.id && styles.ratioButtonActive,
                ]}
                onPress={() => setSelectedSize(aspect.id)}
                testID={`aspect-${aspect.id}`}
              >
                <Text style={[
                  styles.ratioLabel,
                  selectedSize === aspect.id && styles.ratioLabelActive,
                ]}>
                  {aspect.label}
                </Text>
                <Text style={[
                  styles.ratioText,
                  selectedSize === aspect.id && styles.ratioTextActive,
                ]}>
                  {aspect.ratio}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={[
            styles.generateButton,
            (!prompt.trim() || generateMutation.isPending || promptAssistantMutation.isPending) && styles.generateButtonDisabled,
          ]}
          onPress={handleGenerate}
          disabled={!prompt.trim() || generateMutation.isPending || promptAssistantMutation.isPending}
          testID="generate-art-button"
        >
          <Sparkles color="#FFFFFF" size={20} />
          <Text style={styles.generateButtonText}>
            {generateMutation.isPending ? 'Generating...' : `Generate ${variationCount} Variation${variationCount > 1 ? 's' : ''}`}
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1020',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
  },
  generatingContainer: {
    marginBottom: 20,
  },
  generatingCard: {
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  generatingText: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700' as const,
    marginTop: 16,
  },
  generatingSubtext: {
    color: '#94A3B8',
    fontSize: 14,
    marginTop: 6,
  },
  resultContainer: {
    marginBottom: 24,
    borderRadius: 24,
    padding: 16,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  resultTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  resultCount: {
    color: '#FB923C',
    fontSize: 13,
    fontWeight: '600' as const,
  },
  resultGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  resultImage: {
    width: '48%',
    aspectRatio: 1,
    borderRadius: 18,
    backgroundColor: '#1F2937',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  promptActionsRow: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 1,
  },
  promptActionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#1C2436',
    borderWidth: 1,
    borderColor: '#2B3548',
  },
  promptActionButtonDisabled: {
    opacity: 0.6,
  },
  promptActionText: {
    color: '#FED7AA',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  input: {
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 16,
    color: '#F8FAFC',
    fontSize: 16,
    minHeight: 140,
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  variationRow: {
    flexDirection: 'row',
    gap: 10,
  },
  variationButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#1F2937',
  },
  variationButtonActive: {
    backgroundColor: '#EA580C',
    borderColor: '#FB923C',
  },
  variationLabel: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '700' as const,
  },
  variationLabelActive: {
    color: '#FFFFFF',
  },
  helperText: {
    marginTop: 10,
    color: '#94A3B8',
    fontSize: 13,
  },
  subsectionTitle: {
    color: '#94A3B8',
    fontSize: 14,
    fontWeight: '600' as const,
    marginBottom: 12,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  subsectionTitleSpaced: {
    marginTop: 20,
  },
  customStylesScroll: {
    marginBottom: 8,
  },
  customStylesContent: {
    gap: 12,
    paddingRight: 20,
  },
  customStyleCard: {
    width: 100,
    height: 100,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#1F2937',
  },
  customStyleCardActive: {
    borderColor: '#FB923C',
  },
  customStyleImage: {
    width: '100%',
    height: '100%',
  },
  customStyleOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(11, 16, 32, 0.9)',
    padding: 6,
  },
  customStyleOverlayActive: {
    backgroundColor: 'rgba(234, 88, 12, 0.92)',
  },
  customStyleLabel: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  customStyleLabelActive: {
    color: '#FFFFFF',
  },
  stylesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  styleCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 12,
    width: '18%',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1F2937',
  },
  styleCardActive: {
    backgroundColor: '#EA580C',
    borderColor: '#FB923C',
  },
  styleEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  styleLabel: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  styleLabelActive: {
    color: '#FFFFFF',
    fontWeight: '600' as const,
  },
  ratiosContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  ratioButton: {
    flex: 1,
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1F2937',
  },
  ratioButtonActive: {
    backgroundColor: '#EA580C',
    borderColor: '#FB923C',
  },
  ratioLabel: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700' as const,
    marginBottom: 4,
  },
  ratioLabelActive: {
    color: '#FFFFFF',
  },
  ratioText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  ratioTextActive: {
    color: '#FFEDD5',
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    backgroundColor: '#0B1020',
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
  },
  generateButton: {
    backgroundColor: '#EA580C',
    borderRadius: 18,
    padding: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  generateButtonDisabled: {
    backgroundColor: '#334155',
    opacity: 0.5,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700' as const,
  },
});
