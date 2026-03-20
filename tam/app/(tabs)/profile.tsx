import React from 'react';
import { StyleSheet, Text, View, Image, TouchableOpacity, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ChevronLeft } from 'lucide-react-native';
import { router } from 'expo-router';
import { useAuthStore } from '@/store/auth-store';

export default function ProfileScreen() {
  const user = useAuthStore(state => state.user);
  const logout = useAuthStore(state => state.logout);
  
  const handleLogout = () => {
    logout();
    router.replace('/');
  };
  
  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        { 
          text: "Delete", 
          onPress: () => {
            logout();
            router.replace('/auth/sign-in');
          },
          style: "destructive"
        }
      ]
    );
  };
  
  const handleEditProfile = () => {
    router.push('/profile/edit');
  };

  if (!user) return null;

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Image
        source={{ uri: 'https://images.unsplash.com/photo-1682686580391-615b1f28e6d1?q=80&w=1470&auto=format&fit=crop' }}
        style={styles.backgroundImage}
      />
      
      <TouchableOpacity 
        style={styles.backButton}
        onPress={() => router.back()}
      >
        <ChevronLeft color="white" size={24} />
      </TouchableOpacity>
      
      <View style={styles.profileHeader}>
        <Image 
          source={{ uri: user.profileImage?.startsWith('blob:') ? 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?q=80&w=1480&auto=format&fit=crop' : user.profileImage }} 
          style={styles.profileImage}
          defaultSource={require('@/assets/images/icon.png')}
        />
      </View>
      
      <View style={styles.detailsContainer}>
        <Text style={styles.detailsTitle}>My Details</Text>
        
        <Text style={styles.username}>{user.username}</Text>
        <Text style={styles.email}>{user.email}</Text>
        <Text style={styles.phone}>{user.phone}</Text>
        
        <TouchableOpacity 
          style={styles.editButton}
          onPress={handleEditProfile}
        >
          <Text style={styles.editButtonText}>Edit Account</Text>
        </TouchableOpacity>
        
        <View style={styles.accountActions}>
          <TouchableOpacity onPress={handleDeleteAccount}>
            <Text style={styles.deleteAccountText}>Delete my account</Text>
          </TouchableOpacity>
          
          <Text style={styles.divider}>|</Text>
          
          <TouchableOpacity onPress={handleLogout}>
            <Text style={styles.logoutText}>Log out</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f8f8',
  },
  backgroundImage: {
    width: '100%',
    height: 200,
    position: 'absolute',
    top: 0,
  },
  backButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
  },
  profileHeader: {
    alignItems: 'center',
    marginTop: 120,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: 'white',
  },
  detailsContainer: {
    backgroundColor: 'rgba(50, 50, 50, 0.8)',
    marginTop: 20,
    marginHorizontal: 20,
    borderRadius: 15,
    padding: 20,
    alignItems: 'center',
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 15,
  },
  username: {
    fontSize: 20,
    fontWeight: '600',
    color: 'white',
    marginBottom: 5,
  },
  email: {
    fontSize: 16,
    color: 'white',
    marginBottom: 5,
  },
  phone: {
    fontSize: 16,
    color: 'white',
    marginBottom: 20,
  },
  editButton: {
    backgroundColor: '#333',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 30,
    marginBottom: 20,
  },
  editButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  accountActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteAccountText: {
    color: '#ff6b6b',
    fontSize: 14,
  },
  divider: {
    marginHorizontal: 10,
    color: '#999',
  },
  logoutText: {
    color: 'white',
    fontSize: 14,
  },
});