import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Colors } from "@/constants/colors";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Not found" }} />
      <View style={styles.container}>
        <Text style={styles.title}>This page drifted off.</Text>
        <Link href="/" style={styles.link}>
          <Text style={styles.linkText}>Back to today</Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: "600",
    color: Colors.ink,
    letterSpacing: -0.3,
    marginBottom: 16,
  },
  link: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: Colors.sageDeep,
    borderRadius: 24,
  },
  linkText: {
    color: Colors.paper,
    fontWeight: "600",
    fontSize: 14,
  },
});
