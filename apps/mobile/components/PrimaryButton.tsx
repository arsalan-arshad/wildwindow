import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { Text, useThemeColor } from '@/components/Themed';
import { useColorScheme } from '@/components/useColorScheme';
import Colors from '@/constants/Colors';

export type PrimaryButtonProps = {
  readonly label: string;
  readonly onPress: () => void;
  readonly disabled?: boolean;
  readonly testID?: string;
  readonly variant?: 'primary' | 'secondary';
  readonly style?: StyleProp<ViewStyle>;
};

export function PrimaryButton({
  label,
  onPress,
  disabled = false,
  testID,
  variant = 'primary',
  style,
}: PrimaryButtonProps) {
  const scheme = useColorScheme();
  const tint = useThemeColor({}, 'tint');
  const surface = useThemeColor({}, 'surface');
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'border');
  const isPrimary = variant === 'primary';
  const labelColor = isPrimary
    ? scheme === 'dark'
      ? Colors.dark.background
      : '#ffffff'
    : text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        isPrimary
          ? { backgroundColor: tint, opacity: disabled ? 0.45 : pressed ? 0.88 : 1 }
          : {
              backgroundColor: surface,
              borderColor: border,
              borderWidth: 1,
              opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
            },
        style,
      ]}
    >
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
  },
});
