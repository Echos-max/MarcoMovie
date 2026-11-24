import com.github.catvod.DesktopContext;
import com.github.catvod.Proxy;
import com.github.catvod.crawler.Spider;
import com.github.catvod.crawler.SpiderApi;
import java.io.File;
import java.net.URL;
import java.net.URLClassLoader;

public class SearchProbe {
    public static void main(String[] args) throws Exception {
        File runtime = new File(args[0]);
        File jar = new File(args[1]);
        String ext = "https://cz01.vip";

        DesktopContext context = DesktopContext.init(new File(runtime, "data"));
        Proxy.set(9978);

        try (URLClassLoader loader = new URLClassLoader(
                new URL[]{jar.toURI().toURL()},
                SearchProbe.class.getClassLoader())) {

            Class<?> clazz = loader.loadClass("com.github.catvod.spider.Czsapp");
            Spider spider = (Spider) clazz.getDeclaredConstructor().newInstance();
            spider.siteKey = "厂长";
            spider.initApi(new SpiderApi());
            spider.init(context, ext);

            String home = spider.homeContent(true);
            System.out.println("首页字符数：" + (home == null ? 0 : home.length()));
            System.out.println("首页内容：" + preview(home));

            long start = System.currentTimeMillis();
            String result = spider.searchContent("斗破苍穹", false);
            System.out.println("搜索耗时：" + (System.currentTimeMillis() - start) + " ms");
            System.out.println("搜索字符数：" + (result == null ? 0 : result.length()));
            System.out.println("搜索结果：" + preview(result));
        }
    }

    private static String preview(String value) {
        if (value == null) return "null";
        String text = value.replace("\r", " ").replace("\n", " ");
        return text.length() > 1200 ? text.substring(0, 1200) : text;
    }
}