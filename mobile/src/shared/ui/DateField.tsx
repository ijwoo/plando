import { useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useResolvedScheme, useTheme } from '@/hooks/use-theme';
import { toDateString } from '@/shared/utils/datetime';

/**
 * 마감일 등 날짜 선택 — 네이티브 date picker(@react-native-community/datetimepicker).
 * 값은 'YYYY-MM-DD'. 탭하면 피커가 인라인으로 뜨고, 우측 X로 비울 수 있다.
 */
export function DateField({
  value,
  onChange,
  placeholder = '날짜 선택',
  minimumDate,
}: {
  value?: string;
  onChange: (date: string | undefined) => void;
  placeholder?: string;
  minimumDate?: Date;
}) {
  const theme = useTheme();
  const scheme = useResolvedScheme();
  const [show, setShow] = useState(false);
  const dateValue = value ? new Date(`${value}T00:00:00`) : new Date();

  return (
    <View>
      <Pressable
        onPress={() => setShow((s) => !s)}
        style={[styles.field, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="default" style={value ? undefined : { color: theme.textSecondary }}>
          {value ?? placeholder}
        </ThemedText>
        {value ? (
          <Pressable
            hitSlop={8}
            onPress={() => {
              onChange(undefined);
              setShow(false);
            }}>
            <Ionicons name="close-circle" size={20} color={theme.textSecondary} />
          </Pressable>
        ) : (
          <Ionicons name="calendar-outline" size={20} color={theme.textSecondary} />
        )}
      </Pressable>

      {show ? (
        <DateTimePicker
          value={dateValue}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          locale="ko-KR"
          themeVariant={scheme}
          minimumDate={minimumDate}
          onChange={(_e, d) => {
            if (Platform.OS === 'android') setShow(false);
            if (d) onChange(toDateString(d));
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
