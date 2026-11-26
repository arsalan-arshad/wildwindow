import { StyleSheet, useWindowDimensions } from 'react-native';
import Svg, { Line, Path, Rect } from 'react-native-svg';
import { useTranslation } from 'react-i18next';

import { Text, View, useThemeColor } from '@/components/Themed';

export type SeasonalityChartProps = {
  /** 52 weekly relative reporting rates in [0, 1]. */
  readonly weeks: readonly number[];
  readonly testID?: string;
};

const CHART_HEIGHT = 120;
const PAD_Y = 8;

/**
 * Region-level seasonality (US-05): effort-normalised relative reporting rate.
 * Drawn with react-native-svg; never shows raw counts.
 */
export function SeasonalityChart({ weeks, testID }: SeasonalityChartProps) {
  const { t } = useTranslation();
  const { width: windowWidth } = useWindowDimensions();
  const tint = useThemeColor({}, 'tint');
  const muted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const surface = useThemeColor({}, 'surface');

  const chartWidth = Math.max(280, Math.min(windowWidth - 48, 520));
  const innerHeight = CHART_HEIGHT - PAD_Y * 2;

  const points = weeks.length === 52 ? weeks : padOrTrimWeeks(weeks);
  const path = buildAreaPath(points, chartWidth, innerHeight, PAD_Y);

  return (
    <View style={styles.root} testID={testID ?? 'seasonality-chart'}>
      <Text style={styles.title}>{t('species.seasonality.title')}</Text>
      <Text style={[styles.caption, { color: muted }]} testID="seasonality-label">
        {t('species.seasonality.label')}
      </Text>
      <View style={[styles.frame, { borderColor: border, backgroundColor: surface }]}>
        <Svg width={chartWidth} height={CHART_HEIGHT} accessibilityLabel={t('species.seasonality.label')}>
          <Line
            x1={0}
            y1={CHART_HEIGHT - PAD_Y}
            x2={chartWidth}
            y2={CHART_HEIGHT - PAD_Y}
            stroke={border}
            strokeWidth={1}
          />
          <Path d={path} fill={tint} fillOpacity={0.28} stroke={tint} strokeWidth={1.5} />
          {points.map((value, index) => {
            if (index % 13 !== 0) {
              return null;
            }
            const x = (index / 51) * chartWidth;
            return (
              <Rect
                key={`tick-${String(index)}`}
                x={x}
                y={CHART_HEIGHT - PAD_Y}
                width={1}
                height={4}
                fill={muted}
              />
            );
          })}
        </Svg>
      </View>
      <View style={styles.axisRow}>
        <Text style={[styles.axis, { color: muted }]}>{t('species.seasonality.weekStart')}</Text>
        <Text style={[styles.axis, { color: muted }]}>{t('species.seasonality.weekMid')}</Text>
        <Text style={[styles.axis, { color: muted }]}>{t('species.seasonality.weekEnd')}</Text>
      </View>
    </View>
  );
}

function padOrTrimWeeks(weeks: readonly number[]): number[] {
  const out = weeks.slice(0, 52).map((v) => clamp01(v));
  while (out.length < 52) {
    out.push(0);
  }
  return out;
}

function clamp01(value: number): number {
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

function buildAreaPath(
  weeks: readonly number[],
  width: number,
  innerHeight: number,
  padY: number,
): string {
  if (weeks.length === 0) {
    return '';
  }
  const last = weeks.length - 1;
  const coords = weeks.map((value, index) => {
    const x = last === 0 ? 0 : (index / last) * width;
    const y = padY + innerHeight * (1 - clamp01(value));
    return { x, y };
  });

  let d = `M 0 ${padY + innerHeight}`;
  for (const point of coords) {
    d += ` L ${point.x.toFixed(2)} ${point.y.toFixed(2)}`;
  }
  const lastPoint = coords[coords.length - 1];
  if (lastPoint !== undefined) {
    d += ` L ${lastPoint.x.toFixed(2)} ${padY + innerHeight} Z`;
  }
  return d;
}

const styles = StyleSheet.create({
  root: {
    gap: 6,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  caption: {
    fontSize: 13,
    marginBottom: 4,
  },
  frame: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
    alignItems: 'center',
    paddingVertical: 8,
  },
  axisRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  axis: {
    fontSize: 11,
  },
});
