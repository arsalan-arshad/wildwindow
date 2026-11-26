import { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import { useTranslation } from 'react-i18next';

import { PrimaryButton } from '@/components/PrimaryButton';
import { Text, View, useThemeColor } from '@/components/Themed';
import { getLayoutDirection } from '@/lib/i18n';
import {
  buildShareCardUrl,
  downloadAndShareCard,
  type ShareCardDeps,
  type ShareCardTarget,
} from '@/lib/share-cards';
import { getSiteUrl } from '@/lib/site-url';

export type ShareCardPreviewProps = {
  readonly target: ShareCardTarget;
  /** Override site origin in tests. */
  readonly siteUrl?: string;
  /** Inject download/share for jest-expo. */
  readonly shareDeps?: ShareCardDeps;
  /** Override the share helper entirely in tests. */
  readonly onShare?: (imageUrl: string) => Promise<'shared' | 'unavailable'>;
};

export function ShareCardPreview({
  target,
  siteUrl = getSiteUrl(),
  shareDeps,
  onShare,
}: ShareCardPreviewProps) {
  const { t } = useTranslation();
  const direction = getLayoutDirection();
  const muted = useThemeColor({}, 'textMuted');
  const tint = useThemeColor({}, 'tint');
  const accent = useThemeColor({}, 'accent');
  const { width } = useWindowDimensions();
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [status, setStatus] = useState<'idle' | 'unavailable' | 'error'>('idle');

  const imageUrl = buildShareCardUrl(target, siteUrl);
  const storyAspect = target.kind === 'forecast';
  const previewWidth = Math.min(width - 32, storyAspect ? 360 : 320);
  const previewHeight = storyAspect
    ? Math.round((previewWidth * 1920) / 1080)
    : Math.round(previewWidth);

  async function handleShare(): Promise<void> {
    setSharing(true);
    setStatus('idle');
    try {
      const result =
        onShare !== undefined
          ? await onShare(imageUrl)
          : await downloadAndShareCard(imageUrl, shareDeps);
      if (result === 'unavailable') {
        setStatus('unavailable');
      }
    } catch {
      setStatus('error');
    } finally {
      setSharing(false);
    }
  }

  return (
    <ScrollView
      style={[styles.scroll, { direction }]}
      contentContainerStyle={styles.content}
      testID="share-card-preview"
    >
      <Text style={styles.title} testID="share-card-title">
        {target.kind === 'forecast' ? t('share.forecastTitle') : t('share.challengeTitle')}
      </Text>
      <Text style={[styles.subtitle, { color: muted }]}>{t('share.subtitle')}</Text>

      <View
        style={[styles.previewFrame, { width: previewWidth, height: previewHeight }]}
        testID="share-card-frame"
      >
        {imageLoading && !imageError ? (
          <View style={styles.previewOverlay} testID="share-card-image-loading">
            <ActivityIndicator color={tint} />
          </View>
        ) : null}
        {imageError ? (
          <View style={styles.previewOverlay} testID="share-card-image-error">
            <Text style={[styles.errorText, { color: muted }]}>{t('share.imageError')}</Text>
          </View>
        ) : (
          <Image
            source={{ uri: imageUrl }}
            style={{ width: previewWidth, height: previewHeight }}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            testID="share-card-image"
            onLoadStart={() => {
              setImageLoading(true);
              setImageError(false);
            }}
            onLoad={() => {
              setImageLoading(false);
            }}
            onError={() => {
              setImageLoading(false);
              setImageError(true);
            }}
          />
        )}
      </View>

      <Text style={[styles.urlHint, { color: muted }]} testID="share-card-no-pin-hint">
        {t('share.noPinHint')}
      </Text>

      <PrimaryButton
        label={sharing ? t('share.working') : t('share.cta')}
        onPress={() => {
          void handleShare();
        }}
        disabled={sharing || imageError}
        testID="share-card-button"
      />

      {status === 'unavailable' ? (
        <Text style={[styles.status, { color: accent }]} testID="share-card-unavailable">
          {t('share.unavailable')}
        </Text>
      ) : null}
      {status === 'error' ? (
        <Text style={[styles.status, { color: accent }]} testID="share-card-error">
          {t('share.error')}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 36,
    gap: 14,
    alignItems: 'center',
  },
  title: {
    alignSelf: 'stretch',
    fontSize: 22,
    fontWeight: '700',
  },
  subtitle: {
    alignSelf: 'stretch',
    fontSize: 14,
    lineHeight: 20,
    marginTop: -6,
  },
  previewFrame: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#d5e0d9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewOverlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 1,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  urlHint: {
    alignSelf: 'stretch',
    fontSize: 13,
    lineHeight: 18,
  },
  status: {
    alignSelf: 'stretch',
    fontSize: 14,
    fontWeight: '600',
  },
});
