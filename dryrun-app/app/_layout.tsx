import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen name="create-run" options={{ headerShown: false }} />
      <Stack.Screen name="builder" options={{ headerShown: false }} />
      <Stack.Screen name="dry-run" options={{ headerShown: false }} />
      <Stack.Screen name="library" options={{ headerShown: false }} />
      <Stack.Screen name="run-summary" options={{ headerShown: false }} />
    </Stack>
  );
}
