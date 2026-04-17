import React from 'react';
import { Image, ImageStyle, StyleProp, View, ViewStyle } from 'react-native';

const LOGO = require('../../assets/images/branding/icon.png');

type Props = {
  size?: number;
  style?: StyleProp<ImageStyle>;
  containerStyle?: StyleProp<ViewStyle>;
};

export function BrandingLogo({ size = 88, style, containerStyle }: Props) {
  return (
    <View style={[{ alignItems: 'center', justifyContent: 'center' }, containerStyle]}>
      <Image
        source={LOGO}
        style={[{ width: size, height: size, borderRadius: size * 0.22 }, style]}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="App logo"
      />
    </View>
  );
}
