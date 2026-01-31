import { useAuth } from '@/components/AuthContext';
import { Text, View } from '@/components/Themed';
import { FontAwesome } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity } from 'react-native';

export default function AuthScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleLogin = async () => {
    if (!email || !email.includes('@')) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const success = await signIn(email, password);
      if (success) {
        router.replace('/(tabs)');
      }
    } catch (error: any) {
      console.error('Login screen error:', error);
      let errorMessage = error.message || 'An unexpected error occurred.';
      
      if (errorMessage.includes('Location permission')) {
        errorMessage = 'Location access is required to use GPSc. Please enable it in your browser/device settings.';
      }
      
      Alert.alert('Login Problem', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <FontAwesome name="heartbeat" size={60} color="#FF3B30" />
          <Text style={styles.title}>GPSc</Text>
          <Text style={styles.subtitle}>Secure GPS-based Socializing</Text>
        </View>

        <View style={styles.form}>
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your email"
            placeholderTextColor="#999"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Min 6 characters"
            placeholderTextColor="#999"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <View style={styles.requirementBox}>
            <FontAwesome name="map-marker" size={16} color="#FF3B30" style={styles.reqIcon} />
            <Text style={styles.reqText}>GPS location is required for logging in</Text>
          </View>

          <TouchableOpacity 
            style={styles.button} 
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login / Sign Up</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    backgroundColor: 'transparent',
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    marginTop: 10,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'transparent',
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 15,
    fontSize: 16,
    marginBottom: 20,
    color: '#000',
  },
  requirementBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 25,
    backgroundColor: '#fff5f5',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ffdada',
  },
  reqIcon: {
    marginRight: 10,
  },
  reqText: {
    fontSize: 13,
    color: '#FF3B30',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#FF3B30',
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
