import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useMutation, useQuery } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { useEffect, useMemo, useState } from 'react';

export type ArtStyle =
  | 'anime'
  | 'realistic'
  | 'digital-art'
  | 'oil-painting'
  | 'watercolor'
  | 'concept-art'
  | 'cyberpunk'
  | 'fantasy'
  | 'portrait'
  | 'landscape'
  | string;

export interface CustomStyle {
  id: string;
  name: string;
  referenceImage: string;
  mimeType: string;
  createdAt: number;
}

export interface GalleryFolder {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  coverArtId?: string;
}

export interface GeneratedArt {
  id: string;
  prompt: string;
  style: ArtStyle;
  imageData: string;
  mimeType: string;
  size: string;
  createdAt: number;
  batchId?: string;
  batchIndex?: number;
  batchSize?: number;
  folderId?: string;
  fileUri?: string;
}

interface GenerateArtInput {
  prompt: string;
  style: ArtStyle;
  size?: string;
  variations?: number;
}

interface ImageModelRequest {
  model: string;
  prompt: string;
  n: number;
  providerOptions: Record<string, unknown>;
  size?: string;
  files?: Array<{ type: 'file'; data: string; mediaType: string }>;
}

interface ImageModelResponse {
  images: string[];
  warnings?: unknown[];
  providerMetadata?: {
    gateway?: { marketCost?: string; generationId?: string };
  };
  usage?: { inputTokens?: number; outputTokens?: number; totalTokens?: number };
}

const STORAGE_KEY = 'art_gallery';
const CUSTOM_STYLES_KEY = 'custom_styles';
const FOLDERS_KEY = 'gallery_folders';
const DEFAULT_FOLDER_ID = 'all-artwork';
const TOOLKIT_URL = process.env.EXPO_PUBLIC_TOOLKIT_URL ?? 'https://toolkit.rork.com';
const IMAGE_MODEL_ENDPOINT = `${TOOLKIT_URL}/v2/vercel/v3/ai/image-model`;
const IMAGE_MODEL_ID = 'openai/gpt-image-2';
const IMAGE_OUTPUT_MIME_TYPE = 'image/png';
const ART_DIRECTORY = `${FileSystem.documentDirectory ?? ''}generated-art/`;
const MEDIA_ALBUM_NAME = 'Free AI Art Studio';

export const DEFAULT_FOLDER: GalleryFolder = {
  id: DEFAULT_FOLDER_ID,
  name: 'All Artwork',
  createdAt: 0,
  updatedAt: 0,
};

export const [ArtProvider, useArt] = createContextHook(() => {
  const [gallery, setGallery] = useState<GeneratedArt[]>([]);
  const [customStyles, setCustomStyles] = useState<CustomStyle[]>([]);
  const [folders, setFolders] = useState<GalleryFolder[]>([DEFAULT_FOLDER]);

  const galleryQuery = useQuery({
    queryKey: ['gallery'],
    queryFn: async (): Promise<GeneratedArt[]> => {
      try {
        await ensureArtDirectoryExists();
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!stored) {
          return [];
        }

        const parsed = JSON.parse(stored) as unknown;
        if (!Array.isArray(parsed)) {
          await AsyncStorage.removeItem(STORAGE_KEY);
          return [];
        }

        const validItems = parsed.filter(isGeneratedArt).sort((a, b) => b.createdAt - a.createdAt);
        const migratedItems = await migrateInlineImagesToFiles(validItems);
        if (hasGalleryStorageChanged(validItems, migratedItems)) {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(migratedItems));
        }
        return migratedItems;
      } catch (error) {
        console.warn('[ArtContext] Could not load gallery, resetting saved artwork cache');
        await AsyncStorage.removeItem(STORAGE_KEY);
        return [];
      }
    }
  });

  const foldersQuery = useQuery({
    queryKey: ['galleryFolders'],
    queryFn: async (): Promise<GalleryFolder[]> => {
      try {
        const stored = await AsyncStorage.getItem(FOLDERS_KEY);
        if (!stored) {
          return [DEFAULT_FOLDER];
        }

        const parsed = JSON.parse(stored) as unknown;
        if (!Array.isArray(parsed)) {
          await AsyncStorage.removeItem(FOLDERS_KEY);
          return [DEFAULT_FOLDER];
        }

        const savedFolders = parsed.filter(isGalleryFolder);
        return mergeDefaultFolder(savedFolders);
      } catch (error) {
        console.warn('[ArtContext] Could not load folders, resetting folder cache');
        await AsyncStorage.removeItem(FOLDERS_KEY);
        return [DEFAULT_FOLDER];
      }
    }
  });

  const customStylesQuery = useQuery({
    queryKey: ['customStyles'],
    queryFn: async (): Promise<CustomStyle[]> => {
      try {
        const stored = await AsyncStorage.getItem(CUSTOM_STYLES_KEY);
        if (!stored) {
          return [];
        }

        const parsed = JSON.parse(stored) as unknown;
        if (!Array.isArray(parsed)) {
          await AsyncStorage.removeItem(CUSTOM_STYLES_KEY);
          return [];
        }

        return parsed.filter(isCustomStyle).sort((a, b) => b.createdAt - a.createdAt);
      } catch (error) {
        console.warn('[ArtContext] Could not load custom styles, resetting saved style cache');
        await AsyncStorage.removeItem(CUSTOM_STYLES_KEY);
        return [];
      }
    }
  });

  useEffect(() => {
    if (galleryQuery.data) {
      setGallery(galleryQuery.data);
    }
  }, [galleryQuery.data]);

  useEffect(() => {
    if (foldersQuery.data) {
      setFolders(foldersQuery.data);
    }
  }, [foldersQuery.data]);

  useEffect(() => {
    if (customStylesQuery.data) {
      setCustomStyles(customStylesQuery.data);
    }
  }, [customStylesQuery.data]);

  const batches = useMemo(() => groupGalleryBatches(gallery), [gallery]);

  const saveMutation = useMutation({
    mutationFn: async (updatedGallery: GeneratedArt[]) => {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedGallery));
      return updatedGallery;
    }
  });

  const saveFoldersMutation = useMutation({
    mutationFn: async (updatedFolders: GalleryFolder[]) => {
      await AsyncStorage.setItem(FOLDERS_KEY, JSON.stringify(updatedFolders.filter((folder) => folder.id !== DEFAULT_FOLDER_ID)));
      return updatedFolders;
    }
  });

  const saveStylesMutation = useMutation({
    mutationFn: async (updatedStyles: CustomStyle[]) => {
      await AsyncStorage.setItem(CUSTOM_STYLES_KEY, JSON.stringify(updatedStyles));
      return updatedStyles;
    }
  });

  const generateMutation = useMutation({
    mutationFn: async ({ prompt, style, size, variations = 1 }: GenerateArtInput) => {
      const safeVariations = Math.min(Math.max(variations, 1), 4);
      const customStyle = customStyles.find((item) => item.id === style);
      const now = Date.now();
      const batchId = `batch_${now}`;
      const batchFolder: GalleryFolder = {
        id: `folder_${now}`,
        name: createFolderName(prompt, now),
        createdAt: now,
        updatedAt: now,
      };

      console.log('[ArtContext] Starting generation', {
        promptLength: prompt.length,
        style,
        size,
        safeVariations,
        isCustomStyle: Boolean(customStyle),
      });

      let generatedArtwork: GeneratedArt[] = [];

      const targetSize = size ?? '1024x1024';

      if (customStyle) {
        const results = await Promise.all(
          Array.from({ length: safeVariations }, async (_, index) => {
            const variationPrompt = buildVariationPrompt(prompt, safeVariations, index);
            const editPrompt = `${variationPrompt}, in the style of the reference image`;
            const { base64, mimeType } = await callImageModel(editPrompt, targetSize, [
              {
                type: 'file',
                data: customStyle.referenceImage,
                mediaType: customStyle.mimeType,
              },
            ]);

            const id = `${now}_${index}`;
            const fileUri = await persistImageToFile(id, base64, mimeType);

            return {
              id,
              prompt,
              style: customStyle.name,
              imageData: '',
              fileUri,
              mimeType,
              size: targetSize,
              createdAt: now + index,
              batchId,
              batchIndex: index,
              batchSize: safeVariations,
              folderId: batchFolder.id,
            } satisfies GeneratedArt;
          })
        );

        generatedArtwork = results;
      } else {
        const stylePrompt = getStylePrompt(style, prompt);

        const results = await Promise.all(
          Array.from({ length: safeVariations }, async (_, index) => {
            const variationPrompt = buildVariationPrompt(stylePrompt, safeVariations, index);
            const { base64, mimeType } = await callImageModel(variationPrompt, targetSize);

            const id = `${now}_${index}`;
            const fileUri = await persistImageToFile(id, base64, mimeType);

            return {
              id,
              prompt,
              style,
              imageData: '',
              fileUri,
              mimeType,
              size: targetSize,
              createdAt: now + index,
              batchId,
              batchIndex: index,
              batchSize: safeVariations,
              folderId: batchFolder.id,
            } satisfies GeneratedArt;
          })
        );

        generatedArtwork = results;
      }

      batchFolder.coverArtId = generatedArtwork[0]?.id;
      const updated = [...generatedArtwork, ...gallery];
      const updatedFolders = mergeDefaultFolder([batchFolder, ...folders.filter((folder) => folder.id !== DEFAULT_FOLDER_ID)]);
      setGallery(updated);
      setFolders(updatedFolders);
      saveMutation.mutate(updated);
      saveFoldersMutation.mutate(updatedFolders);

      console.log('[ArtContext] Generation completed', {
        createdCount: generatedArtwork.length,
        galleryCount: updated.length,
      });

      return generatedArtwork;
    }
  });

  const editMutation = useMutation({
    mutationFn: async ({
      originalImage,
      editPrompt,
      aspectRatio
    }: {
      originalImage: string;
      editPrompt: string;
      aspectRatio?: string;
    }) => {
      const sizeForEdit = aspectRatioToSize(aspectRatio) ?? '1024x1024';
      const { base64, mimeType } = await callImageModel(editPrompt, sizeForEdit, [
        {
          type: 'file',
          data: stripDataUriPrefix(originalImage),
          mediaType: 'image/png',
        },
      ]);

      const now = Date.now();
      const fileUri = await persistImageToFile(now.toString(), base64, mimeType);

      const newArt: GeneratedArt = {
        id: now.toString(),
        prompt: editPrompt,
        style: 'digital-art' as ArtStyle,
        imageData: '',
        fileUri,
        mimeType,
        size: sizeForEdit,
        createdAt: now,
        folderId: DEFAULT_FOLDER_ID,
      };

      const updated = [newArt, ...gallery];
      setGallery(updated);
      saveMutation.mutate(updated);

      return newArt;
    }
  });

  const deleteArt = (id: string) => {
    const artwork = gallery.find((art) => art.id === id);
    const updated = gallery.filter((art) => art.id !== id);
    const remainingInFolder = updated.filter((art) => art.folderId === artwork?.folderId);
    const updatedFolders = folders
      .filter((folder) => folder.id === DEFAULT_FOLDER_ID || folder.id !== artwork?.folderId || remainingInFolder.length > 0)
      .map((folder) => {
        if (folder.id === artwork?.folderId && folder.coverArtId === id) {
          return { ...folder, coverArtId: remainingInFolder[0]?.id, updatedAt: Date.now() };
        }
        return folder;
      });

    setGallery(updated);
    setFolders(updatedFolders);
    saveMutation.mutate(updated);
    saveFoldersMutation.mutate(updatedFolders);
    if (artwork?.fileUri) {
      FileSystem.deleteAsync(artwork.fileUri, { idempotent: true }).catch(() => undefined);
    }
  };

  const createFolder = (name: string) => {
    const now = Date.now();
    const newFolder: GalleryFolder = {
      id: `folder_${now}`,
      name: name.trim() || 'New Folder',
      createdAt: now,
      updatedAt: now,
    };
    const updatedFolders = mergeDefaultFolder([newFolder, ...folders.filter((folder) => folder.id !== DEFAULT_FOLDER_ID)]);
    setFolders(updatedFolders);
    saveFoldersMutation.mutate(updatedFolders);
    return newFolder;
  };

  const moveArtToFolder = (artIds: string[], folderId: string) => {
    const now = Date.now();
    const targetFolder = folders.find((f) => f.id === folderId);
    const updated = gallery.map((art) => artIds.includes(art.id) ? { ...art, folderId } : art);
    const updatedFolders = folders.map((folder) => {
      if (folder.id === folderId) {
        const coverId = folder.coverArtId ?? artIds[0];
        return { ...folder, updatedAt: now, coverArtId: coverId };
      }
      if (artIds.includes(folder.coverArtId ?? '')) {
        const remaining = updated.filter((a) => a.folderId === folder.id);
        return { ...folder, coverArtId: remaining[0]?.id, updatedAt: now };
      }
      return folder;
    });
    setGallery(updated);
    setFolders(updatedFolders);
    saveMutation.mutate(updated);
    saveFoldersMutation.mutate(updatedFolders);
  };

  const renameFolder = (folderId: string, newName: string) => {
    if (folderId === DEFAULT_FOLDER_ID) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    const updatedFolders = folders.map((f) =>
      f.id === folderId ? { ...f, name: trimmed, updatedAt: Date.now() } : f
    );
    setFolders(updatedFolders);
    saveFoldersMutation.mutate(updatedFolders);
  };

  const deleteFolder = (folderId: string) => {
    if (folderId === DEFAULT_FOLDER_ID) return;
    const updated = gallery.map((art) =>
      art.folderId === folderId ? { ...art, folderId: DEFAULT_FOLDER_ID } : art
    );
    const updatedFolders = folders.filter((f) => f.id !== folderId);
    setGallery(updated);
    setFolders(updatedFolders);
    saveMutation.mutate(updated);
    saveFoldersMutation.mutate(updatedFolders);
  };

  const saveArtToMediaLibrary = async (artIds: string[]) => {
    const permission = await MediaLibrary.requestPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Photo library permission is required to save artwork');
    }

    const assets: MediaLibrary.Asset[] = [];
    for (const artId of artIds) {
      const artwork = gallery.find((item) => item.id === artId);
      if (!artwork) {
        continue;
      }
      const uri = artwork.fileUri ?? await persistImageToFile(artwork.id, artwork.imageData, artwork.mimeType);
      const asset = await MediaLibrary.createAssetAsync(uri);
      assets.push(asset);
    }

    if (assets.length === 0) {
      return [];
    }

    const existingAlbum = await MediaLibrary.getAlbumAsync(MEDIA_ALBUM_NAME);
    if (existingAlbum) {
      await MediaLibrary.addAssetsToAlbumAsync(assets, existingAlbum, false);
    } else {
      await MediaLibrary.createAlbumAsync(MEDIA_ALBUM_NAME, assets[0], false);
      if (assets.length > 1) {
        const createdAlbum = await MediaLibrary.getAlbumAsync(MEDIA_ALBUM_NAME);
        if (createdAlbum) {
          await MediaLibrary.addAssetsToAlbumAsync(assets.slice(1), createdAlbum, false);
        }
      }
    }

    return assets;
  };

  const addCustomStyleMutation = useMutation({
    mutationFn: async ({ name, imageUri }: { name: string; imageUri: string }) => {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const reader = new FileReader();

      return new Promise<CustomStyle>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result;

          if (typeof result !== 'string') {
            reject(new Error('Failed to encode custom style image'));
            return;
          }

          const base64 = result.split(',')[1] ?? '';
          const newStyle: CustomStyle = {
            id: `custom_${Date.now()}`,
            name,
            referenceImage: base64,
            mimeType: blob.type,
            createdAt: Date.now()
          };

          const updated = [...customStyles, newStyle];
          setCustomStyles(updated);
          saveStylesMutation.mutate(updated);
          resolve(newStyle);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
  });

  const deleteCustomStyle = (id: string) => {
    const updated = customStyles.filter((styleItem) => styleItem.id !== id);
    setCustomStyles(updated);
    saveStylesMutation.mutate(updated);
  };

  return {
    gallery,
    customStyles,
    folders,
    batches,
    generateMutation,
    editMutation,
    addCustomStyleMutation,
    deleteCustomStyle,
    deleteArt,
    createFolder,
    renameFolder,
    deleteFolder,
    moveArtToFolder,
    saveArtToMediaLibrary,
    getImageUri,
    isLoading: galleryQuery.isLoading || customStylesQuery.isLoading || foldersQuery.isLoading
  };
});

function isGeneratedArt(value: unknown): value is GeneratedArt {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<GeneratedArt>;
  const hasInlineImage = typeof item.imageData === 'string' && item.imageData.length > 0;
  const hasFileImage = typeof item.fileUri === 'string' && item.fileUri.length > 0;
  return (
    typeof item.id === 'string' &&
    typeof item.prompt === 'string' &&
    typeof item.style === 'string' &&
    (hasInlineImage || hasFileImage) &&
    typeof item.mimeType === 'string' &&
    item.mimeType.startsWith('image/') &&
    typeof item.size === 'string' &&
    typeof item.createdAt === 'number'
  );
}

function isGalleryFolder(value: unknown): value is GalleryFolder {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<GalleryFolder>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.createdAt === 'number' &&
    typeof item.updatedAt === 'number'
  );
}

function isCustomStyle(value: unknown): value is CustomStyle {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<CustomStyle>;
  return (
    typeof item.id === 'string' &&
    typeof item.name === 'string' &&
    typeof item.referenceImage === 'string' &&
    item.referenceImage.length > 0 &&
    typeof item.mimeType === 'string' &&
    item.mimeType.startsWith('image/') &&
    typeof item.createdAt === 'number'
  );
}

function buildVariationPrompt(prompt: string, totalVariations: number, index: number): string {
  if (totalVariations <= 1) {
    return prompt;
  }

  const variationGuidance = [
    'version focused on dramatic cinematic lighting and strong contrast',
    'version focused on rich texture detail and layered composition',
    'version focused on bold color storytelling and dynamic energy',
    'version focused on elegant mood, atmosphere, and premium polish',
  ];

  const guidance = variationGuidance[index] ?? variationGuidance[variationGuidance.length - 1];
  return `${prompt}, create a distinct variation, ${guidance}`;
}

function getStylePrompt(style: ArtStyle, prompt: string): string {
  const styleModifiers: Record<string, string> = {
    anime: 'anime style, detailed anime art, vibrant colors, manga-inspired',
    realistic: 'photorealistic, highly detailed, professional photography, 8k resolution',
    'digital-art': 'digital art, artstation trending, highly detailed digital painting',
    'oil-painting': 'oil painting, classical art style, painterly, museum quality',
    watercolor: 'watercolor painting, soft colors, artistic, flowing brushstrokes',
    'concept-art': 'concept art, detailed illustration, professional game art, cinematic',
    cyberpunk: 'cyberpunk style, neon lights, futuristic, dystopian, high tech low life',
    fantasy: 'fantasy art, magical, epic, detailed fantasy illustration, ethereal',
    portrait: 'portrait photography, professional headshot, detailed facial features, studio lighting',
    landscape: 'landscape photography, scenic vista, golden hour lighting, breathtaking nature'
  };

  const styleModifier = styleModifiers[style] ?? 'highly detailed, visually striking, polished artwork';
  return `${prompt}, ${styleModifier}`;
}

function getImageUri(artwork: GeneratedArt): string {
  if (artwork.fileUri) {
    return artwork.fileUri;
  }
  if (!artwork.imageData || !artwork.mimeType) {
    return '';
  }
  return `data:${artwork.mimeType};base64,${artwork.imageData}`;
}

async function ensureArtDirectoryExists(): Promise<void> {
  if (!ART_DIRECTORY) {
    return;
  }
  const directoryInfo = await FileSystem.getInfoAsync(ART_DIRECTORY);
  if (!directoryInfo.exists) {
    await FileSystem.makeDirectoryAsync(ART_DIRECTORY, { intermediates: true });
  }
}

async function callImageModel(
  prompt: string,
  size: string,
  files?: Array<{ type: 'file'; data: string; mediaType: string }>,
): Promise<{ base64: string; mimeType: string }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'ai-gateway-protocol-version': '0.0.1',
    'ai-image-model-specification-version': '4',
    'ai-model-id': IMAGE_MODEL_ID,
  };

  const secretKey = process.env.EXPO_PUBLIC_RORK_TOOLKIT_SECRET_KEY;
  if (secretKey) {
    headers['Authorization'] = `Bearer ${secretKey}`;
  }

  const body: ImageModelRequest = {
    model: IMAGE_MODEL_ID,
    prompt,
    n: 1,
    providerOptions: {},
    size,
  };
  if (files && files.length > 0) {
    body.files = files;
  }

  console.log('[ArtContext] Image model request', {
    endpoint: IMAGE_MODEL_ENDPOINT,
    model: IMAGE_MODEL_ID,
    promptLength: prompt.length,
    size,
    hasFiles: Boolean(files),
  });

  const response = await fetch(IMAGE_MODEL_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    console.error('[ArtContext] Image model error', {
      status: response.status,
      body: errorText.slice(0, 300),
    });
    throw new Error(`Image generation failed (${response.status})`);
  }

  const data = (await response.json()) as ImageModelResponse;
  const base64 = data.images?.[0];
  if (!base64) {
    throw new Error('No image returned from generation');
  }

  console.log('[ArtContext] Image model success', {
    imageCount: data.images.length,
    base64Length: base64.length,
    cost: data.providerMetadata?.gateway?.marketCost,
  });

  return { base64, mimeType: IMAGE_OUTPUT_MIME_TYPE };
}

function aspectRatioToSize(aspectRatio?: string): string | undefined {
  if (!aspectRatio) return undefined;
  const map: Record<string, string> = {
    '1:1': '1024x1024',
    '9:16': '1024x1792',
    '16:9': '1792x1024',
  };
  return map[aspectRatio];
}

function stripDataUriPrefix(value: string): string {
  if (!value.startsWith('data:')) return value;
  const comma = value.indexOf(',');
  return comma === -1 ? value : value.slice(comma + 1);
}

async function persistImageToFile(id: string, base64Data: string, mimeType: string): Promise<string> {
  await ensureArtDirectoryExists();
  const extension = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
  const fileUri = `${ART_DIRECTORY}${id}.${extension}`;
  await FileSystem.writeAsStringAsync(fileUri, base64Data, { encoding: FileSystem.EncodingType.Base64 });
  return fileUri;
}

async function migrateInlineImagesToFiles(items: GeneratedArt[]): Promise<GeneratedArt[]> {
  return Promise.all(items.map(async (item) => {
    if (item.fileUri || !item.imageData) {
      return item;
    }

    try {
      const fileUri = await persistImageToFile(item.id, item.imageData, item.mimeType);
      return { ...item, fileUri, imageData: '', folderId: item.folderId ?? DEFAULT_FOLDER_ID };
    } catch (error) {
      console.warn('[ArtContext] Could not migrate artwork file, keeping inline fallback');
      return { ...item, folderId: item.folderId ?? DEFAULT_FOLDER_ID };
    }
  }));
}

function hasGalleryStorageChanged(previous: GeneratedArt[], next: GeneratedArt[]): boolean {
  return previous.some((item, index) => item.fileUri !== next[index]?.fileUri || item.imageData !== next[index]?.imageData || item.folderId !== next[index]?.folderId);
}

function mergeDefaultFolder(savedFolders: GalleryFolder[]): GalleryFolder[] {
  const withoutDefault = savedFolders.filter((folder) => folder.id !== DEFAULT_FOLDER_ID);
  return [DEFAULT_FOLDER, ...withoutDefault.sort((a, b) => b.updatedAt - a.updatedAt)];
}

function groupGalleryBatches(gallery: GeneratedArt[]): Record<string, GeneratedArt[]> {
  return gallery.reduce<Record<string, GeneratedArt[]>>((accumulator, item) => {
    const key = item.batchId ?? item.id;
    accumulator[key] = [...(accumulator[key] ?? []), item].sort((a, b) => (a.batchIndex ?? 0) - (b.batchIndex ?? 0));
    return accumulator;
  }, {});
}

function createFolderName(prompt: string, createdAt: number): string {
  const cleanPrompt = prompt.trim().replace(/\s+/g, ' ');
  if (cleanPrompt.length > 0) {
    return cleanPrompt.length > 28 ? `${cleanPrompt.slice(0, 28)}…` : cleanPrompt;
  }
  return `Generation ${new Date(createdAt).toLocaleDateString()}`;
}
