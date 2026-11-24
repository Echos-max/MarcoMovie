import React, { useState } from 'react';
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
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { marcoApi } from '../../services/marcoApi';

export default function AddSubscriptionScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedFileUri, setSelectedFileUri] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState('');

  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'application/json',
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.canceled) return;

      const asset = result.assets[0];
      if (!asset) {
        Alert.alert('选择失败', '没有获取到文件。');
        return;
      }

      if (!asset.name.toLowerCase().endsWith('.json')) {
        Alert.alert('文件格式错误', '请选择 .json 格式的订阅文件。');
        return;
      }

      const fileName = asset.name.replace(/\.json$/i, '');
      setSelectedFileUri(asset.uri);
      setSelectedFileName(asset.name);
      setName(fileName.slice(0, 100));
    } catch (e) {
      Alert.alert(
        '选择失败',
        e instanceof Error ? e.message : '选择 JSON 文件时发生错误。'
      );
    }
  };

  const handleImportFile = async () => {
    const trimmedName = name.trim();

    if (!selectedFileUri) {
      Alert.alert('提示', '请先选择 JSON 文件。');
      return;
    }

    if (!trimmedName) {
      Alert.alert('提示', '请输入订阅名称。');
      return;
    }

    if (saving) return;

    setSaving(true);

    try {
      const file = new File(selectedFileUri);

      if (file.size > 2 * 1024 * 1024) {
        throw new Error('文件不能超过 2 MB。');
      }

      const fileText = await file.text();
      const config: unknown = JSON.parse(fileText);

      if (
        !config ||
        typeof config !== 'object' ||
        Array.isArray(config) ||
        !Array.isArray((config as Record<string, unknown>).sites)
      ) {
        throw new Error('JSON 格式不正确，缺少有效的 sites 数组。');
      }

      await marcoApi.importSubscription(
        trimmedName,
        config as Record<string, unknown>
      );

      Alert.alert('导入成功', '本地 JSON 订阅已导入。', [
        {
          text: '确定',
          onPress: () => router.back(),
        },
      ]);
    } catch (e) {
      Alert.alert(
        '导入失败',
        e instanceof Error ? e.message : '导入本地 JSON 订阅时发生错误。'
      );
    } finally {
      setSaving(false);
    }
  };

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

    if (saving) return;

    setSaving(true);

    try {
      await marcoApi.addSubscription(trimmedName, trimmedUrl);
      Alert.alert('添加成功', '订阅已添加，可以返回列表刷新订阅。', [
        {
          text: '确定',
          onPress: () => router.back(),
        },
      ]);
    } catch (e) {
      Alert.alert(
        '添加失败',
        e instanceof Error ? e.message : '添加订阅时发生错误。'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.content}>
        <Text style={styles.title}>添加订阅</Text>
        <Text style={styles.description}>
          填写订阅名称，并选择本地 JSON 文件或输入远程订阅地址。
        </Text>

        <Text style={styles.label}>订阅名称</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="例如：我的影视订阅"
          placeholderTextColor="#A3A3A3"
          style={styles.input}
          maxLength={100}
        />

        <Text style={styles.label}>本地 JSON 文件</Text>
        <Pressable
          style={styles.fileButton}
          disabled={saving}
          onPress={handlePickFile}
        >
          <Text style={styles.fileButtonText}>
            {selectedFileUri ? '重新选择 JSON 文件' : '选择 JSON 文件'}
          </Text>
        </Pressable>

        {!!selectedFileName && (
          <Text style={styles.fileName}>
            已选择：{selectedFileName}
          </Text>
        )}

        <Pressable
          style={[styles.submitButton, saving && styles.disabledButton]}
          disabled={saving || !selectedFileUri}
          onPress={handleImportFile}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>导入本地 JSON</Text>
          )}
        </Pressable>

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

        <Text style={styles.tip}>
          支持导入本地 .json 文件，也支持通过 HTTP/HTTPS 地址添加远程订阅。
        </Text>

        <Pressable
          style={[styles.submitButton, saving && styles.disabledButton]}
          disabled={saving}
          onPress={handleSubmit}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.submitText}>添加订阅</Text>
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
  fileButton: {
    height: 46,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D4D4D4',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  fileButtonText: {
    color: '#404040',
    fontSize: 13,
    fontWeight: '600',
  },
  fileName: {
    color: '#737373',
    fontSize: 12,
    marginBottom: 22,
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
  tip: {
    color: '#8A8A8A',
    fontSize: 11,
    lineHeight: 18,
    marginTop: -10,
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
});