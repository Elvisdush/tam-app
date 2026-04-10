import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MapPin, X, ChevronDown, Search, Mic } from 'lucide-react-native';
import type { RwandaDestination } from '@/constants/rwanda-destinations';
import { destinationsForTransport, filterDestinationsByQuery } from '@/lib/rwanda-passenger-pricing';
type Props = {
  transportType: 'car' | 'motorbike';
  selected: RwandaDestination | null;
  onSelect: (destination: RwandaDestination) => void;
  /** Waze-style single “Where to?” row */
  appearance?: 'default' | 'waze';
};

export function PassengerDestinationPicker({ transportType, selected, onSelect, appearance = 'default' }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const baseList = useMemo(() => destinationsForTransport(transportType), [transportType]);
  const filtered = useMemo(() => filterDestinationsByQuery(baseList, query), [baseList, query]);

  const modeHint = `${
    transportType === 'motorbike' ? 'Taxi moto' : 'Taxi car'
  }: any district or city in Rwanda.`;

  const isWaze = appearance === 'waze';

  return (
    <>
      <TouchableOpacity
        style={[styles.field, isWaze && styles.fieldWaze]}
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={isWaze ? 'Where to' : 'Choose destination on the map'}
      >
        {isWaze ? (
          <Search color="#94a3b8" size={22} strokeWidth={2.2} />
        ) : (
          <MapPin color="#64748b" size={20} />
        )}
        <View style={styles.fieldTextWrap}>
          {!isWaze && <Text style={styles.fieldLabel}>Destination (Rwanda)</Text>}
          <Text
            style={selected ? styles.fieldValue : isWaze ? styles.fieldPlaceholderWaze : styles.fieldPlaceholder}
            numberOfLines={isWaze ? 1 : 2}
          >
            {selected ? `${selected.name} · ${selected.subtitle}` : isWaze ? 'Where to?' : 'Tap to choose district / city'}
          </Text>
        </View>
        {isWaze ? (
          <Mic color="#4285F4" size={22} strokeWidth={2} />
        ) : (
          <ChevronDown color="#94a3b8" size={22} />
        )}
      </TouchableOpacity>
      {!isWaze && <Text style={styles.hint}>{modeHint}</Text>}
      {isWaze && <Text style={styles.hintWaze}>{modeHint}</Text>}

      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Choose destination</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X color="#64748b" size={26} />
              </TouchableOpacity>
            </View>
            <Text style={styles.sheetSub}>{modeHint}</Text>
            <TextInput
              style={styles.search}
              placeholder="Search district or city…"
              placeholderTextColor="#999"
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            <FlatList
              data={filtered}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  <Text style={styles.rowTitle}>{item.name}</Text>
                  <Text style={styles.rowSub}>{item.subtitle}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.empty}>No matches. Try another name.</Text>
              }
            />
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 30,
    marginBottom: 8,
    gap: 8,
  },
  fieldWaze: {
    backgroundColor: '#f1f5f9',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 28,
    marginBottom: 10,
  },
  fieldTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  fieldLabel: {
    fontSize: 11,
    color: '#64748b',
    marginBottom: 2,
  },
  fieldValue: {
    fontSize: 15,
    color: '#0f172a',
    fontWeight: '600',
  },
  fieldPlaceholder: {
    fontSize: 15,
    color: '#94a3b8',
    fontWeight: '500',
  },
  fieldPlaceholderWaze: {
    fontSize: 17,
    color: '#94a3b8',
    fontWeight: '500',
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 10,
    lineHeight: 16,
  },
  hintWaze: {
    fontSize: 11,
    color: '#94a3b8',
    marginBottom: 8,
    lineHeight: 14,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '88%',
    paddingBottom: 24,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  sheetSub: {
    fontSize: 13,
    color: '#64748b',
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  search: {
    marginHorizontal: 16,
    marginBottom: 10,
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 16,
  },
  list: {
    flexGrow: 1,
    maxHeight: 420,
    paddingHorizontal: 8,
  },
  row: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
  rowSub: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  empty: {
    textAlign: 'center',
    color: '#94a3b8',
    padding: 24,
  },
});
