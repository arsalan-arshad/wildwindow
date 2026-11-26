import { StyleSheet } from 'react-native';

import { HomeWatchlist } from '@/components/home/HomeWatchlist';
import { View } from '@/components/Themed';
import { getLayoutDirection } from '@/lib/i18n';

export default function HomeScreen() {
  const direction = getLayoutDirection();
  return (
    <View style={[styles.root, { direction }]} testID="tab-home">
      <HomeWatchlist />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
