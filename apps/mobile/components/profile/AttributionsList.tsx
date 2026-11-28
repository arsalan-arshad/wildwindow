import { Linking, Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { AttributionsResponse } from '@wildwindow/shared';

import { Text, View, useThemeColor } from '@/components/Themed';

export type AttributionsListProps = {
  readonly data: AttributionsResponse;
  readonly testID?: string;
};

function doiHref(doi: string): string {
  return doi.startsWith('http') ? doi : `https://doi.org/${doi}`;
}

function DoiLink({
  doi,
  tint,
  label,
}: {
  readonly doi: string;
  readonly tint: string;
  readonly label: string;
}) {
  const href = doiHref(doi);
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => {
        void Linking.openURL(href);
      }}
      testID="attributions-doi"
    >
      <Text style={[styles.link, { color: tint }]}>{label}</Text>
    </Pressable>
  );
}

function UrlLink({
  url,
  tint,
  testID,
}: {
  readonly url: string;
  readonly tint: string;
  readonly testID: string;
}) {
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => {
        void Linking.openURL(url);
      }}
      testID={testID}
    >
      <Text style={[styles.link, { color: tint }]}>{url}</Text>
    </Pressable>
  );
}

/** Presentational attributions list (S-17). Data from GET /v1/attributions or a fixture. */
export function AttributionsList({ data, testID = 'attributions-list' }: AttributionsListProps) {
  const { t } = useTranslation();
  const muted = useThemeColor({}, 'textMuted');
  const tint = useThemeColor({}, 'tint');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');

  return (
    <View testID={testID} style={styles.root}>
      <Text style={styles.sectionTitle}>{t('attributions.datasetsTitle')}</Text>
      <Text style={[styles.sectionIntro, { color: muted }]}>{t('attributions.datasetsIntro')}</Text>
      {data.datasets.length === 0 ? (
        <Text style={[styles.empty, { color: muted }]} testID="attributions-datasets-empty">
          {t('attributions.datasetsEmpty')}
        </Text>
      ) : (
        data.datasets.map((dataset) => (
          <View
            key={`${dataset.title}:${dataset.doi ?? 'no-doi'}:${dataset.license}`}
            style={[styles.card, { backgroundColor: surface, borderColor: border }]}
            testID="attributions-dataset"
          >
            <Text style={styles.cardTitle}>{dataset.title}</Text>
            <Text style={[styles.cardMeta, { color: muted }]}>
              {dataset.publisher} · {dataset.license}
            </Text>
            <Text style={[styles.cardBody, { color: muted }]}>{dataset.citation}</Text>
            {dataset.doi !== null ? (
              <DoiLink
                doi={dataset.doi}
                tint={tint}
                label={t('attributions.doi', { doi: dataset.doi })}
              />
            ) : null}
          </View>
        ))
      )}

      <Text style={[styles.sectionTitle, styles.providersHeading]}>
        {t('attributions.providersTitle')}
      </Text>
      <Text style={[styles.sectionIntro, { color: muted }]}>
        {t('attributions.providersIntro')}
      </Text>
      {data.providers.map((provider) => (
        <View
          key={provider.id}
          style={[styles.card, { backgroundColor: surface, borderColor: border }]}
          testID={`attributions-provider-${provider.id}`}
        >
          <Text style={styles.cardTitle}>{provider.name}</Text>
          <Text style={[styles.cardBody, { color: muted }]}>{provider.credit}</Text>
          {provider.url !== undefined ? (
            <UrlLink
              url={provider.url}
              tint={tint}
              testID={`attributions-provider-url-${provider.id}`}
            />
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { paddingBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginTop: 8 },
  providersHeading: { marginTop: 28 },
  sectionIntro: { marginTop: 8, fontSize: 15, lineHeight: 22 },
  empty: { marginTop: 16, fontSize: 15 },
  card: {
    marginTop: 14,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardMeta: { marginTop: 4, fontSize: 13 },
  cardBody: { marginTop: 8, fontSize: 14, lineHeight: 20 },
  link: { marginTop: 8, fontSize: 14, fontWeight: '600' },
});
