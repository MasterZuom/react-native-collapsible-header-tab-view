import React, {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  FlatList,
  InteractionManager,
  LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import PagerView from "react-native-pager-view";

import { CollapsibleContext, TabIndexContext } from "./context";
import {
  CollapsibleContextValue,
  CollapsibleTabViewProps,
  CollapsibleTabViewRef,
  TabBarProps,
} from "./types";

export { TabFlatList } from "./TabFlatList";
export { TabScrollView } from "./TabScrollView";
export type {
  CollapsibleTabViewProps,
  CollapsibleTabViewRef,
  TabBarProps,
} from "./types";

const CollapsibleTabView = forwardRef<
  CollapsibleTabViewRef,
  CollapsibleTabViewProps
>(
  (
    {
      children,
      renderHeader,
      estimatedHeaderHeight = 0,
      estimatedTabBarHeight = 0,
      stickyEnabled = true,
      stickyTop = 0,
      renderTabBar,
      initialTabIndex = 0,
      onTabChange,
      onScroll: onScrollProp,
      swipeEnabled = true,
      style,
    },
    ref,
  ) => {
    const [activeIndex, setActiveIndex] = useState(initialTabIndex);
    const pagerRef = useRef<PagerView>(null);

    const pages = useMemo(
      () => React.Children.toArray(children).filter(React.isValidElement),
      [children],
    );

    useImperativeHandle(ref, () => ({
      scrollToTab: (index: number, animated = true) => {
        if (index === activeIndex || index < 0 || index >= pages.length) return;
        syncTabOnSwitch(index);
        setActiveIndex(index);
        if (animated) {
          pagerRef.current?.setPage(index);
        } else {
          pagerRef.current?.setPageWithoutAnimation(index);
        }
        onTabChange?.(index);
      },
      getActiveIndex: () => activeIndex,
    }));

    // 解决预估高度与实际高度差的问题
    const hasEstimate = estimatedHeaderHeight > 0;
    const headerHeightRef = useRef(0);
    const tabBarHeightRef = useRef(0);
    const [layout, setLayout] = useState({
      headerHeight: estimatedHeaderHeight,
      tabBarHeight: estimatedTabBarHeight,
      ready: hasEstimate,
    });
    const { headerHeight, tabBarHeight } = layout;
    const visible = layout.ready;

    const adjustY = useRef(new Animated.Value(0)).current;

    // 真实高度与预估高度如果存在高度差，则以动画形式让UI组件补偿这个高度差
    const tryCommitLayout = useCallback(() => {
      const h = headerHeightRef.current;
      const t = tabBarHeightRef.current;
      if (h > 0 && t > 0) {
        setLayout((prev) => {
          if (
            Math.abs(prev.headerHeight - h) <= 1 &&
            Math.abs(prev.tabBarHeight - t) <= 1
          ) {
            return prev;
          }
          const diff = h + t - (prev.headerHeight + prev.tabBarHeight);
          if (prev.ready && Math.abs(diff) > 1) {
            adjustY.setValue(-diff);
            Animated.timing(adjustY, {
              toValue: 0,
              duration: 200,
              useNativeDriver: true,
            }).start();
          }
          return { headerHeight: h, tabBarHeight: t, ready: true };
        });
      }
    }, []);

    const handleHeaderLayout = useCallback(
      (e: LayoutChangeEvent) => {
        headerHeightRef.current = e.nativeEvent.layout.height;
        tryCommitLayout();
      },
      [tryCommitLayout],
    );

    const handleTabBarLayout = useCallback(
      (e: LayoutChangeEvent) => {
        tabBarHeightRef.current = e.nativeEvent.layout.height;
        tryCommitLayout();
      },
      [tryCommitLayout],
    );

    const scrollY = useRef(new Animated.Value(0)).current;
    const tabScrollYMap = useRef(new Map<number, number>());
    const tabRefs = useRef(
      new Map<number, FlatList<any> | ScrollView | null>(),
    );
    // header浮层 在Y轴 偏移的最大距离
    const collapseRange = stickyEnabled
      ? Math.max(headerHeight - stickyTop, 0)
      : 0;

    // header浮层 垂直偏移动画值，驱动 header + tabBar 整体上移实现折叠效果。
    const headerTranslateY = useMemo(
      () =>
        collapseRange > 0
          ? scrollY.interpolate({
              inputRange: [0, collapseRange],
              outputRange: [0, -collapseRange],
              extrapolate: "clamp",
            })
          : new Animated.Value(0),
      [scrollY, collapseRange],
    );

    const registerRef = useCallback(
      (index: number, ref: FlatList<any> | ScrollView | null) => {
        if (ref) {
          tabRefs.current.set(index, ref);
        } else {
          tabRefs.current.delete(index);
        }
      },
      [],
    );

    // 记录每个 tab 的当前滚动位置
    const syncScrollY = useCallback(
      (index: number, y: number) => {
        tabScrollYMap.current.set(index, y);
        onScrollProp?.(y);
      },
      [onScrollProp],
    );

    // 切换 tab 时，把新 tab 的 FlatList/ScrollView 滚动到计算好的 targetY，确保 header 吸顶状态和列表位置一致。
    const scrollTabTo = useCallback((index: number, offset: number) => {
      const ref: any = tabRefs.current.get(index);
      if (!ref) return;
      if (ref.scrollToOffset) {
        ref.scrollToOffset({ offset, animated: false });
      } else if (ref.scrollTo) {
        ref.scrollTo({ y: offset, animated: false });
      } else if (ref.getNode) {
        const node = ref.getNode();
        if (node?.scrollToOffset) {
          node.scrollToOffset({ offset, animated: false });
        } else if (node?.scrollTo) {
          node.scrollTo({ y: offset, animated: false });
        }
      }
    }, []);

    //核心代码: 切换Tab时 计算页面滚动的位置
    const syncTabOnSwitch = useCallback(
      (newIndex: number) => {
        // 读取当前 Tab 和目标 Tab 的滚动位置
        const currentY = tabScrollYMap.current.get(activeIndex) ?? 0;
        const newTabSavedY = tabScrollYMap.current.get(newIndex) ?? 0;

        // 判断当前 Tab 的头部是否已折叠
        const isCollapsed = currentY >= collapseRange - 1;

        // 计算目标 Tab 应该滚动到的位置
        let targetY: number;
        if (isCollapsed) {
          targetY = Math.max(newTabSavedY, collapseRange);
        } else {
          targetY = Math.min(currentY, collapseRange);
        }

        // 在交互完成后执行滚动并更新状态
        // runAfterInteractions 会等待所有正在进行的动画和触摸交互完成后再执行回调，确保：
        // 1. 新 Tab 页已经渲染就绪，scrollTo 能生效
        // 2. 不与切换动画争抢帧，体验更流畅
        InteractionManager.runAfterInteractions(() => {
          scrollTabTo(newIndex, targetY);
          tabScrollYMap.current.set(newIndex, targetY);
          scrollY.setValue(Math.min(targetY, collapseRange));
        });
      },
      [activeIndex, collapseRange, scrollTabTo, scrollY],
    );

    const handleTabPress = useCallback(
      (index: number) => {
        if (index === activeIndex) return;
        syncTabOnSwitch(index);
        setActiveIndex(index);
        pagerRef.current?.setPageWithoutAnimation(index);
        onTabChange?.(index);
      },
      [activeIndex, onTabChange, syncTabOnSwitch],
    );

    const handlePageSelected = useCallback(
      (e: { nativeEvent: { position: number } }) => {
        const newIndex = e.nativeEvent.position;
        if (newIndex === activeIndex) return;
        syncTabOnSwitch(newIndex);
        setActiveIndex(newIndex);
        onTabChange?.(newIndex);
      },
      [activeIndex, onTabChange, syncTabOnSwitch],
    );

    const tabBarProps: TabBarProps = useMemo(
      () => ({
        activeIndex,
        onTabPress: handleTabPress,
      }),
      [activeIndex, handleTabPress],
    );

    const renderTabBarNode = useCallback(
      () => renderTabBar(tabBarProps),
      [renderTabBar, tabBarProps],
    );

    const contextValue: CollapsibleContextValue = useMemo(
      () => ({
        scrollY,
        activeIndex,
        stickyEnabled,
        headerHeight,
        tabBarHeight,
        renderHeader: stickyEnabled ? undefined : renderHeader,
        renderTabBar: stickyEnabled ? undefined : renderTabBarNode,
        registerRef,
        syncScrollY,
      }),
      [
        scrollY,
        activeIndex,
        stickyEnabled,
        headerHeight,
        tabBarHeight,
        renderHeader,
        renderTabBarNode,
        registerRef,
        syncScrollY,
      ],
    );

    return (
      <CollapsibleContext.Provider value={contextValue}>
        <View style={[styles.container, style]}>
          <Animated.View
            style={[
              styles.pager,
              !visible && styles.hidden,
              { transform: [{ translateY: adjustY }] },
            ]}
          >
            <PagerView
              ref={pagerRef}
              style={styles.pager}
              initialPage={initialTabIndex}
              onPageSelected={handlePageSelected}
              scrollEnabled={swipeEnabled}
            >
              {pages.map((page: React.ReactElement, i) => (
                <View key={page?.key ?? i} style={styles.page}>
                  <TabIndexContext.Provider value={i}>
                    {page}
                  </TabIndexContext.Provider>
                </View>
              ))}
            </PagerView>
          </Animated.View>

          {stickyEnabled && (
            <Animated.View
              style={[
                styles.overlay,
                { transform: [{ translateY: headerTranslateY }] },
              ]}
              pointerEvents="box-none"
            >
              <View pointerEvents="box-none" onLayout={handleHeaderLayout}>
                {renderHeader()}
              </View>
              <View onLayout={handleTabBarLayout}>{renderTabBarNode()}</View>
            </Animated.View>
          )}
        </View>
      </CollapsibleContext.Provider>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  pager: {
    flex: 1,
  },
  hidden: {
    opacity: 0,
  },
  page: {
    flex: 1,
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
});

export default CollapsibleTabView;
