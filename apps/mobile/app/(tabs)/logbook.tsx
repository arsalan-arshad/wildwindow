import { StyleSheet } from 'react-native';

import { Text, View } from '@/components/Themed';

export default function LogbookScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Logbook</Text>
      <Text style={styles.subtitle}>WildWindow placeholder</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700' },
  subtitle: { marginTop: 8, opacity: 0.6 },
});
