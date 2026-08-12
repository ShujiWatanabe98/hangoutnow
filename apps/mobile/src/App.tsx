import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.screen}>
      <View><Text style={styles.brand}>Hangout Now</Text><Text style={styles.title}>今から何する？</Text></View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: 24, backgroundColor: '#fff8ef' },
  brand: { color: '#ff5a36', fontSize: 18, fontWeight: '700' },
  title: { marginTop: 32, fontSize: 32, fontWeight: '800', color: '#241f1c' },
});
