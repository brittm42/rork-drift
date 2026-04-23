import { Tabs } from "expo-router";
import { Inbox, Settings as SettingsIcon, Sunrise } from "lucide-react-native";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { Colors } from "@/constants/colors";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors.sageDeep,
        tabBarInactiveTintColor: Colors.inkMuted,
        tabBarStyle: {
          backgroundColor: Colors.paper,
          borderTopColor: Colors.borderSoft,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: Platform.OS === "ios" ? 84 : 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "500",
          letterSpacing: 0.3,
          marginTop: 2,
        },
        headerShown: false,
        sceneStyle: { backgroundColor: Colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Today",
          tabBarIcon: ({ color, size }) => <Sunrise color={color} size={size - 2} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: "Inbox",
          tabBarIcon: ({ color, size }) => <Inbox color={color} size={size - 2} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => <SettingsIcon color={color} size={size - 2} strokeWidth={1.75} />,
        }}
      />
    </Tabs>
  );
}
