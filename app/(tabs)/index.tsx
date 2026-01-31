import { useAuth } from '@/components/AuthContext';
import { Text, View } from '@/components/Themed';
import { FontAwesome } from '@expo/vector-icons';
import {
    addDoc,
    arrayRemove,
    arrayUnion,
    collection,
    doc,
    limit,
    onSnapshot,
    orderBy,
    query,
    serverTimestamp,
    updateDoc
} from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { db } from '../../lib/firebase';

interface Post {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  content: string;
  image?: string;
  likes: number;
  likedBy: string[];
  commentsCount: number;
  time: any;
}

interface Comment {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  time: any;
}

export default function FeedScreen() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isCommentModalVisible, setIsCommentModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [newPostContent, setNewPostContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const q = query(
      collection(db, 'posts'),
      orderBy('time', 'desc'),
      limit(20)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const feedPosts: Post[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        feedPosts.push({
          id: doc.id,
          userId: data.userId,
          userName: data.userName || 'Anonymous',
          userAvatar: data.userAvatar || `https://i.pravatar.cc/150?u=${data.userName}`,
          content: data.content,
          image: data.image,
          likes: data.likedBy?.length || 0,
          likedBy: data.likedBy || [],
          commentsCount: data.commentsCount || 0,
          time: data.time?.toDate?.()?.toLocaleDateString() || 'Just now',
        });
      });
      setPosts(feedPosts);
      setLoading(false);
    }, (error) => {
      console.error("Feed error:", error);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Listen for comments when a post is selected
  useEffect(() => {
    if (!selectedPost) {
      setComments([]);
      return;
    }

    const q = query(
      collection(db, 'posts', selectedPost.id, 'comments'),
      orderBy('time', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const postComments: Comment[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        postComments.push({
          id: doc.id,
          userId: data.userId,
          userName: data.userName || 'User',
          userAvatar: data.userAvatar || `https://i.pravatar.cc/150?u=${data.userId}`,
          text: data.text,
          time: data.time?.toDate?.()?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) || 'Just now',
        });
      });
      setComments(postComments);
    });

    return unsubscribe;
  }, [selectedPost]);

  const handleLike = async (post: Post) => {
    if (!user) return;
    
    const postRef = doc(db, 'posts', post.id);
    const isLiked = post.likedBy.includes(user.uid);

    try {
      await updateDoc(postRef, {
        likedBy: isLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
    } catch (error) {
      console.error("Error liking post:", error);
    }
  };

  const handleAddComment = async () => {
    if (!newCommentText.trim() || !selectedPost || !user) return;

    const postRef = doc(db, 'posts', selectedPost.id);
    const commentData = {
      userId: user.uid,
      userName: user.name,
      userAvatar: `https://i.pravatar.cc/150?u=${user.uid}`,
      text: newCommentText.trim(),
      time: serverTimestamp(),
    };

    try {
      await addDoc(collection(db, 'posts', selectedPost.id, 'comments'), commentData);
      await updateDoc(postRef, {
        commentsCount: (selectedPost.commentsCount || 0) + 1
      });
      setNewCommentText('');
    } catch (error) {
      console.error("Error adding comment:", error);
      Alert.alert('Error', 'Failed to add comment');
    }
  };

  const handleCreatePost = async () => {
    if (!newPostContent.trim()) {
      Alert.alert('Empty Post', 'Please write something before sharing!');
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'posts'), {
        userId: user?.uid,
        userName: user?.name,
        userAvatar: `https://i.pravatar.cc/150?u=${user?.uid}`,
        content: newPostContent.trim(),
        likedBy: [],
        commentsCount: 0,
        time: serverTimestamp(),
      });
      
      setNewPostContent('');
      setIsModalVisible(false);
    } catch (error) {
      console.error('Error creating post:', error);
      Alert.alert('Error', 'Failed to share post. Try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openComments = (post: Post) => {
    setSelectedPost(post);
    setIsCommentModalVisible(true);
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>Explore</Text>
      <View style={styles.headerIcons}>
        <TouchableOpacity style={styles.iconBtn}>
          <FontAwesome name="search" size={20} color="#333" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn}>
          <FontAwesome name="bell-o" size={20} color="#333" />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderPost = ({ item }: { item: Post }) => {
    const isLiked = user ? item.likedBy.includes(user.uid) : false;

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <Image source={{ uri: item.userAvatar }} style={styles.avatar} />
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.userName}</Text>
            <Text style={styles.postTime}>{item.time}</Text>
          </View>
          <TouchableOpacity>
            <FontAwesome name="ellipsis-h" size={16} color="#ccc" />
          </TouchableOpacity>
        </View>
        
        <Text style={styles.postContent}>{item.content}</Text>
        
        {item.image && (
          <Image source={{ uri: item.image }} style={styles.postImage} resizeMode="cover" />
        )}
        
        <View style={styles.postFooter}>
          <TouchableOpacity 
            style={styles.footerAction} 
            onPress={() => handleLike(item)}
          >
            <FontAwesome 
              name={isLiked ? "heart" : "heart-o"} 
              size={20} 
              color={isLiked ? "#FF3B30" : "#666"} 
            />
            <Text style={[styles.actionText, isLiked && { color: '#FF3B30' }]}>
              {item.likes}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.footerAction} 
            onPress={() => openComments(item)}
          >
            <FontAwesome name="comment-o" size={20} color="#666" />
            <Text style={styles.actionText}>{item.commentsCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.footerAction}>
            <FontAwesome name="share-square-o" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF3B30" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={posts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={() => (
          <View style={styles.emptyContainer}>
            <FontAwesome name="feed" size={50} color="#eee" />
            <Text style={styles.emptyText}>No posts yet. Be the first!</Text>
          </View>
        )}
      />
      
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => setIsModalVisible(true)}
      >
        <FontAwesome name="pencil" size={24} color="#fff" />
      </TouchableOpacity>

      <Modal
        visible={isModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>New Post</Text>
              <TouchableOpacity 
                onPress={handleCreatePost}
                disabled={isSubmitting || !newPostContent.trim()}
              >
                <Text style={[
                  styles.postBtnText, 
                  (!newPostContent.trim() || isSubmitting) && styles.postBtnDisabled
                ]}>
                  Post
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.inputContainer}>
              <Image 
                source={{ uri: `https://i.pravatar.cc/150?u=${user?.uid}` }} 
                style={styles.smallAvatar} 
              />
              <TextInput
                style={styles.textInput}
                placeholder="What's happening nearby?"
                placeholderTextColor="#999"
                multiline
                autoFocus
                value={newPostContent}
                onChangeText={setNewPostContent}
                maxLength={280}
              />
            </View>

            {isSubmitting && (
              <View style={styles.submittingOverlay}>
                <ActivityIndicator color="#FF3B30" />
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={isCommentModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsCommentModalVisible(false)}
      >
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { minHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setIsCommentModalVisible(false)}>
                <FontAwesome name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Comments</Text>
              <View style={{ width: 20 }} />
            </View>

            <FlatList
              data={comments}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <View style={styles.commentItem}>
                  <Image source={{ uri: item.userAvatar }} style={styles.commentAvatar} />
                  <View style={styles.commentContent}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentUser}>{item.userName}</Text>
                      <Text style={styles.commentTime}>{item.time}</Text>
                    </View>
                    <Text style={styles.commentText}>{item.text}</Text>
                  </View>
                </View>
              )}
              ListEmptyComponent={() => (
                <View style={styles.emptyComments}>
                  <Text style={styles.emptyCommentsText}>No comments yet. Say something!</Text>
                </View>
              )}
              style={{ flex: 1 }}
            />

            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                value={newCommentText}
                onChangeText={setNewCommentText}
                multiline
              />
              <TouchableOpacity 
                style={[styles.commentSendBtn, !newCommentText.trim() && { opacity: 0.5 }]}
                onPress={handleAddComment}
                disabled={!newCommentText.trim()}
              >
                <FontAwesome name="send" size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  headerIcons: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  iconBtn: {
    marginLeft: 15,
    padding: 5,
  },
  postCard: {
    backgroundColor: '#fff',
    marginHorizontal: 15,
    marginTop: 15,
    borderRadius: 15,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'transparent',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  userInfo: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  userName: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  postTime: {
    fontSize: 12,
    color: '#999',
  },
  postContent: {
    fontSize: 15,
    lineHeight: 22,
    color: '#333',
    marginBottom: 12,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 10,
    marginBottom: 12,
  },
  postFooter: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
    backgroundColor: 'transparent',
  },
  footerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 25,
    backgroundColor: 'transparent',
  },
  actionText: {
    marginLeft: 6,
    color: '#666',
    fontSize: 14,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 100,
    backgroundColor: 'transparent',
  },
  emptyText: {
    marginTop: 20,
    color: '#999',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    minHeight: '60%',
    padding: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  cancelText: {
    color: '#666',
    fontSize: 16,
  },
  postBtnText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: 'bold',
  },
  postBtnDisabled: {
    color: '#ccc',
  },
  inputContainer: {
    flexDirection: 'row',
    backgroundColor: 'transparent',
  },
  smallAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 18,
    color: '#333',
    paddingTop: 8,
    textAlignVertical: 'top',
  },
  submittingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: 'transparent',
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 10,
  },
  commentContent: {
    flex: 1,
    backgroundColor: '#f8f8f8',
    padding: 10,
    borderRadius: 12,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    backgroundColor: 'transparent',
  },
  commentUser: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  commentTime: {
    fontSize: 10,
    color: '#999',
  },
  commentText: {
    fontSize: 14,
    color: '#333',
  },
  emptyComments: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  emptyCommentsText: {
    color: '#999',
    fontSize: 14,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  commentInput: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginRight: 10,
    fontSize: 14,
    maxHeight: 80,
  },
  commentSendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FF3B30',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
