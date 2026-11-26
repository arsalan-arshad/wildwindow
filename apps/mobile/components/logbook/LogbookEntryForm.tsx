import { useQuery } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import { useApiClient } from '@/lib/api-context';
import { getLayoutDirection } from '@/lib/i18n';
import { formatCameraSummary } from '@/lib/logbook/format';
import { prepareLogbookPhoto, type PreparedLogbookUpload } from '@/lib/logbook/prepare-photo';
import { buildLogbookCreateBody, putPreparedLogbookPhoto } from '@/lib/logbook/upload';
import { usePreferences } from '@/lib/preferences-context';
import type { SpeciesListItem } from '@/lib/species';
import { displayCommonName } from '@/lib/species';

export type LogbookEntryFormProps = {
  readonly onCreated?: (id: string) => void;
  /** Injected picker for tests. */
  readonly pickImage?: () => Promise<ImagePicker.ImagePickerAsset | null>;
  readonly preparePhoto?: typeof prepareLogbookPhoto;
};

async function defaultPickImage(): Promise<ImagePicker.ImagePickerAsset | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return null;
  }
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 1,
    exif: true,
  });
  if (result.canceled || result.assets.length === 0) {
    return null;
  }
  return result.assets[0] ?? null;
}

export function LogbookEntryForm({
  onCreated,
  pickImage = defaultPickImage,
  preparePhoto = prepareLogbookPhoto,
}: LogbookEntryFormProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const { region } = usePreferences();
  const direction = getLayoutDirection();
  const muted = useThemeColor({}, 'textMuted');
  const text = useThemeColor({}, 'text');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const tint = useThemeColor({}, 'tint');
  const danger = useThemeColor({}, 'danger');
  const scheme = useColorScheme();

  const [prepared, setPrepared] = useState<PreparedLogbookUpload | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [taxonId, setTaxonId] = useState<string | null>(null);
  const [keepExactPoint, setKeepExactPoint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const regionSlug = region ?? 'scotland';
  const speciesQuery = useQuery({
    queryKey: ['regions', regionSlug, 'species', 'logbook'],
    queryFn: async () => {
      const response = await api.regions.species(regionSlug);
      return response.species as SpeciesListItem[];
    },
  });

  const cameraSummary = prepared !== null ? formatCameraSummary(prepared.exif) : '';

  const onPick = () => {
    setError(null);
    setPermissionDenied(false);
    setPicking(true);
    void (async () => {
      try {
        const asset = await pickImage();
        if (asset === null) {
          setPermissionDenied(true);
          return;
        }
        const next = await preparePhoto({
          asset: {
            uri: asset.uri,
            mimeType: asset.mimeType,
            fileSize: asset.fileSize,
            exif: asset.exif ?? null,
          },
        });
        setPrepared(next);
        setPreviewUri(next.uploadUri);
        // Default: keep exact point off (private by default, US-11 AC3).
        setKeepExactPoint(false);
      } catch (err: unknown) {
        setPrepared(null);
        setPreviewUri(null);
        setError(err instanceof Error ? err.message : t('logbook.form.prepareError'));
      } finally {
        setPicking(false);
      }
    })();
  };

  const onSave = () => {
    if (prepared === null || busy) {
      return;
    }
    setError(null);
    setBusy(true);
    void (async () => {
      try {
        const uploaded = await putPreparedLogbookPhoto({ api, prepared });
        const body = buildLogbookCreateBody({
          prepared,
          photoKey: uploaded.photoKey,
          taxonId,
          notes,
          keepExactPoint: keepExactPoint && prepared.photoGps !== null,
        });
        const created = await api.me.logbook.create(body);
        onCreated?.(created.id);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : t('logbook.form.saveError'));
      } finally {
        setBusy(false);
      }
    })();
  };

  const species = speciesQuery.data ?? [];

  return (
    <ScrollView
      style={{ direction }}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
      testID="logbook-form"
    >
      <Text style={styles.title}>{t('logbook.form.title')}</Text>
      <Text style={[styles.body, { color: muted }]}>{t('logbook.form.subtitle')}</Text>

      <PrimaryButton
        label={
          picking
            ? t('logbook.form.picking')
            : prepared !== null
              ? t('logbook.form.changePhoto')
              : t('logbook.form.pickPhoto')
        }
        onPress={onPick}
        disabled={picking || busy}
        testID="logbook-pick-photo"
        style={styles.cta}
      />

      {permissionDenied ? (
        <Text style={[styles.hint, { color: muted }]} testID="logbook-permission-denied">
          {t('logbook.form.permissionDenied')}
        </Text>
      ) : null}

      {previewUri !== null ? (
        <Image
          source={{ uri: previewUri }}
          style={styles.preview}
          accessibilityLabel={t('logbook.form.previewA11y')}
          testID="logbook-preview"
        />
      ) : null}

      {cameraSummary.length > 0 ? (
        <Text style={[styles.hint, { color: muted }]} testID="logbook-camera-summary">
          {cameraSummary}
        </Text>
      ) : null}

      {prepared?.photoGps !== null && prepared !== null ? (
        <View style={[styles.switchRow, { borderColor: border }]} testID="logbook-exact-row">
          <View style={styles.switchCopy}>
            <Text style={styles.switchTitle}>{t('logbook.form.keepExactTitle')}</Text>
            <Text style={[styles.hint, { color: muted }]}>{t('logbook.form.keepExactBody')}</Text>
          </View>
          <Switch
            value={keepExactPoint}
            onValueChange={setKeepExactPoint}
            testID="logbook-keep-exact"
            trackColor={{ true: tint }}
          />
        </View>
      ) : null}

      <Text style={[styles.label, { color: muted }]}>{t('logbook.form.species')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.speciesRow}
        testID="logbook-species-row"
      >
        <Pressable
          accessibilityRole="button"
          testID="logbook-species-none"
          onPress={() => {
            setTaxonId(null);
          }}
          style={[
            styles.chip,
            {
              backgroundColor: taxonId === null ? tint : surface,
              borderColor: border,
            },
          ]}
        >
          <Text
            style={{
              color: taxonId === null ? (scheme === 'dark' ? '#0c1611' : '#ffffff') : text,
              fontWeight: '600',
            }}
          >
            {t('logbook.form.noSpecies')}
          </Text>
        </Pressable>
        {species.slice(0, 40).map((item) => {
          const selected = taxonId === item.taxonId;
          const label = displayCommonName(item.commonNames, i18n.language);
          return (
            <Pressable
              key={item.taxonId}
              accessibilityRole="button"
              testID={`logbook-species-${item.taxonId}`}
              onPress={() => {
                setTaxonId(item.taxonId);
              }}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? tint : surface,
                  borderColor: border,
                },
              ]}
            >
              <Text
                style={{
                  color: selected ? (scheme === 'dark' ? '#0c1611' : '#ffffff') : text,
                  fontWeight: '600',
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={[styles.label, { color: muted }]}>{t('logbook.form.notes')}</Text>
      <TextInput
        testID="logbook-notes"
        value={notes}
        onChangeText={setNotes}
        placeholder={t('logbook.form.notesPlaceholder')}
        placeholderTextColor={muted}
        multiline
        style={[
          styles.notes,
          {
            color: text,
            backgroundColor: surface,
            borderColor: border,
          },
        ]}
        editable={!busy}
      />

      {error !== null ? (
        <Text style={[styles.error, { color: danger }]} testID="logbook-form-error">
          {error}
        </Text>
      ) : null}

      <PrimaryButton
        label={busy ? t('logbook.form.saving') : t('logbook.form.save')}
        onPress={onSave}
        disabled={prepared === null || busy}
        testID="logbook-save"
        style={styles.cta}
      />

      {busy ? (
        <View style={styles.busy}>
          <ActivityIndicator color={tint} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '700' },
  body: { marginTop: 8, fontSize: 15, lineHeight: 22 },
  cta: { marginTop: 16, alignSelf: 'stretch' },
  preview: {
    marginTop: 16,
    width: '100%',
    height: 220,
    borderRadius: 12,
    backgroundColor: '#1a403020',
  },
  hint: { marginTop: 8, fontSize: 13, lineHeight: 18 },
  label: { marginTop: 20, fontSize: 13, fontWeight: '600' },
  speciesRow: { gap: 8, paddingVertical: 10 },
  chip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  notes: {
    marginTop: 8,
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  switchRow: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  switchCopy: { flex: 1 },
  switchTitle: { fontSize: 15, fontWeight: '600' },
  error: { marginTop: 12, fontSize: 14 },
  busy: { marginTop: 12, alignItems: 'center' },
});
