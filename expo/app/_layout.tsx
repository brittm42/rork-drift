import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { SettingsProvider, useSettings } from "@/providers/SettingsProvider";
import { TasksProvider } from "@/providers/TasksProvider";
import { PlanProvider } from "@/providers/PlanProvider";
import { ProfileProvider } from "@/providers/ProfileProvider";
import { Colors } from "@/constants/colors";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { settings, hydrated } = useSettings();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!hydrated) return;
    const first = segments[0] as string | undefined;
    const inOnboarding = first === "onboarding";
    if (!settings.onboarded && !inOnboarding) {
      router.replace("/onboarding");
    } else if (settings.onboarded && inOnboarding) {
      router.replace("/");
    }
  }, [hydrated, settings.onboarded, segments, router]);

  return <>{children}</>;
}

function RootLayoutNav() {
  return (
    <Stack
      screenOptions={{
        headerBackTitle: "Back",
        contentStyle: { backgroundColor: Colors.background },
        headerStyle: { backgroundColor: Colors.background },
        headerTitleStyle: { color: Colors.ink, fontWeight: "600" },
        headerShadowVisible: false,
        headerTintColor: Colors.sageDeep,
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="onboarding" options={{ headerShown: false, gestureEnabled: false }} />
      <Stack.Screen
        name="add-task"
        options={{
          presentation: "modal",
          headerShown: false,
          animation: "slide_from_bottom",
        }}
      />
      <Stack.Screen name="profile" options={{ title: "What I know" }} />
      <Stack.Screen
        name="profile-add"
        options={{
          presentation: "modal",
          headerShown: false,
          animation: "slide_from_bottom",
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <SettingsProvider>
          <ProfileProvider>
            <TasksProvider>
              <PlanProvider>
                <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.background }}>
                  <StatusBar style="dark" />
                  <OnboardingGate>
                    <RootLayoutNav />
                  </OnboardingGate>
                </GestureHandlerRootView>
              </PlanProvider>
            </TasksProvider>
          </ProfileProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
