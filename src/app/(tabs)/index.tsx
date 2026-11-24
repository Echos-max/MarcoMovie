import React, { useCallback, useEffect, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Carousel } from 'panelui-native';
import {
    View,
    Text,
    Image,
    ScrollView,
    FlatList,
    StyleSheet,
    StatusBar,
    Dimensions,
    Pressable,
    Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';

import {
    getPlaybackHistory,
    removePlaybackRecord,
    clearPlaybackHistory,
    type PlaybackRecord,
} from '@/services/playbackHistory';
import { marcoApi, type LibraryVideo, type SpiderDetail } from '@/services/marcoApi';

const { width } = Dimensions.get('window');


type HeroMovie = LibraryVideo & Partial<SpiderDetail>;

export default function HomeScreen() {
    const [watchingMovies, setWatchingMovies] = useState<PlaybackRecord[]>([]);
    const [popularMovies, setPopularMovies] = useState<HeroMovie[]>([]);
    const [popularLoading, setPopularLoading] = useState(true);
    const [popularError, setPopularError] = useState(false);
    const router = useRouter();

    useFocusEffect(
        useCallback(() => {
            let isActive = true;

            void getPlaybackHistory().then(records => {
                if (isActive) {
                    setWatchingMovies(records);
                }
            });

            return () => {
                isActive = false;
            };
        }, [])
    );

    useEffect(() => {
        let isActive = true;

        const loadPopularMovies = async () => {
            setPopularLoading(true);
            setPopularError(false);

            try {
                const [movieResult, tvResult] = await Promise.all([
                    marcoApi.getLibraryList({
                        category1: '电影',
                        page: 1,
                        pageSize: 8,
                    }),
                    marcoApi.getLibraryList({
                        category1: '电视剧',
                        page: 1,
                        pageSize: 8,
                    }),
                ]);

                if (!isActive) return;

                const uniqueMovies = new Map<string, LibraryVideo>();

                [...movieResult.list, ...tvResult.list].forEach(item => {
                    uniqueMovies.set(`${item.siteKey}-${item.id}`, item);
                });

                const candidates = Array.from(uniqueMovies.values()).slice(0, 12);
                const grouped = new Map<string, LibraryVideo[]>();

                candidates.forEach(item => {
                    const group = grouped.get(item.siteKey) ?? [];
                    group.push(item);
                    grouped.set(item.siteKey, group);
                });

                const detailGroups = await Promise.all(
                    Array.from(grouped.entries()).map(async ([siteKey, items]) => {
                        try {
                            const result = await marcoApi.getSpiderDetail(
                                siteKey,
                                items.map(item => item.id)
                            );
                            return result.list ?? [];
                        } catch (error) {
                            console.warn(`[首页热门影视] ${siteKey} 详情加载失败：`, error);
                            return [];
                        }
                    })
                );

                if (!isActive) return;

                const detailMap = new Map<string, SpiderDetail>();

                detailGroups.flat().forEach(detail => {
                    detailMap.set(String(detail.vod_id), detail);
                });

                const mergedMovies: HeroMovie[] = candidates.map(item => {
                    const detail = detailMap.get(item.id);
                    return detail
                        ? { ...item, ...detail }
                        : { ...item };
                });

                setPopularMovies(mergedMovies);
            } catch (error) {
                console.error('[首页热门影视] 加载失败：', error);

                if (isActive) {
                    setPopularError(true);
                    setPopularMovies([]);
                }
            } finally {
                if (isActive) {
                    setPopularLoading(false);
                }
            }
        };

        void loadPopularMovies();

        return () => {
            isActive = false;
        };
    }, []);
    const handleRemoveRecord = (item: PlaybackRecord) => {
        Alert.alert(
            '删除播放记录',
            `确定删除「${item.movieTitle}」的播放记录吗？`,
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '删除',
                    style: 'destructive',
                    onPress: () => {
                        void removePlaybackRecord(item.movieId, item.siteKey).then(() => {
                            setWatchingMovies(records =>
                                records.filter(
                                    record =>
                                        record.movieId !== item.movieId ||
                                        record.siteKey !== item.siteKey
                                )
                            );
                        });
                    },
                },
            ]
        );
    };

    const handleClearHistory = () => {
        if (watchingMovies.length === 0) return;

        Alert.alert(
            '清空播放记录',
            '确定清空全部播放记录吗？此操作无法撤销。',
            [
                { text: '取消', style: 'cancel' },
                {
                    text: '全部清空',
                    style: 'destructive',
                    onPress: () => {
                        void clearPlaybackHistory().then(() => {
                            setWatchingMovies([]);
                        });
                    },
                },
            ]
        );
    };

    const renderHistoryItem = ({ item }: { item: PlaybackRecord }) => {
        const progress = item.duration > 0
            ? Math.min(100, Math.max(0, (item.currentTime / item.duration) * 100))
            : 0;

        return (
            <View style={styles.historyItem}>
                <Pressable
                    style={styles.historyPressable}
                    onPress={() =>
                        router.push({
                            pathname: '/detail/[id]',
                            params: {
                                id: item.movieId,
                                siteKey: item.siteKey,
                            },
                        })
                    }
                >
                    <View style={styles.historyPosterContainer}>
                        <Image
                            source={{ uri: item.posterUrl }}
                            style={styles.historyPoster}
                            resizeMode="cover"
                        />
                        <View style={styles.progressTrack}>
                            <View
                                style={[
                                    styles.progressFill,
                                    { width: `${progress}%` },
                                ]}
                            />
                        </View>
                    </View>

                    <Text style={styles.historyTitle} numberOfLines={1}>
                        {item.movieTitle}
                    </Text>
                    <Text style={styles.historyEpisode} numberOfLines={1}>
                        {item.episodeTitle || '继续播放'}
                    </Text>
                    <Text style={styles.historyProgress}>
                        已观看 {Math.round(progress)}%
                    </Text>
                </Pressable>

                <Pressable
                    style={styles.removeButton}
                    onPress={() => handleRemoveRecord(item)}
                    hitSlop={8}
                >
                    <Text style={styles.removeButtonText}>×</Text>
                </Pressable>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                   <View style={styles.heroSection}>
                    {popularLoading ? (
                        <View style={styles.popularMessage}>
                            <Text style={styles.messageText}>正在加载影视内容...</Text>
                        </View>
                    ) : popularError ? (
                        <View style={styles.popularMessage}>
                            <Text style={styles.messageText}>
                                影视内容加载失败，请稍后重试
                            </Text>
                        </View>
                    ) : popularMovies.length === 0 ? (
                        <View style={styles.popularMessage}>
                            <Text style={styles.messageText}>暂无影视内容</Text>
                        </View>
                    ) : (
                        <Carousel variant="coverflow" loop autoplay autoplayInterval={4000} itemSize={width - 40}>
    <Carousel.Content style={{ height: 430, borderRadius: 20, }}>
                            {popularMovies.map(item => {
                                const year = item.vod_year || item.year;
                                const area = item.area;
                                const actor = item.vod_actor?.trim();
                                const description = item.vod_content?.trim();
                                const poster = item.pic || item.vod_pic;

                                return (
                                    <Carousel.Item key={`${item.siteKey}-${item.id}`}>
                                        <View style={styles.heroCard}>
                                        {poster ? (
                                            <Image
                                                source={{ uri: poster }}
                                                style={styles.heroImage}
                                                resizeMode="cover"
                                            />
                                        ) : (
                                            <View style={styles.heroImagePlaceholder}>
                                                <Text style={styles.messageText}>
                                                    暂无海报
                                                </Text>
                                            </View>
                                        )}

                                        <LinearGradient
                                            colors={[
                                                'transparent',
                                                'rgba(9,11,16,0.58)',
                                                'rgba(9,11,16,0.98)',
                                            ]}
                                            locations={[0, 0.42, 1]}
                                            style={styles.heroGradient}
                                        >
                                            <View style={styles.heroInfo}>
                                                <View style={styles.heroBadgeRow}>
                                                    <View style={styles.heroBadge}>
                                                        <Text style={styles.heroBadgeText}>
                                                            {item.category1 || '影视'}
                                                        </Text>
                                                    </View>
                                                    {!!year && (
                                                        <Text style={styles.heroMeta}>
                                                            {year}
                                                        </Text>
                                                    )}
                                                    {!!area && (
                                                        <Text style={styles.heroMeta}>
                                                            {area}
                                                        </Text>
                                                    )}
                                                </View>

                                                <Text
                                                    style={styles.heroMovieTitle}
                                                    numberOfLines={2}
                                                >
                                                    {item.name}
                                                </Text>

                                                {!!actor && (
                                                    <Text
                                                        style={styles.heroActor}
                                                        numberOfLines={1}
                                                    >
                                                        主演：{actor}
                                                    </Text>
                                                )}

                                                {!!description && (
                                                    <Text
                                                        style={styles.heroDescription}
                                                        numberOfLines={3}
                                                    >
                                                        {description}
                                                    </Text>
                                                )}

                                                {!description && !!item.remarks && (
                                                    <Text
                                                        style={styles.heroDescription}
                                                        numberOfLines={1}
                                                    >
                                                        {item.remarks}
                                                    </Text>
                                                )}
                                            </View>
</LinearGradient>
                                    </View>
                                    </Carousel.Item>
                                );
                            })}
                        </Carousel.Content>
                    <Carousel.Dots className="mt-3 self-center" />
                </Carousel>
                    )}
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View>
                            <Text style={styles.sectionTitle}>继续观看</Text>
                        </View>

                        {watchingMovies.length > 0 && (
                            <Pressable
                                onPress={handleClearHistory}
                                hitSlop={10}
                                style={styles.clearButton}
                            >
                                <Text style={styles.clearButtonText}>清空</Text>
                            </Pressable>
                        )}
                    </View>

                    <FlatList
                        data={watchingMovies}
                        renderItem={renderHistoryItem}
                        keyExtractor={item => `${item.siteKey}-${item.movieId}`}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.historyList}
                        ListEmptyComponent={
                            <View style={styles.emptyHistory}>
                                <Text style={styles.emptyHistoryText}>
                                    暂无播放记录
                                </Text>
                                <Text style={styles.emptyHistoryHint}>
                                    播放影片后，会在这里显示观看进度
                                </Text>
                            </View>
                        }
                    />
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: 58,
        paddingBottom: 40,
    },
    section: {
        marginBottom: 34,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        marginBottom: 18,
    },
    sectionTitle: {
        color: '#3f3f3f',
        fontSize: 22,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    sectionSubtitle: {
        color: 'rgb(46 46 46 / 0.48)',
        fontSize: 12,
        marginTop: 6,
    },
    clearButton: {
        paddingHorizontal: 13,
        paddingVertical: 7,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.09)',
    },
    clearButtonText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        fontWeight: '600',
    },
    historyList: {
        paddingHorizontal: 20,
        gap: 14,
    },
    historyItem: {
        width: 116,
        position: 'relative',
    },
    historyPressable: {
        width: '100%',
    },
    historyPosterContainer: {
        width: 116,
        height: 164,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: '#1B1E26',
    },
    historyPoster: {
        width: '100%',
        height: '100%',
    },
    progressTrack: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 4,
        backgroundColor: 'rgba(0,0,0,0.65)',
    },
    progressFill: {
        height: 4,
        backgroundColor: '#E50914',
    },
    historyTitle: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600',
        marginTop: 9,
    },
    historyEpisode: {
        color: 'rgba(255,255,255,0.58)',
        fontSize: 11,
        marginTop: 4,
    },
    historyProgress: {
        color: 'rgba(255,255,255,0.42)',
        fontSize: 10,
        marginTop: 4,
    },
    removeButton: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 25,
        height: 25,
        borderRadius: 13,
        backgroundColor: 'rgba(0,0,0,0.72)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    removeButtonText: {
        color: '#FFFFFF',
        fontSize: 20,
        lineHeight: 23,
        fontWeight: '600',
    },
    emptyHistory: {
        width: width - 40,
        minHeight: 104,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.045)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 18,
    },
    emptyHistoryText: {
        color: 'rgba(255,255,255,0.78)',
        fontSize: 14,
        fontWeight: '600',
    },
    emptyHistoryHint: {
        color: 'rgba(255,255,255,0.38)',
        fontSize: 11,
        marginTop: 7,
    },
    heroSection: {
        marginBottom: 32,
    },
    heroHeader: {
        paddingHorizontal: 20,
        marginBottom: 16,
    },
    heroSectionTitle: {
        color: '#FFFFFF',
        fontSize: 22,
        fontWeight: '700',
        letterSpacing: 0.3,
    },
    heroSectionSubtitle: {
        color: 'rgba(255,255,255,0.48)',
        fontSize: 12,
        marginTop: 6,
    },
    heroCard: {
        width: width - 40,
        height: 430,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#1B1E26',
    },
    heroImage: {
        width: '100%',
        height: '100%',
        position: 'absolute',
    },
    heroImagePlaceholder: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroGradient: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    heroInfo: {
        paddingHorizontal: 20,
        paddingBottom: 22,
    },
    heroBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 9,
        marginBottom: 10,
    },
    heroBadge: {
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: '#E50914',
    },
    heroBadgeText: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
    },
    heroMeta: {
        color: 'rgba(255,255,255,0.72)',
        fontSize: 11,
    },
    heroMovieTitle: {
        color: '#FFFFFF',
        fontSize: 25,
        lineHeight: 32,
        fontWeight: '800',
        marginBottom: 8,
    },
    heroActor: {
        color: 'rgba(255,255,255,0.72)',
        fontSize: 11,
        marginBottom: 7,
    },
    heroDescription: {
        color: 'rgba(255,255,255,0.68)',
        fontSize: 11,
        lineHeight: 18,
    },    popularMessage: {
        minHeight: 110,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 20,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.045)',
    },
    messageText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
    },
});
