import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { RWANDA_DESTINATIONS } from '@/constants/rwanda-destinations';
import type { RwandaDestination } from '@/constants/rwanda-destinations';
import { filterDestinationsByQuery } from '@/lib/rwanda-passenger-pricing';

const MAX_ITEMS = 8;
const MIN_QUERY_LEN = 2;

type Props = {
  query: string;
  onPick: (d: RwandaDestination) => void;
};

/**
 * Compact Rwanda district / city suggestions for driver ride search (From / To).
 */
export function DriverRwandaSuggestList({ query, onPick }: Props) {
  const items = useMemo(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LEN) return [];
    return filterDestinationsByQuery(RWANDA_DESTINATIONS, q).slice(0, MAX_ITEMS);
  }, [query]);

  if (items.length === 0) return null;

  return (
    <View style={styles.outer} accessibilityRole="list">
      <Text style={styles.caption}>Suggestions</Text>
      <ScrollView
        style={styles.scroll}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
        showsVerticalScrollIndicator={items.length > 4}
      >
        {items.map((d) => (
          <TouchableOpacity
            key={d.id}
            style={styles.row}
            onPress={() => onPick(d)}
            activeOpacity={0.65}
            accessibilityRole="button"
            accessibilityLabel={`${d.name}, ${d.subtitle}`}
          >
            <MapPin size={16} color="#64748b" strokeWidth={2} />
            <View style={styles.textCol}>
              <Text style={styles.name} numberOfLines={1}>
                {d.name}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {d.subtitle}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    marginTop: -4,
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    overflow: 'hidden',
    maxHeight: 240,
    ...Platform.select({
      android: { elevation: 2 },
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
      },
    }),
  },
  scroll: {
    maxHeight: 200,
  },
  caption: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#64748b',
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: '#f8fafc',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e2e8f0',
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0f172a',
  },
  sub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
});
