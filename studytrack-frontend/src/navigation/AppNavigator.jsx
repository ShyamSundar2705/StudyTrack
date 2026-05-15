import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../constraints/theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Auth / onboarding
import SplashScreen        from '../screens/SplashScreen';
import SubjectSetupScreen  from '../screens/SubjectSetupScreen';

// Session flow (fullscreen, no tab bar)
import SessionActiveScreen   from '../screens/SessionActiveScreen';
import SessionCompleteScreen from '../screens/SessionCompleteScreen';

// Tab: Home
import HomeTimerScreen from '../screens/HomeTimerScreen';

// Tab: Planner
import DailyPlannerScreen from '../screens/DailyPlannerScreen';

// Tab: Insights
import InsightsScreen      from '../screens/InsightsScreen';
import SubjectDetailsScreen from '../screens/SubjectDetailsScreen';

// Tab: Groups
import StudyGroupsScreen  from '../screens/StudyGroupsScreen';
import LeaderboardScreen  from '../screens/LeaderboardScreen';

// Tab: Profile
import ProfileScreen     from '../screens/ProfileScreen';
import AppSettingsScreen from '../screens/AppSettingsScreen';

// ─── Navigators ──────────────────────────────────────────────────────────────

const RootStack = createNativeStackNavigator();
const AuthStack = createNativeStackNavigator();
const Tab       = createBottomTabNavigator();

const HomeStack     = createNativeStackNavigator();
const PlannerStack  = createNativeStackNavigator();
const InsightsStack = createNativeStackNavigator();
const GroupsStack   = createNativeStackNavigator();
const ProfileStack  = createNativeStackNavigator();

// ─── Shared stack options (no native header) ─────────────────────────────────

const NO_HEADER = { headerShown: false };

// ─── Nested stacks inside each tab ───────────────────────────────────────────

function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={NO_HEADER}>
      <HomeStack.Screen name="HomeTimer" component={HomeTimerScreen} />
    </HomeStack.Navigator>
  );
}

function PlannerStackScreen() {
  return (
    <PlannerStack.Navigator screenOptions={NO_HEADER}>
      <PlannerStack.Screen name="DailyPlanner" component={DailyPlannerScreen} />
    </PlannerStack.Navigator>
  );
}

function InsightsStackScreen() {
  return (
    <InsightsStack.Navigator screenOptions={NO_HEADER}>
      <InsightsStack.Screen name="Insights"       component={InsightsScreen} />
      <InsightsStack.Screen name="SubjectDetails" component={SubjectDetailsScreen} />
    </InsightsStack.Navigator>
  );
}

function GroupsStackScreen() {
  return (
    <GroupsStack.Navigator screenOptions={NO_HEADER}>
      <GroupsStack.Screen name="StudyGroups" component={StudyGroupsScreen} />
      <GroupsStack.Screen name="Leaderboard" component={LeaderboardScreen} />
    </GroupsStack.Navigator>
  );
}

function ProfileStackScreen() {
  return (
    <ProfileStack.Navigator screenOptions={NO_HEADER}>
      <ProfileStack.Screen name="Profile"        component={ProfileScreen} />
      <ProfileStack.Screen name="AppSettings"    component={AppSettingsScreen} />
      <ProfileStack.Screen name="SubjectDetails" component={SubjectDetailsScreen} />
    </ProfileStack.Navigator>
  );
}

// ─── Tab bar icon helper ──────────────────────────────────────────────────────

function tabIcon(outlineName, filledName) {
  return ({ focused, color, size }) => (
    <Ionicons
      name={focused ? filledName : outlineName}
      size={size}
      color={color}
    />
  );
}

// ─── Main tab navigator ───────────────────────────────────────────────────────

function MainTabs() {
  const insets = useSafeAreaInsets();
  const tabBarStyle = {
    backgroundColor: colors.surfaceDeep,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    height: 64 + insets.bottom,
    paddingBottom: insets.bottom + 6,
    paddingTop: 6,
  };

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor:   colors.accentPrimary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeStackScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: tabIcon('home-outline', 'home'),
        }}
      />
      <Tab.Screen
        name="PlannerTab"
        component={PlannerStackScreen}
        options={{
          tabBarLabel: 'Planner',
          tabBarIcon: tabIcon('calendar-outline', 'calendar'),
        }}
      />
      <Tab.Screen
        name="InsightsTab"
        component={InsightsStackScreen}
        options={{
          tabBarLabel: 'Insights',
          tabBarIcon: tabIcon('bar-chart-outline', 'bar-chart'),
        }}
      />
      <Tab.Screen
        name="GroupsTab"
        component={GroupsStackScreen}
        options={{
          tabBarLabel: 'Groups',
          tabBarIcon: tabIcon('people-outline', 'people'),
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileStackScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: tabIcon('person-outline', 'person'),
        }}
      />
    </Tab.Navigator>
  );
}

// ─── Auth stack (onboarding, no tab bar) ─────────────────────────────────────

function Auth() {
  return (
    <AuthStack.Navigator screenOptions={NO_HEADER}>
      <AuthStack.Screen name="Splash"       component={SplashScreen} />
      <AuthStack.Screen name="SubjectSetup" component={SubjectSetupScreen} />
    </AuthStack.Navigator>
  );
}

// ─── Root navigator ───────────────────────────────────────────────────────────
//
// Session screens (SessionActive, SessionComplete) live here so they render
// without the tab bar. HomeTimer pushes them via navigation.navigate().
//
// Flow:
//   Auth → Main (replace)
//   HomeTimer → SessionActive → SessionComplete → Main (popToTop / navigate)
//   SessionComplete "Start Another" → SessionActive (navigate)

export default function AppNavigator() {
  return (
    <RootStack.Navigator screenOptions={NO_HEADER}>
      {/* Onboarding */}
      <RootStack.Screen name="Auth" component={Auth} />

      {/* Main app with tab bar */}
      <RootStack.Screen name="Main" component={MainTabs} />

      {/* Fullscreen session flow — no tab bar */}
      <RootStack.Screen name="SessionActive"   component={SessionActiveScreen} />
      <RootStack.Screen name="SessionComplete" component={SessionCompleteScreen} />

      {/* Settings pushed from SessionActive so back returns to the running session */}
      <RootStack.Screen name="AppSettingsModal" component={AppSettingsScreen} />
    </RootStack.Navigator>
  );
}
