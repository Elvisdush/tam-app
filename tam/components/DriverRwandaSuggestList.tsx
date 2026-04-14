import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform } from 'react-native';
import { MapPin } from 'lucide-react-native';
import { RWANDA_DESTINATIONS } from '@/constants/rwanda-destinations';
import { RWANDA_SEARCH_PLACES } from '@/constants/rwanda-search-places';

const MAX_ITEMS = 8;
const MIN_QUERY_LEN = 2;

type DriverSuggestion = {
  id: string;
  name: string;
  subtitle: string;
  search: string;
};

type Props = {
  query: string;
  onPick: (d: DriverSuggestion) => void;
};

/**
 * Compact Rwanda place suggestions (districts, sectors, streets) for driver search.
 */
export function DriverRwandaSuggestList({ query, onPick }: Props) {
  const allPlaces = useMemo<DriverSuggestion[]>(
    () => [...RWANDA_DESTINATIONS, ...RWANDA_SEARCH_PLACES],
    []
  );

  const items = useMemo(() => {
    const q = query.trim();
    if (q.length < MIN_QUERY_LEN) return [];
    const normalizedQ = q.toLowerCase();
    const compactQ = normalizedQ.replace(/[^a-z0-9]/g, '');
    return allPlaces
      .filter((d) => {
        const hayRaw = `${d.name} ${d.subtitle} ${d.search}`.toLowerCase();
        const hay = hayRaw.replace(/[^a-z0-9]/g, ' ');
        const compactHay = hay.replace(/\s+/g, '');
        return hay.includes(normalizedQ) || compactHay.includes(compactQ);
      })
      .slice(0, MAX_ITEMS);
  }, [query, allPlaces]);

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
