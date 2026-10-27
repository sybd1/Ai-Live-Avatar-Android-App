import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
export default function Layout() { return <SafeAreaProvider><Stack screenOptions={{ headerStyle: { backgroundColor: '#F6F5EF' }, headerTintColor: '#20382F', headerTitle: 'one_step_service' }} /></SafeAreaProvider>; }
