
import { NativeTabs } from 'expo-router/native-tabs';

const COLORS = {
    background: '#fff',
    indicator: '#ffffff',
    text: '#F4F4F6',
    muted: '#ffffff',
    accent: '#ffffff',
};

export default function TabLayout() {
    return (
        <NativeTabs
            backgroundColor={COLORS.background}
            indicatorColor={COLORS.indicator}
            tintColor={COLORS.accent}
            labelStyle={{
                default: {
                    color: COLORS.muted,
                },
                selected: {
                    color: COLORS.text,
                },
            }}
        >
            <NativeTabs.Trigger name="index">
                <NativeTabs.Trigger.Icon
                    sf="house"
                    md="home"
                />
                <NativeTabs.Trigger.Label>
                    首页
                </NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="library">
                <NativeTabs.Trigger.Icon
                    sf="square.stack.3d.up"
                    md="video_library"
                />
                <NativeTabs.Trigger.Label>
                    影视源
                </NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
            <NativeTabs.Trigger name="settings">
                <NativeTabs.Trigger.Icon
                    sf="gearshape"
                    md="settings"
                />
                <NativeTabs.Trigger.Label>
                    设置
                </NativeTabs.Trigger.Label>
            </NativeTabs.Trigger>
        </NativeTabs>
    );
}
