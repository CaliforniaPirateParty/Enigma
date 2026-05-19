/**
 * react-native mock for Jest Node environment.
 *
 * react-native uses Flow types + native code that cannot be parsed by ts-jest
 * in the Node test environment. This stub provides the minimal subset of
 * react-native primitives needed to render component trees under
 * react-test-renderer.
 */

const React = require('react');

// Primitive view components — react-test-renderer renders them as-is
const View = 'View';
const Text = 'Text';
const Pressable = 'Pressable';
const TouchableOpacity = 'TouchableOpacity';
const ScrollView = 'ScrollView';
const Image = 'Image';
const TextInput = 'TextInput';
const ActivityIndicator = 'ActivityIndicator';
const SafeAreaView = 'SafeAreaView';

// FlatList — minimal implementation that calls renderItem for each data entry
function FlatList({ data, renderItem, keyExtractor, ListEmptyComponent, testID, style, refreshing, onRefresh }) {
  if (!data || data.length === 0) {
    return React.createElement(
      'View',
      { testID, style },
      ListEmptyComponent
        ? typeof ListEmptyComponent === 'function'
          ? React.createElement(ListEmptyComponent)
          : ListEmptyComponent
        : null,
    );
  }
  return React.createElement(
    'View',
    { testID, style },
    data.map((item, index) => {
      const key = keyExtractor ? keyExtractor(item, index) : String(index);
      return React.createElement('View', { key }, renderItem({ item, index }));
    }),
  );
}

// Button — simple stub component
function Button({ title, onPress, disabled }) {
  return React.createElement('Pressable', { onPress, disabled }, React.createElement('Text', null, title));
}

// StyleSheet — identity map
const StyleSheet = {
  create: (styles) => styles,
  flatten: (style) => style,
  hairlineWidth: 1,
};

// Alert stub
const Alert = {
  alert: jest.fn(),
};

// Platform
const Platform = {
  OS: 'ios',
  select: (obj) => obj.ios ?? obj.default,
};

// Dimensions
const Dimensions = {
  get: () => ({ width: 375, height: 812 }),
};

// Clipboard
const Clipboard = {
  setString: jest.fn(),
  getString: jest.fn().mockResolvedValue(''),
};

// Animated — minimal stub
const Animated = {
  Value: jest.fn(() => ({ setValue: jest.fn() })),
  View: 'Animated.View',
  createAnimatedComponent: (c) => c,
  timing: jest.fn(() => ({ start: jest.fn() })),
  spring: jest.fn(() => ({ start: jest.fn() })),
  parallel: jest.fn(() => ({ start: jest.fn() })),
};

// LayoutAnimation
const LayoutAnimation = {
  configureNext: jest.fn(),
  easeInEaseOut: jest.fn(),
};

// Keyboard
const Keyboard = {
  dismiss: jest.fn(),
  addListener: jest.fn(() => ({ remove: jest.fn() })),
};

// Linking
const Linking = {
  openURL: jest.fn(),
  canOpenURL: jest.fn().mockResolvedValue(true),
};

// Vibration
const Vibration = {
  vibrate: jest.fn(),
};

// AppState
const AppState = {
  currentState: 'active',
  addEventListener: jest.fn(() => ({ remove: jest.fn() })),
};

// NativeModules
const NativeModules = {};

// I18nManager
const I18nManager = { isRTL: false };

// PixelRatio
const PixelRatio = { get: () => 2, roundToNearestPixel: (v) => v };

// useColorScheme
const useColorScheme = () => 'light';

// StatusBar
const StatusBar = { setBarStyle: jest.fn(), currentHeight: 0 };

module.exports = {
  View,
  Text,
  Button,
  Pressable,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  FlatList,
  StyleSheet,
  Alert,
  Platform,
  Dimensions,
  Clipboard,
  Animated,
  LayoutAnimation,
  Keyboard,
  Linking,
  Vibration,
  AppState,
  NativeModules,
  I18nManager,
  PixelRatio,
  useColorScheme,
  StatusBar,
};
