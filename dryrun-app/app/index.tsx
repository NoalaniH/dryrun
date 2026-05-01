import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { colors } from '../src/utils/theme';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.logoRow}>
          <View style={styles.logoLeft}>
            <View style={styles.logoIcon}>
              <View style={styles.logoDot} />
            </View>
            <Text style={styles.logoText}>DRYRUN</Text>
          </View>
          <Text style={styles.versionText}>v{Constants.expoConfig?.version}</Text>
        </View>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>ONE ACT. ONE STAGE.</Text>
        <Text style={styles.headline}>Build it.</Text>
        <Text style={styles.headline}>Run it.</Text>
        <Text style={[styles.headline, styles.headlineGold]}>Land it.</Text>
        <Text style={styles.body}>
          A focused rehearsal workspace. No distractions. No clutter. Just the act in
          front of you.
        </Text>
      </View>

      <TouchableOpacity
        style={styles.button}
        onPress={() => router.push('/create-run')}
      >
        <Text style={styles.buttonText}>New Dry Run</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => router.push('/library')}
      >
        <Text style={styles.secondaryButtonText}>My Library</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: { marginBottom: 0 },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  versionText: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 1,
  },
  logoIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.gold,
  },
  logoText: {
    color: colors.cream,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 3,
  },
  hero: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 32,
  },
  eyebrow: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 2.5,
    marginBottom: 12,
  },
  headline: {
    color: colors.cream,
    fontSize: 52,
    fontFamily: 'Georgia',
    lineHeight: 62,
  },
  headlineGold: {
    color: colors.gold,
    fontStyle: 'italic',
  },
  body: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 23,
    marginTop: 20,
    maxWidth: 280,
  },
  button: {
    backgroundColor: colors.gold,
    borderRadius: 10,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: {
    color: '#1a1100',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.muted,
    fontSize: 14,
    letterSpacing: 1,
  },
});
