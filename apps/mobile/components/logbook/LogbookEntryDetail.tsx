import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Text, View, useThemeColor } from '@/components/Themed';
import { useApiClient } from '@/lib/api-context';
import { getLayoutDirection } from '@/lib/i18n';
import { formatCameraSummary, formatTakenAt } from '@/lib/logbook/format';
import { usePreferences } from '@/lib/preferences-context';
import { regionTimeZone } from '@/lib/regions';

export type LogbookEntryDetailProps = {
  readonly entryId: string;
  readonly onDeleted?: () => void;
  readonly onUpdated?: () => void;
};

export function LogbookEntryDetail({ entryId, onDeleted, onUpdated }: LogbookEntryDetailProps) {
  const { t, i18n } = useTranslation();
  const api = useApiClient();
  const queryClient = useQueryClient();
  const { region } = usePreferences();
  const direction = getLayoutDirection();
  const muted = useThemeColor({}, 'textMuted');
  const text = useThemeColor({}, 'text');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');
  const tint = useThemeColor({}, 'tint');
  const danger = useThemeColor({}, 'danger');
  const timeZone = regionTimeZone(region ?? 'scotland');

  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const detailQuery = useQuery({
    queryKey: ['me', 'logbook', entryId],
    queryFn: async () => api.me.logbook.get(entryId),
  });

  const patchMutation = useMutation({
    mutationFn: async (nextNotes: string) =>
      api.me.logbook.patch(entryId, {
        notes: nextNotes.trim().length > 0 ? nextNotes.trim() : null,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me', 'logbook'] });
      setEditing(false);
      onUpdated?.();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => api.me.logbook.remove(entryId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['me', 'logbook'] });
      onDeleted?.();
    },
  });

  if (detailQuery.isLoading) {
    return (
      <View style={[styles.centered, { direction }]} testID="logbook-detail-loading">
        <ActivityIndicator color={tint} />
      </View>
    );
  }

  if (detailQuery.isError || detailQuery.data === undefined) {
    return (
      <View style={[styles.container, { direction }]} testID="logbook-detail-error">
        <Text style={styles.title}>{t('logbook.detail.title')}</Text>
        <Text style={[styles.body, { color: muted }]}>{t('logbook.detail.error')}</Text>
      </View>
    );
  }

  const entry = detailQuery.data;
  const camera = formatCameraSummary(entry.exif);
  const when = formatTakenAt(entry.takenAt, timeZone, i18n.language);
  const speciesLabel =
    entry.taxonId !== null
      ? t('logbook.list.taxon', { id: entry.taxonId })
      : t('logbook.list.noSpecies');

  return (
    <ScrollView style={{ direction }} contentContainerStyle={styles.scroll} testID="logbook-detail">
      <Text style={styles.title}>{t('logbook.detail.title')}</Text>
      <Text style={styles.species}>{speciesLabel}</Text>
      <Text style={[styles.body, { color: muted }]}>{when}</Text>
      {camera.length > 0 ? (
        <Text style={[styles.body, { color: muted }]} testID="logbook-detail-camera">
          {camera}
        </Text>
      ) : null}

      {entry.cellR7 !== null ? (
        <Text style={[styles.body, { color: muted }]} testID="logbook-detail-cell">
          {t('logbook.detail.cell', { cell: entry.cellR7 })}
        </Text>
      ) : null}

      {entry.exactLocation !== null ? (
        <Text style={[styles.body, { color: muted }]} testID="logbook-detail-exact">
          {t('logbook.detail.exactKept')}
        </Text>
      ) : (
        <Text style={[styles.body, { color: muted }]} testID="logbook-detail-exact-off">
          {t('logbook.detail.exactOff')}
        </Text>
      )}

      {!editing ? (
        <>
          <Text style={[styles.label, { color: muted }]}>{t('logbook.form.notes')}</Text>
          <Text style={styles.notes} testID="logbook-detail-notes">
            {entry.notes !== null && entry.notes.length > 0
              ? entry.notes
              : t('logbook.detail.noNotes')}
          </Text>
          <PrimaryButton
            label={t('logbook.detail.edit')}
            onPress={() => {
              setNotes(entry.notes ?? '');
              setEditing(true);
              setError(null);
            }}
            variant="secondary"
            testID="logbook-edit"
            style={styles.cta}
          />
        </>
      ) : (
        <>
          <Text style={[styles.label, { color: muted }]}>{t('logbook.form.notes')}</Text>
          <TextInput
            testID="logbook-edit-notes"
            value={notes}
            onChangeText={setNotes}
            multiline
            style={[
              styles.notesInput,
              { color: text, backgroundColor: surface, borderColor: border },
            ]}
          />
          <PrimaryButton
            label={
              patchMutation.isPending ? t('logbook.form.saving') : t('logbook.detail.saveEdits')
            }
            onPress={() => {
              setError(null);
              patchMutation.mutate(notes, {
                onError: (err: unknown) => {
                  setError(err instanceof Error ? err.message : t('logbook.form.saveError'));
                },
              });
            }}
            disabled={patchMutation.isPending}
            testID="logbook-save-edits"
            style={styles.cta}
          />
          <PrimaryButton
            label={t('logbook.detail.cancelEdit')}
            onPress={() => {
              setEditing(false);
              setError(null);
            }}
            variant="secondary"
            testID="logbook-cancel-edit"
            style={styles.cta}
          />
        </>
      )}

      {error !== null ? (
        <Text style={[styles.error, { color: danger }]} testID="logbook-detail-error-msg">
          {error}
        </Text>
      ) : null}

      <PrimaryButton
        label={deleteMutation.isPending ? t('logbook.detail.deleting') : t('logbook.detail.delete')}
        onPress={() => {
          setError(null);
          deleteMutation.mutate(undefined, {
            onError: (err: unknown) => {
              setError(err instanceof Error ? err.message : t('logbook.detail.deleteError'));
            },
          });
        }}
        disabled={deleteMutation.isPending || patchMutation.isPending}
        variant="secondary"
        testID="logbook-delete"
        style={styles.cta}
      />
      <Text style={[styles.privacy, { color: muted }]}>{t('logbook.detail.privacyNote')}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 24, paddingBottom: 48 },
  title: { fontSize: 28, fontWeight: '700' },
  species: { marginTop: 12, fontSize: 20, fontWeight: '600' },
  body: { marginTop: 8, fontSize: 15, lineHeight: 22 },
  label: { marginTop: 20, fontSize: 13, fontWeight: '600' },
  notes: { marginTop: 8, fontSize: 16, lineHeight: 24 },
  notesInput: {
    marginTop: 8,
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  cta: { marginTop: 16, alignSelf: 'stretch' },
  error: { marginTop: 12, fontSize: 14 },
  privacy: { marginTop: 24, fontSize: 13, lineHeight: 18 },
});
