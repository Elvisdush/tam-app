import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { AlertTriangle, X } from 'lucide-react-native';
import type { RouteHazardBannerState } from '@/hooks/useRouteHazardAlerts';

interface RouteHazardBannerProps {
  state: RouteHazardBannerState;
  approachMinutes: number;
  onDismiss: () => void;
  /** Distance from top of map area (below status / nav bars) */
  topOffset?: number;
}

export default function RouteHazardBanner({
  state,
  approachMinutes,
  onDismiss,
  topOffset = 132,
}: RouteHazardBannerProps) {
  const { hazard, etaMinutes } = state.hazard;
  const { phase } = state;
  const eta = Math.max(1, Math.round(etaMinutes));
  const isUrgent = phase === 'approaching';

  return (
    <View style={[styles.wrap, { top: topOffset }]} pointerEvents="box-none">
      <View style={[styles.card, isUrgent ? styles.cardUrgent : styles.cardAdvance]}>
        <View style={styles.iconCol}>
          <AlertTriangle color={isUrgent ? '#fef08a' : '#fed7aa'} size={26} strokeWidth={2.5} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.kicker}>
            {isUrgent ? `About ${eta} min to hazard` : 'Hazard on your route'}
          </Text>
          <Text style={styles.title} numberOfLines={2}>
            {hazard.title}
          </Text>
          <Text style={styles.hint} numberOfLines={3}>
            {isUrgent
              ? `${hazard.avoidanceHint} (${approachMinutes}-minute reminder)`
              : hazard.avoidanceHint}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Dismiss hazard notice"
        >
          <X color={isUrgent ? '#e2e8f0' : '#cbd5e1'} size={22} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 10,
    right: 10,
    zIndex: 25,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 10,
    borderLeftWidth: 4,
  },
  cardAdvance: {
    backgroundColor: 'rgba(124, 45, 18, 0.94)',
    borderLeftColor: '#fb923c',
  },
  cardUrgent: {
    backgroundColor: 'rgba(127, 29, 29, 0.95)',
    borderLeftColor: '#f87171',
  },
  iconCol: {
    paddingTop: 2,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
    lineHeight: 21,
  },
  hint: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.88)',
    lineHeight: 18,
  },
  closeBtn: {
    padding: 4,
  },
});
