import React from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Image } from 'react-native';

type TransportType = 'car' | 'motorbike';

interface TransportTypeSelectorProps {
  selected: TransportType;
  onSelect: (type: TransportType) => void;
  /** Show nearby count for each type - appears after location is known */
  nearbyCounts?: { moto: number; car: number };
}

export function TransportTypeSelector({ selected, onSelect, nearbyCounts }: TransportTypeSelectorProps) {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.option, selected === 'motorbike' && styles.selectedOption]}
        onPress={() => onSelect('motorbike')}
        accessibilityRole="button"
        accessibilityState={{ selected: selected === 'motorbike' }}
        accessibilityLabel="Taxi moto — motorcycle taxi"
      >
        <View style={styles.imageBackground}>
          <Image
            source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/aakyln7msadtpocq79wim' }}
            style={styles.backgroundImage}
            resizeMode="cover"
          />
        </View>
        <View style={styles.optionContent}>
          <Text style={[styles.optionText, selected === 'motorbike' && styles.selectedText]}>
            Taxi Moto
          </Text>
          {nearbyCounts != null && (
            <Text style={[styles.nearbyText, selected === 'motorbike' && styles.nearbyTextSelected]}>
              {nearbyCounts.moto} nearby
            </Text>
          )}
        </View>
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[styles.option, selected === 'car' && styles.selectedOption]}
        onPress={() => onSelect('car')}
        accessibilityRole="button"
        accessibilityState={{ selected: selected === 'car' }}
        accessibilityLabel="Taxi car — car taxi"
      >
        <View style={styles.imageBackground}>
          <Image
            source={{ uri: 'https://pub-e001eb4506b145aa938b5d3badbff6a5.r2.dev/attachments/xyp64zxn06lmq0yiuizuh' }}
            style={styles.backgroundImage}
            resizeMode="cover"
          />
        </View>
        <View style={styles.optionContent}>
          <Text style={[styles.optionText, selected === 'car' && styles.selectedText]}>
            Taxi Car
          </Text>
          {nearbyCounts != null && (
            <Text style={[styles.nearbyText, selected === 'car' && styles.nearbyTextSelected]}>
              {nearbyCounts.car} nearby
            </Text>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  option: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    marginHorizontal: 5,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: 'white',
    position: 'relative',
    overflow: 'hidden',
    height: 88,
  },
  selectedOption: {
    borderColor: '#3498db',
    backgroundColor: '#f0f8ff',
  },
  imageBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    borderRadius: 10,
  },
  backgroundImage: {
    width: '100%',
    height: '100%',
    opacity: 0.3,
  },
  optionContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  optionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  selectedText: {
    color: '#3498db',
    fontWeight: '600',
  },
  nearbyText: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  nearbyTextSelected: {
    color: '#3498db',
  },
});