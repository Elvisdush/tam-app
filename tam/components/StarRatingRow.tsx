import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Star } from 'lucide-react-native';

/** Maximum stars on the scale (**5 = highest**). */
export const STAR_RATING_MAX = 5;

const GOLD = '#eab308';
const EMPTY = '#cbd5e1';

type Props = {
  /** Average 1–5; rounded to full stars for display */
  value?: number | null;
  size?: number;
  ratingCount?: number;
  /** When there is no value, show 5 empty stars + emptyLabel */
  showEmpty?: boolean;
  emptyLabel?: string;
  /** e.g. "Demo" */
  badge?: string;
  /** Show “5 stars is the highest” line */
  showMaxHint?: boolean;
};

/**
 * Renders **5 stars**. Filled count = `round(value)` clamped to 1–5.
 * **5 filled stars** = highest rating on this scale.
 */
export function StarRatingRow({
  value,
  size = 18,
  ratingCount,
  showEmpty,
  emptyLabel = 'No ratings yet',
  badge,
  showMaxHint = false,
}: Props) {
  const hasValue = value != null && value > 0;
  const filled = hasValue
    ? Math.min(STAR_RATING_MAX, Math.max(0, Math.round(value as number)))
    : 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {Array.from({ length: STAR_RATING_MAX }, (_, i) => {
          const isFilled = hasValue && i < filled;
          return (
            <View key={i} style={styles.starWrap}>
              <Star
                size={size}
                color={isFilled ? GOLD : EMPTY}
                fill={isFilled ? GOLD : 'transparent'}
                strokeWidth={isFilled ? 0 : 2}
              />
            </View>
          );
        })}
      </View>
      {hasValue && (
        <View style={styles.metaRow}>
          <Text style={styles.score}>
            {(value as number).toFixed(1)} / {STAR_RATING_MAX}
          </Text>
          {ratingCount != null && ratingCount > 0 ? (
            <Text style={styles.count}>
              {' '}
              · {ratingCount} rating{ratingCount === 1 ? '' : 's'}
            </Text>
          ) : null}
          {badge ? <Text style={styles.badge}> · {badge}</Text> : null}
        </View>
      )}
      {!hasValue && showEmpty ? (
        <Text style={styles.emptyLabel}>{emptyLabel}</Text>
      ) : null}
      {showMaxHint ? (
        <Text style={styles.hint}>{STAR_RATING_MAX} stars is the highest rating</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'flex-start',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  starWrap: {
    marginRight: 4,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginTop: 6,
  },
  score: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0f172a',
  },
  count: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
  badge: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
  },
  emptyLabel: {
    marginTop: 6,
    fontSize: 14,
    color: '#94a3b8',
    fontStyle: 'italic',
  },
  hint: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: '#94a3b8',
  },
});
