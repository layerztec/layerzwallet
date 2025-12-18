import GradientScreen from '@/components/GradientScreen';
import ScreenHeader from '@/components/navigation/ScreenHeader';
import { ThemedText } from '@/components/ThemedText';
import { NetworkContext } from '@shared/hooks/NetworkContext';
import * as Linking from 'expo-linking';
import React, { useContext, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';
import { FlatList } from '@/components/SafeAreaLists';

const gitCommitHash = require('../git_commit_hash.json');

interface CommitData {
  commit: {
    message: string;
  };
  sha: string;
}

export default function ChangelogScreen() {
  const { network } = useContext(NetworkContext);
  const [commits, setCommits] = useState<CommitData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCommits = async () => {
      if (!gitCommitHash) {
        setError('No commit hash available');
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(`https://api.github.com/repos/layerztec/layerzwallet/commits?sha=${gitCommitHash}&per_page=20`);

        if (!response.ok) {
          throw new Error(`Failed to fetch commits: ${response.status}`);
        }

        const data: CommitData[] = await response.json();

        // Filter out merge commits
        const filteredCommits = data.filter((commit) => {
          const message = commit.commit.message;
          return !message.startsWith('Merge remote-tracking branch') && !message.startsWith('Merge pull request');
        });

        setCommits(filteredCommits);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch commits');
      } finally {
        setLoading(false);
      }
    };

    fetchCommits();
  }, []);

  const openCommitInBrowser = async (sha: string) => {
    const url = `https://github.com/layerztec/layerzwallet/commit/${sha}`;
    await Linking.openURL(url);
  };

  const renderCommitItem = ({ item, index }: { item: CommitData; index: number }) => (
    <TouchableOpacity style={styles.commitItem} onPress={() => openCommitInBrowser(item.sha)}>
      <ThemedText style={styles.commitMessage}>{item.commit.message}</ThemedText>
    </TouchableOpacity>
  );

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <ThemedText style={styles.loadingText}>Loading changelog...</ThemedText>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.centerContainer}>
          <ThemedText style={styles.errorText}>Error: {error}</ThemedText>
        </View>
      );
    }

    if (commits.length === 0) {
      return (
        <View style={styles.centerContainer}>
          <ThemedText style={styles.emptyText}>No commits found</ThemedText>
        </View>
      );
    }

    return (
      <FlatList data={commits} renderItem={renderCommitItem} keyExtractor={(item) => item.sha} style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false} />
    );
  };

  return (
    <GradientScreen variant={network}>
      <ScreenHeader title="Changelog" />

      <View style={styles.container}>{renderContent()}</View>
    </GradientScreen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  errorText: {
    fontSize: 16,
    color: '#FF3B30',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  commitItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
  },
  commitMessage: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    lineHeight: 16,
    margin: 0,
    padding: 0,
  },
});
