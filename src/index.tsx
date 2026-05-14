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
    }, [adjustY]);

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
    // 调用原生组件的 scrollToOffset/scrollTo 直接走 Native 侧，不经过 JS 动画帧调度
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

    // (点击切换) 在 Tab 切换完成时同步目标页面的滚动位置
    const syncTabOnSwitch = useCallback((newIndex: number) => {
      // 读取当前 Tab 和目标 Tab 的滚动位置
      const currentY = tabScrollYMap.current.get(activeIndex) ?? 0;
      const newTabSavedY = tabScrollYMap.current.get(newIndex) ?? 0;

      // 判断当前 Tab 的头部是否已折叠
      const isCollapsed = currentY >= collapseRange - 1;

      // 计算目标 Tab 应该滚动到的位置
      const targetY = isCollapsed
        ? Math.max(newTabSavedY, collapseRange)
        : Math.min(currentY, collapseRange);

      // 执行滚动并更新状态
      scrollTabTo(newIndex, targetY);
      tabScrollYMap.current.set(newIndex, targetY);
      scrollY.setValue(Math.min(targetY, collapseRange));
    }, []);

    // （拖拽切换）在用户开始拖拽时，立即将相邻 Tab（±1）的滚动位置同步到正确值
    const preSyncAdjacentTabs = useCallback(() => {
      const currentY = tabScrollYMap.current.get(activeIndex) ?? 0;
      const isCollapsed = currentY >= collapseRange - 1;

      for (const i of [activeIndex - 1, activeIndex + 1]) {
        if (i < 0 || i >= pages.length) continue;
        const savedY = tabScrollYMap.current.get(i) ?? 0;
        const targetY = isCollapsed
          ? Math.max(savedY, collapseRange)
          : Math.min(currentY, collapseRange);
        scrollTabTo(i, targetY);
        tabScrollYMap.current.set(i, targetY);
      }
    }, [activeIndex, collapseRange, pages.length, scrollTabTo]);

    const handlePageScrollStateChanged = useCallback(
      (e: { nativeEvent: { pageScrollState: string } }) => {
        if (e.nativeEvent.pageScrollState === "dragging") {
          preSyncAdjacentTabs();
        }
      },
      [preSyncAdjacentTabs],
    );

    const handleTabPress = useCallback(
      (index: number) => {
        if (index === activeIndex) return;
        syncTabOnSwitch(index);
        setActiveIndex(index);
        pagerRef.current?.setPageWithoutAnimation(index);
        onTabChange?.(index);
      },
      [activeIndex, syncTabOnSwitch, onTabChange],
    );

    const handlePageSelected = useCallback(
      (e: { nativeEvent: { position: number } }) => {
        const newIndex = e.nativeEvent.position;
        if (newIndex === activeIndex) return;
        const savedY = tabScrollYMap.current.get(newIndex) ?? 0;
        scrollY.setValue(Math.min(savedY, collapseRange));
        setActiveIndex(newIndex);
        onTabChange?.(newIndex);
      },
      [activeIndex, collapseRange, scrollY, onTabChange],
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
              onPageScrollStateChanged={handlePageScrollStateChanged}
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
