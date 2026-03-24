import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Navigation, X } from 'lucide-react-native';

interface NextManeuverBarProps {
  instruction: string;
  distanceLabel: string;
  onExit: () => void;
}

export default function NextManeuverBar({ instruction, distanceLabel, onExit }: NextManeuverBarProps) {
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <View style={styles.card}>
        <View style={styles.iconRow}>
          <Navigation color="#33ccff" size={28} />
          <View style={styles.textCol}>
            {distanceLabel ? (
              <Text style={styles.distance}>{distanceLabel}</Text>
            ) : null}
            <Text style={styles.instruction} numberOfLines={3}>
              {instruction}
            </Text>
          </View>
        </View>
      </View>
      <TouchableOpacity style={styles.exitBtn} onPress={onExit} accessibilityLabel="Exit navigation">
        <X color="#fff" size={22} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 52,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    zIndex: 20,
  },
  card: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.88)',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#33ccff',
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  textCol: {
    flex: 1,
  },
  distance: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 4,
  },
  instruction: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
    lineHeight: 22,
  },
  exitBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
