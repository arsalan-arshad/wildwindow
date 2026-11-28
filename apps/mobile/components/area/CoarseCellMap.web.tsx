/**
 * Web stub for the coarse cell map (native uses react-native-maps).
 * Never import react-native-maps here — RN Web has no codegenNativeComponent.
 */
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';

import { Text, useThemeColor } from '@/components/Themed';

export type CoarseCellMapProps = {
  readonly cellR7: string | null;
  readonly testID?: string;
};

export function CoarseCellMap({ cellR7, testID = 'coarse-cell-map' }: CoarseCellMapProps) {
  const { t } = useTranslation();
  const muted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const surface = useThemeColor({}, 'surface');

  const message = cellR7 === null ? t('area.map.empty') : t('area.map.webUnavailable');
  const stateId = cellR7 === null ? `${testID}-empty` : `${testID}-web`;

  return (
    <View
      style={[styles.placeholder, { backgroundColor: surface, borderColor: border }]}
      testID={stateId}
    >
      <Text style={[styles.placeholderText, { color: muted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    height: 160,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 20,
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
});
