import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@marcomovie/playback-history';
const MAX_RECORDS = 50;

export type PlaybackRecord = {
    movieId: string;
    siteKey: string;
    sourceName?: string;
    movieTitle: string;
    posterUrl: string;
    episodeIndex: number;
    episodeTitle: string;
    currentTime: number;
    duration: number;
    updatedAt: number;
};

export async function getPlaybackHistory(): Promise<PlaybackRecord[]> {
    try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);

        if (!raw) return [];

        const parsed: unknown = JSON.parse(raw);

        if (!Array.isArray(parsed)) return [];

        return parsed.filter(
            (item): item is PlaybackRecord =>
                item !== null &&
                typeof item === 'object' &&
                typeof item.movieId === 'string' &&
                typeof item.siteKey === 'string'
        );
    } catch (error) {
        console.warn('[播放记录] 读取失败', error);
        return [];
    }
}

export async function savePlaybackRecord(
    record: PlaybackRecord
): Promise<void> {
    try {
        const records = await getPlaybackHistory();

        const filtered = records.filter(
            item =>
                item.movieId !== record.movieId ||
                item.siteKey !== record.siteKey
        );

        const nextRecords = [
            { ...record, updatedAt: Date.now() },
            ...filtered,
        ].slice(0, MAX_RECORDS);

        await AsyncStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(nextRecords)
        );
    } catch (error) {
        console.warn('[播放记录] 保存失败', error);
    }
}

export async function removePlaybackRecord(
    movieId: string,
    siteKey: string
): Promise<void> {
    try {
        const records = await getPlaybackHistory();

        const nextRecords = records.filter(
            item =>
                item.movieId !== movieId ||
                item.siteKey !== siteKey
        );

        await AsyncStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(nextRecords)
        );
    } catch (error) {
        console.warn('[播放记录] 删除失败', error);
    }
}



export async function clearPlaybackHistory(): Promise<void> {
    try {
        await AsyncStorage.removeItem(STORAGE_KEY);
    } catch (error) {
        console.warn('[播放记录] 清空失败', error);
    }
}