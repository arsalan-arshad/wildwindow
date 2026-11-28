import { Pressable, StyleSheet } from 'react-native';

import { Text, View, useThemeColor } from '@/components/Themed';

export type SettingChoiceOption<T extends string> = {
  readonly value: T;
  readonly label: string;
  readonly testID: string;
};

export type SettingChoiceRowProps<T extends string> = {
  readonly label: string;
  readonly value: T | null;
  readonly options: readonly SettingChoiceOption<T>[];
  readonly onChange: (value: T) => void;
  readonly disabled?: boolean;
  readonly testID?: string;
};

/** Compact segmented choice used on Profile settings (region / units / language). */
export function SettingChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
  testID,
}: SettingChoiceRowProps<T>) {
  const muted = useThemeColor({}, 'textMuted');
  const tint = useThemeColor({}, 'tint');
  const surface = useThemeColor({}, 'surface');
  const border = useThemeColor({}, 'border');

  return (
    <View style={styles.block} testID={testID}>
      <Text style={[styles.label, { color: muted }]}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const selected = value === option.value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{ selected, disabled }}
              disabled={disabled}
              testID={option.testID}
              onPress={() => {
                onChange(option.value);
              }}
              style={[
                styles.option,
                {
                  backgroundColor: surface,
                  borderColor: selected ? tint : border,
                  borderWidth: selected ? 2 : 1,
                  opacity: disabled ? 0.45 : 1,
                },
              ]}
            >
              <Text style={styles.optionLabel}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { marginTop: 20 },
  label: { fontSize: 13, fontWeight: '600', letterSpacing: 0.3, marginBottom: 8 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    minWidth: 96,
    alignItems: 'center',
  },
  optionLabel: { fontSize: 15, fontWeight: '600' },
});
