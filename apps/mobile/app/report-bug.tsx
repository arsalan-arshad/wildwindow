import { StyleSheet } from 'react-native';

import { ReportBugForm } from '@/components/bug-report/ReportBugForm';
import { View } from '@/components/Themed';
import { getLayoutDirection } from '@/lib/i18n';

export default function ReportBugScreen() {
  const direction = getLayoutDirection();

  return (
    <View style={[styles.root, { direction }]} testID="report-bug-screen">
      <ReportBugForm />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
