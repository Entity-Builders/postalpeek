// Stub for react-native's codegenNativeComponent
// This file is used by Vite to satisfy native-only imports
// from libraries like react-native-safe-area-context when building for web.
// It returns a simple wrapper that just renders its children.

export default function codegenNativeComponent(name) {
  return ({ children, ...props }) => children || null;
}
