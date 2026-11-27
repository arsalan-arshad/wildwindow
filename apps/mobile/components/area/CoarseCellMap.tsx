/**
 * Native coarse cell map (react-native-maps). Web uses CoarseCellMap.web.tsx
 * so Metro never pulls maps into the browser/SSR graph.
 */
import { StyleSheet, View } from 'react-native';
import MapView, { Polygon, type Region } from 'react-native-maps';
import { useTranslation } from 'react-i18next';

import { Text, useThemeColor } from '@/components/Themed';
import { geometryForCell } from '@/lib/cell-map';

const DEFAULT_DELTA = 0.08;

export type CoarseCellMapProps = {
  readonly cellR7: string | null;
  readonly testID?: string;
};

export function CoarseCellMap({ cellR7, testID = 'coarse-cell-map' }: CoarseCellMapProps) {
  const { t } = useTranslation();
  const muted = useThemeColor({}, 'textMuted');
  const tint = useThemeColor({}, 'tint');
  const border = useThemeColor({}, 'border');
  const surface = useThemeColor({}, 'surface');

  if (cellR7 === null) {
    return (
      <View
        style={[styles.placeholder, { backgroundColor: surface, borderColor: border }]}
        testID={`${testID}-empty`}
      >
        <Text style={[styles.placeholderText, { color: muted }]}>{t('area.map.empty')}</Text>
      </View>
    );
  }

  const geometry = geometryForCell(cellR7);
  if (geometry === null) {
    return (
      <View
        style={[styles.placeholder, { backgroundColor: surface, borderColor: border }]}
        testID={`${testID}-invalid`}
      >
        <Text style={[styles.placeholderText, { color: muted }]}>{t('area.map.invalid')}</Text>
      </View>
    );
  }

  const region: Region = {
    latitude: geometry.centre.latitude,
    longitude: geometry.centre.longitude,
    latitudeDelta: DEFAULT_DELTA,
    longitudeDelta: DEFAULT_DELTA,
  };

  return (
    <View style={[styles.mapWrap, { borderColor: border }]} testID={testID}>
      <MapView
        style={styles.map}
        region={region}
        pitchEnabled={false}
        rotateEnabled={false}
        toolbarEnabled={false}
        showsUserLocation={false}
        showsMyLocationButton={false}
        testID={`${testID}-view`}
      >
        <Polygon
          coordinates={[...geometry.coordinates]}
          strokeColor={tint}
          fillColor={`${tint}33`}
          strokeWidth={2}
          tappable={false}
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    height: 220,
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
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
