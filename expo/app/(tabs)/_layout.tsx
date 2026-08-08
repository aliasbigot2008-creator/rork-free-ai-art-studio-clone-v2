import { Tabs } from 'expo-router';
import { ImageIcon, Palette, Sparkles } from 'lucide-react-native';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#8B5CF6',
        tabBarInactiveTintColor: '#64748B',
        headerShown: true,
        tabBarStyle: {
          backgroundColor: '#1E293B',
          borderTopColor: '#334155',
          borderTopWidth: 1,
        },
        headerStyle: {
          backgroundColor: '#1E293B',
        },
        headerTintColor: '#F1F5F9',
        headerTitleStyle: {
          fontWeight: '700' as const,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Create',
          tabBarIcon: ({ color }) => <Sparkles color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="gallery"
        options={{
          title: 'Gallery',
          tabBarIcon: ({ color }) => <ImageIcon color={color} size={24} />,
        }}
      />
      <Tabs.Screen
        name="styles"
        options={{
          title: 'Styles',
          tabBarIcon: ({ color }) => <Palette color={color} size={24} />,
        }}
      />
    </Tabs>
  );
}
