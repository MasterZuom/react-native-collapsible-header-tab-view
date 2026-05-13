# react-native-collapsible-header-tab-view

> 不依赖 react-native-reanimated，可吸顶的 tab view 组件

[![license](https://img.shields.io/badge/license-MIT-green.svg)](https://github.com/zuom/react-native-collapsible-header-tab-view/blob/master/LICENSE)

## 特性

✨ **轻量级** - 不依赖 react-native-reanimated  
🎯 **高性能** - 优化的滚动性能  
📱 **吸顶效果** - 完整的粘性头部和标签栏支持  
🔄 **灵活** - 支持 FlatList 和 ScrollView  
⚡ **TypeScript** - 完整的类型支持  

## 安装

```bash
npm install react-native-collapsible-header-tab-view
# or
yarn add react-native-collapsible-header-tab-view
```

### 依赖

```bash
npm install react-native-pager-view ahooks
```

## 使用

### 基础示例

```jsx
import { CollapsibleTabView, TabFlatList } from 'react-native-collapsible-header-tab-view';

export function App() {
  return (
    <CollapsibleTabView
      renderHeader={() => <HeaderComponent />}
      renderTabBar={(props) => <TabBarComponent {...props} />}
    >
      <TabFlatList
        index={0}
        data={data1}
        renderItem={({ item }) => <ItemComponent item={item} />}
        keyExtractor={(item) => item.id}
      />
      <TabFlatList
        index={1}
        data={data2}
        renderItem={({ item }) => <ItemComponent item={item} />}
        keyExtractor={(item) => item.id}
      />
    </CollapsibleTabView>
  );
}
```

## Props

### CollapsibleTabView

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| renderHeader | `() => ReactNode` | 必需 | 头部组件 |
| renderTabBar | `(props: TabBarProps) => ReactNode` | 必需 | 标签栏组件 |
| estimatedHeaderHeight | `number` | 0 | 预估头部高度 |
| estimatedTabBarHeight | `number` | 0 | 预估标签栏高度 |
| stickyEnabled | `boolean` | true | 是否启用吸顶效果 |
| stickyTop | `number` | 0 | 吸顶距离顶部的距离 |
| swipeEnabled | `boolean` | true | 是否启用滑动切换 |
| initialTabIndex | `number` | 0 | 初始标签页索引 |
| onTabChange | `(index: number) => void` | - | 标签页切换回调 |
| onScroll | `(scrollY: number) => void` | - | 滚动回调 |
| style | `StyleProp<ViewStyle>` | - | 容器样式 |

### TabFlatList

| 属性 | 类型 | 说明 |
|------|------|------|
| index | `number` | 必需，标签页索引 |
| data | `T[]` | 列表数据 |
| renderItem | `(info: { item: T, index: number }) => ReactNode` | 列表项渲染函数 |
| keyExtractor | `(item: T, index: number) => string` | 列表项 key |

## Ref Methods

```typescript
interface CollapsibleTabViewRef {
  scrollToTab(index: number, animated?: boolean): void;
  getActiveIndex(): number;
}
```

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request!

## 作者

- GitHub: [@zuom](https://github.com/zuom)
