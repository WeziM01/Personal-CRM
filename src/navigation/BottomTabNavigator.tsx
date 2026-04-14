import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { HomeScreen } from "../screens/HomeScreen";
import { PersonProfileScreen } from "../screens/PersonProfileScreen";
import { EventScreen } from "../screens/EventScreen";
import { Ionicons } from "@expo/vector-icons";

const Tab = createBottomTabNavigator();

export function BottomTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarIcon: ({ color, size }) => {
          let iconName = "";
          if (route.name === "Home") iconName = "home-outline";
          else if (route.name === "People") iconName = "people-outline";
          else if (route.name === "Events") iconName = "calendar-outline";
          return <Ionicons name={iconName as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="People" component={PersonProfileScreen} />
      <Tab.Screen name="Events" component={EventScreen} />
    </Tab.Navigator>
  );
}
