import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  ScrollViewProps,
  View,
} from "react-native";

import { useCollapsible, useTabIndex } from "./context";

export type TabScrollViewProps = Omit<ScrollViewProps, "onScroll"> & {
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
};

const TabScrollView = forwardRef<ScrollView, TabScrollViewProps>(
  ({ contentContainerStyle, onScroll, children, ...props }, ref) => {
    const index = useTabIndex();
    const {
      scrollY,
      activeIndex,
      stickyEnabled,
      headerHeight,
      tabBarHeight,
      renderHeader,
      renderTabBar,
      registerRef,
      syncScrollY,
    } = useCollapsible();

    const innerRef = useRef<ScrollView>(null);
    const isActive = activeIndex === index;

    useEffect(() => {
      registerRef(index, innerRef.current);
      return () => registerRef(index, null);
    }, [index]);

    useImperativeHandle(ref, () => innerRef.current!, []);

    const handleScroll = useCallback(
      (e: NativeSyntheticEvent<NativeScrollEvent>) => {
        const y = e.nativeEvent.contentOffset.y;
        syncScrollY(index, y);
        onScroll?.(e);
      },
      [index, onScroll, syncScrollY],
    );

    const mergedChildren = useMemo(() => {
      if (stickyEnabled) return children;
      return (
        <View>
          {renderHeader?.()}
          {renderTabBar?.()}
          {children}
        </View>
      );
    }, [stickyEnabled, children, renderHeader, renderTabBar]);

    const paddingTop = stickyEnabled ? headerHeight + tabBarHeight : 0;
    const collapseRange = stickyEnabled ? headerHeight : 0;
    const [containerHeight, setContainerHeight] = useState(0);

    const handleLayout = useCallback((e: LayoutChangeEvent) => {
      setContainerHeight(e.nativeEvent.layout.height);
    }, []);

    const minHeight = containerHeight > 0 ? containerHeight + collapseRange : 0;

    return (
      <Animated.ScrollView
        ref={innerRef}
        {...props}
        onLayout={handleLayout}
        contentContainerStyle={[
          paddingTop > 0 && { paddingTop },
          minHeight > 0 && { minHeight },
          contentContainerStyle,
        ]}
        onScroll={
          isActive && stickyEnabled
            ? Animated.event(
                [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                {
                  useNativeDriver: true,
                  listener: handleScroll,
                },
              )
            : handleScroll
        }
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {mergedChildren}
      </Animated.ScrollView>
    );
  },
);

export { TabScrollView };
