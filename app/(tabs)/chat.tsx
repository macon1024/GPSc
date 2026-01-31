import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Image, Animated, Easing, Dimensions, Modal, Platform } from 'react-native';
import * as Location from 'expo-location';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Text, View } from '@/components/Themed';
import { FontAwesome } from '@expo/vector-icons';
import { db } from '../../lib/firebase';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, orderBy, limit } from 'firebase/firestore';
import { useAuth } from '@/components/AuthContext';

const { width, height } = Dimensions.get('window');

interface User {
  id: string;
  name: string;
  distance: string;
  avatar: string;
  lastLocation?: {
    latitude: number;
    longitude: number;
  };
}

interface Message {
  id: string;
  text: string;
  senderId: string;
  createdAt: any;
}

export default function GPSChatScreen() {
  const { user: currentUser } = useAuth();
  const [viewMode, setViewMode] = useState<'radar' | 'chat'>('radar');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [nearbyUsers, setNearbyUsers] = useState<User[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isVideoCalling, setIsVideoCalling] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [currentPos, setCurrentPos] = useState<{latitude: number, longitude: number} | null>(null);
  
  const radarAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Radar Animation
  useEffect(() => {
    Animated.loop(
      Animated.timing(radarAnim, { toValue: 1, duration: 3000, easing: Easing.linear, useNativeDriver: true })
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  // Live Location Watcher
  useEffect(() => {
    let watcher: any;
    
    const startWatching = async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      watcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10, // Update every 10 meters
        },
        (location) => {
          setCurrentPos({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          });
        }
      );
    };

    startWatching();
    return () => watcher?.remove();
  }, []);

  // Discover Nearby Users from Firestore
  useEffect(() => {
    if (!currentUser) return;

    const q = query(collection(db, 'users'), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users: User[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (doc.id !== currentUser.uid) {
          // Initial calculation
          let distStr = 'Nearby';
          const userLat = data.lastLocation?.latitude;
          const userLng = data.lastLocation?.longitude;
          const myLat = currentPos?.latitude || currentUser.lastLocation?.latitude;
          const myLng = currentPos?.longitude || currentUser.lastLocation?.longitude;

          if (userLat && userLng && myLat && myLng) {
            const d = calculateDistance(myLat, myLng, userLat, userLng);
            distStr = d < 1 ? `${(d * 1000).toFixed(0)}m` : `${d.toFixed(1)}km`;
          }

          users.push({
            id: doc.id,
            name: data.name || 'User',
            distance: distStr,
            avatar: `https://i.pravatar.cc/150?u=${doc.id}`,
            lastLocation: data.lastLocation,
          });
        }
      });
      setNearbyUsers(users);
    });

    return unsubscribe;
  }, [currentUser, currentPos]);

  // Listen for Messages
  useEffect(() => {
    if (!selectedUser || !currentUser) return;

    // Use a composite key or a subcollection for chat. Here we use a global messages collection for simplicity in demo
    const chatId = [currentUser.uid, selectedUser.id].sort().join('_');
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc) => {
        msgs.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(msgs);
    });

    return unsubscribe;
  }, [selectedUser, currentUser]);

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    setViewMode('chat');
  };

  const startVideoCall = async () => {
    const { status } = await requestPermission();
    if (status === 'granted') {
      setIsVideoCalling(true);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || !selectedUser || !currentUser) return;

    const chatId = [currentUser.uid, selectedUser.id].sort().join('_');
    const text = inputText;
    setInputText('');

    await addDoc(collection(db, 'chats', chatId, 'messages'), {
      text,
      senderId: currentUser.uid,
      createdAt: serverTimestamp(),
    });
  };

  const spin = radarAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const VideoCallModal = () => (
    <Modal visible={isVideoCalling} animationType="slide">
      <View style={styles.callContainer}>
        <View style={styles.remoteStream}>
          <Image source={{ uri: selectedUser?.avatar }} style={styles.remoteAvatarLarge} blurRadius={10} />
          <View style={styles.remoteInfo}>
            <Image source={{ uri: selectedUser?.avatar }} style={styles.remoteAvatarSmall} />
            <Text style={styles.remoteName}>{selectedUser?.name}</Text>
            <Text style={styles.callStatus}>Connecting...</Text>
          </View>
        </View>
        <View style={styles.localStreamContainer}>
          <CameraView style={styles.localStream} facing="front" />
        </View>
        <View style={styles.callControls}>
          <TouchableOpacity style={[styles.controlBtn, styles.muteBtn]}>
            <FontAwesome name="microphone-slash" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.controlBtn, styles.endCallBtn]} 
            onPress={() => setIsVideoCalling(false)}
          >
            <FontAwesome name="phone" size={30} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.controlBtn, styles.videoOffBtn]}>
            <FontAwesome name="video-camera" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (viewMode === 'chat' && selectedUser) {
    return (
      <View style={styles.container}>
        <View style={styles.chatHeader}>
          <TouchableOpacity onPress={() => setViewMode('radar')} style={styles.backBtn}>
            <FontAwesome name="chevron-left" size={20} color="#FF3B30" />
          </TouchableOpacity>
          <Image source={{ uri: selectedUser.avatar }} style={styles.chatAvatar} />
          <View style={styles.chatTitleContainer}>
            <Text style={styles.chatName}>{selectedUser.name}</Text>
            <Text style={styles.chatStatus}>{selectedUser.distance} away</Text>
          </View>
          <TouchableOpacity onPress={startVideoCall} style={styles.callBtn}>
            <FontAwesome name="video-camera" size={20} color="#FF3B30" />
          </TouchableOpacity>
        </View>

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={[
              styles.messageBubble,
              item.senderId === currentUser?.uid ? styles.myMessage : styles.theirMessage
            ]}>
              <Text style={[
                styles.messageText,
                item.senderId === currentUser?.uid ? styles.myMessageText : styles.theirMessageText
              ]}>{item.text}</Text>
            </View>
          )}
          style={styles.messageList}
          contentContainerStyle={{ padding: 15 }}
        />

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
            <FontAwesome name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        <VideoCallModal />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.radarContainer}>
        <Animated.View style={[styles.radarScan, { transform: [{ rotate: spin }] }]} />
        <View style={styles.radarCircle1} />
        <View style={styles.radarCircle2} />
        <View style={styles.radarCircle3} />
        <Animated.View style={[styles.centerPoint, { transform: [{ scale: pulseAnim }] }]}>
          <FontAwesome name="map-marker" size={30} color="#FF3B30" />
        </Animated.View>
        
        {nearbyUsers.map((user, index) => {
          // Calculate random-looking but stable positions for the radar dots
          const angle = (index * 137.5) % 360;
          const radius = 50 + (index * 20) % 100;
          const x = Math.cos(angle * Math.PI / 180) * radius;
          const y = Math.sin(angle * Math.PI / 180) * radius;

          return (
            <TouchableOpacity 
              key={user.id}
              style={[styles.userDot, { transform: [{ translateX: x }, { translateY: y }] }]}
              onPress={() => handleUserSelect(user)}
            >
              <Image source={{ uri: user.avatar }} style={styles.dotAvatar} />
              <View style={styles.distanceBadge}>
                <Text style={styles.distanceText}>{user.distance}</Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.listContainer}>
        <Text style={styles.listTitle}>People Nearby</Text>
        <FlatList
          data={nearbyUsers}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.userCard} onPress={() => handleUserSelect(item)}>
              <Image source={{ uri: item.avatar }} style={styles.cardAvatar} />
              <View style={styles.cardInfo}>
                <Text style={styles.cardName}>{item.name}</Text>
                <Text style={styles.cardDistance}>{item.distance} away</Text>
              </View>
              <FontAwesome name="chevron-right" size={16} color="#ccc" />
            </TouchableOpacity>
          )}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  radarContainer: {
    height: height * 0.45,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
  },
  radarScan: {
    position: 'absolute',
    width: width * 1.5,
    height: width * 1.5,
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderLeftWidth: 2,
    borderColor: 'rgba(255, 59, 48, 0.5)',
    borderRadius: width * 0.75,
  },
  radarCircle1: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  radarCircle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  radarCircle3: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  centerPoint: {
    zIndex: 10,
  },
  userDot: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 5,
  },
  dotAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  distanceBadge: {
    position: 'absolute',
    bottom: -15,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  distanceText: {
    color: '#fff',
    fontSize: 8,
    fontWeight: 'bold',
  },
  listContainer: {
    flex: 1,
    padding: 20,
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
  },
  listTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#f8f8f8',
    borderRadius: 15,
    marginBottom: 10,
  },
  cardAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 15,
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  cardDistance: {
    fontSize: 14,
    color: '#666',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    paddingTop: Platform.OS === 'ios' ? 50 : 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backBtn: {
    padding: 10,
  },
  chatAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 10,
  },
  chatTitleContainer: {
    flex: 1,
  },
  chatName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  chatStatus: {
    fontSize: 12,
    color: '#666',
  },
  callBtn: {
    padding: 10,
  },
  messageList: {
    flex: 1,
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 20,
    marginBottom: 10,
  },
  myMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#FF3B30',
  },
  theirMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#F0F0F0',
  },
  messageText: {
    fontSize: 16,
  },
  myMessageText: {
    color: '#fff',
  },
  theirMessageText: {
    color: '#000',
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 10,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  callContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  remoteStream: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  remoteAvatarLarge: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  remoteInfo: {
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  remoteAvatarSmall: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#fff',
    marginBottom: 15,
  },
  remoteName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  callStatus: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    marginTop: 5,
  },
  localStreamContainer: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 100,
    height: 150,
    borderRadius: 15,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  localStream: {
    flex: 1,
  },
  callControls: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 40,
    paddingBottom: 60,
    backgroundColor: 'transparent',
  },
  controlBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  muteBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  endCallBtn: {
    backgroundColor: '#FF3B30',
    width: 70,
    height: 70,
    borderRadius: 35,
  },
  videoOffBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
});
