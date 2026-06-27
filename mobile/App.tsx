import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import CarpenterDashboard from './screens/CarpenterDashboard';
import ProjectDetails from './screens/ProjectDetails';

export type RootStackParamList = {
    Dashboard: undefined;
    ProjectDetails: { projectId: string; projectName: string; status: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
    return (
        <NavigationContainer>
            <Stack.Navigator
                initialRouteName="Dashboard"
                screenOptions={{
                    headerStyle: { backgroundColor: '#4F46E5' }, // indigo-600
                    headerTintColor: '#fff',
                    headerTitleStyle: { fontWeight: 'bold' },
                }}
            >
                <Stack.Screen
                    name="Dashboard"
                    component={CarpenterDashboard}
                    options={{ title: 'Fresa - Marceneiro' }}
                />
                <Stack.Screen
                    name="ProjectDetails"
                    component={ProjectDetails}
                    options={({ route }) => ({ title: route.params.projectName })}
                />
            </Stack.Navigator>
        </NavigationContainer>
    );
}
