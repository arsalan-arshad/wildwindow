import React from 'react';
import { View } from 'react-native';

type MapChildProps = {
  readonly children?: React.ReactNode;
  readonly testID?: string;
};

export default function MapView({ children, testID }: MapChildProps) {
  return React.createElement(View, { testID }, children);
}

export function Polygon(_props: Record<string, unknown>) {
  return React.createElement(View, { testID: 'map-polygon' });
}

export type Region = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};
