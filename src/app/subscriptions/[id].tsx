import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { marcoApi } from '../../services/marcoApi';

export default function EditSubscriptionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id;

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let active = true;

    const loadSubscription = async () => {
      try {
        setLoadError('');
        const result = await marcoApi.getSubscriptions();
        const subscription = result.subscriptions.find(item => item.id === id);

        if (!subscription) {
          throw new Error('没有找到该订阅，可能已被删除。');
        }

        if (active) {
          setName(subscription.name);
          setUrl(subscription.url);
        }
      } catch (e) {
        if (active) {
          setLoadError(
            e instanceof Error ? e.message : '加载订阅信息失败。'
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    if (id) {
      loadSubscription();
    } else {
      setLoadError('订阅 ID 无效。');
      setLoading(false);
    }

    return () => {
      active = false;
    };
  }, [id]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();

    if (!trimmedName) {
      Alert.alert('提示', '请输入订阅名称。');
      return;
    }

    if (!/^https?:\/\/\S+$/i.test(trimmedUrl)) {
      Alert.alert('提示', '请输入有效的 HTTP 或 HTTPS 订阅地址。');
      return;
    }

    if (saving || !id) return;

    setSaving(true);

    try {
      await marcoApi.updateSubscription(id, trimmedName, trimmedUrl);
      Alert.alert('保存成功', '订阅信息已更新。', [
        {
          text: '确定',
          onPress: () => router.back(),
        },
      ]);
    } catch (e) {
      Alert.alert(
        '保存失败',
        e instanceof Error ? e.message : '更新订阅时发生错误。'
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={styles.hint}>正在加载订阅信息...</Text>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{loadError}</Text>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.submitText}>返回</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>编辑订阅</Text>
        <Text style={styles.description}>
          修改订阅名称或订阅地址。保存后不会自动刷新订阅内容。
        </Text>

        <Text style={styles.label}>订阅名称</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="请输入订阅名称"
          placeholderTextColor="#A3A3A3"
          style={styles.input}
          maxLength={100}
        />

        <Text style={styles.label}>订阅地址</Text>
        <TextInput
          value={url}
          onChangeText={setUrl}
          placeholder="https://example.com/subscribe.json"
          placeholderTextColor="#A3A3A3"
          style={[styles.input, styles.urlInput]}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
        />

        <Pressable
          style={[styles.submitButton, saving && styles.disabledButton]}
          disabled={saving}
          onPress={handleSubmit}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>保存修改</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F8',
  },
  content: {
    padding: 20,
  },
  center: {
    flex: 1,
    backgroundColor: '#F7F7F8',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#171717',
    fontSize: 22,
    fontWeight: '700',
  },
  description: {
    color: '#737373',
    fontSize: 13,
    lineHeight: 21,
    marginTop: 9,
    marginBottom: 28,
  },
  label: {
    color: '#404040',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 9,
  },
  input: {
    height: 46,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 13,
    color: '#262626',
    fontSize: 13,
    marginBottom: 22,
  },
  urlInput: {
    height: 50,
  },
  submitButton: {
    height: 46,
    borderRadius: 10,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 28,
  },
  disabledButton: {
    opacity: 0.6,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  hint: {
    color: '#8A8A8A',
    fontSize: 13,
    marginTop: 10,
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 13,
    textAlign: 'center',
  },
  backButton: {
    height: 42,
    minWidth: 100,
    borderRadius: 9,
    backgroundColor: '#171717',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 18,
  },
});