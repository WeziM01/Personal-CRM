import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HomeScreen } from "../screens/HomeScreen";
import { PersonProfileScreen } from "../screens/PersonProfileScreen";
import { EventScreen } from "../screens/EventScreen";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

const Tab = createBottomTabNavigator();

export function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerShown: true,
        headerTitleAlign: "left",
        tabBarShowLabel: true,
        tabBarIcon: ({ color, size }) => {
          let iconName = "";
          if (route.name === "Home") iconName = "home-outline";
          else if (route.name === "People") iconName = "people-outline";
          else if (route.name === "Events") iconName = "calendar-outline";
          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
        headerRight: () => (
          <Pressable
            style={{ marginRight: 18 }}
            onPress={() => {/* TODO: open settings/profile modal */}}
            accessibilityLabel="Settings"
          >
            <MaterialIcons name="settings" size={24} color="#222" />
          </Pressable>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="People" component={PersonProfileScreen} />
      <Tab.Screen name="Events" component={EventScreen} />
    </Tab.Navigator>
  );
}
