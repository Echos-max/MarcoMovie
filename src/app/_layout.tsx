/**
 * 全局路由布局
 */
import {DarkTheme, DefaultTheme, router, Stack, ThemeProvider} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import {ChevronLeftIcon, PanelUIProvider} from 'panelui-native';
import { useEffect } from "react";
import "../global.css";
import {useColorScheme, View} from "react-native";
import {  Pressable } from 'react-native';
SplashScreen.preventAutoHideAsync().catch(() => {
  // 避免重复调用时产生未处理异常
});

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);
    const scheme = useColorScheme();
  return (
      <PanelUIProvider>
          <ThemeProvider value={scheme === "dark" ? DarkTheme : DefaultTheme}>
          {/*<StatusBar style="light" />*/}
          <Stack
              screenOptions={{
                headerShown: false,
              }}
          >
            {/* Player screen with landscape orientation */}
            <Stack.Screen
                name="player/[id]"
                options={{ orientation: 'landscape' }}
            />

              <Stack.Screen
                  name="search/[id]"
                  options={{
                      presentation: 'modal',        // 关键：底部弹出
                      animation: 'slide_from_bottom', // 显式声明动画，Android 更稳
                      headerShown: false, // 使用搜索页面自定义顶部栏
                      title: '全局搜索',  // 设置固定的标题
                      headerLeft: () => (
                          <Pressable onPress={() => router.back()}>
                              <View style={{flexDirection:'column',justifyContent:'center',alignItems:'center' }}>
                                  <ChevronLeftIcon size={20} />
                              </View>
                          </Pressable>
                      ),
                  }}
              />
          </Stack>

        </ThemeProvider>
      </PanelUIProvider>
  );
}
