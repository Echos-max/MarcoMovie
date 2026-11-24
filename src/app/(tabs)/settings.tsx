import {Pressable, StyleSheet, Text, View} from "react-native";
import {Item, UploadIcon,ChevronRightIcon} from 'panelui-native';
import { useRouter } from "expo-router";

export default function SettingsScreen(){
  const router = useRouter();
  return(
      <View style={styles.container}>
       <View style={styles.Headers}>
         <Text style={styles.Titles}>设置</Text>
       </View>

        <View style={{width:"100%",marginTop:12,padding:10}}>
          <Item variant="outline">
            <Item.Media variant="icon">
              <UploadIcon size={20} />
            </Item.Media>
            <Item.Content>
              <Item.Title>订阅管理</Item.Title>
              <Item.Description>管理影视订阅、刷新订阅及导入 JSON 文件。</Item.Description>
            </Item.Content>
            <Item.Actions>
              <Pressable
                onPress={() => {
                  router.push('/subscriptions');
                }}
              >
                <ChevronRightIcon size={30} />
              </Pressable>
            </Item.Actions>
          </Item>
        </View>
      </View>
  )
}
const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
  Headers:{
    width: '100%',
    height: '10%',
    flexDirection: 'row',
    justifyContent:'center',
    alignItems:'center',

  },
  Titles:{
    position: 'absolute',
    bottom:0,
    color: 'black',
    fontSize: 30,
    fontWeight: 'bold',
  }
})