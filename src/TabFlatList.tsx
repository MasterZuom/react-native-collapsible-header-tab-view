import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState
} from "react"
import {
  Animated,
  FlatList,
  FlatListProps,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  View
} from "react-native"

import { useCollapsible, useTabIndex } from "./context"

type AnimatedFlatListProps<T> = Animated.AnimatedProps<FlatListProps<T>>
const AnimatedFlatListComponent = Animated.createAnimatedComponent(FlatList)
const AnimatedFlatList = AnimatedFlatListComponent as <T>(
  props: AnimatedFlatListProps<T> & { ref?: React.Ref<FlatList<T>> }
) => React.ReactElement

export type TabFlatListProps<T> = Omit<FlatListProps<T>, "onScroll"> & {
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
}

const TabFlatListInner = <T,>(
  { contentContainerStyle, onScroll, ListHeaderComponent, ...props }: TabFlatListProps<T>,
  ref: React.Ref<FlatList<T>>
) => {
  const index = useTabIndex()
  const {
    scrollY,
    activeIndex,
    stickyEnabled,
    headerHeight,
    tabBarHeight,
    renderHeader,
    renderTabBar,
    registerRef,
    syncScrollY
  } = useCollapsible()

  const innerRef = useRef<FlatList<T>>(null)
  const isActive = activeIndex === index

  useEffect(() => {
    registerRef(index, innerRef.current)
    return () => registerRef(index, null)
  }, [index])

  useImperativeHandle(ref, () => innerRef.current!, [])

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y
      syncScrollY(index, y)
      onScroll?.(e)
    },
    [index, onScroll, syncScrollY]
  )

  const mergedHeader = useMemo(() => {
    if (stickyEnabled) return ListHeaderComponent
    const OriginalHeader =
      typeof ListHeaderComponent === "function" ? (
        <ListHeaderComponent />
      ) : (
        ListHeaderComponent ?? null
      )
    return (
      <View>
        {renderHeader?.()}
        {renderTabBar?.()}
        {OriginalHeader}
      </View>
    )
  }, [stickyEnabled, ListHeaderComponent, renderHeader, renderTabBar])

  const paddingTop = stickyEnabled ? headerHeight + tabBarHeight : 0
  const collapseRange = stickyEnabled ? headerHeight : 0
  const [containerHeight, setContainerHeight] = useState(0)

  const handleLayout = useCallback((e: LayoutChangeEvent) => {
    setContainerHeight(e.nativeEvent.layout.height)
  }, [])

  const minHeight = containerHeight > 0 ? containerHeight + collapseRange : 0

  return (
    <AnimatedFlatList
      ref={innerRef}
      {...props}
      onLayout={handleLayout}
      ListHeaderComponent={mergedHeader}
      contentContainerStyle={[
        paddingTop > 0 && { paddingTop },
        minHeight > 0 && { minHeight },
        contentContainerStyle
      ]}
      onScroll={
        isActive && stickyEnabled
          ? Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
              useNativeDriver: true,
              listener: handleScroll
            })
          : handleScroll
      }
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
    />
  )
}

export const TabFlatList = forwardRef(TabFlatListInner) as <T>(
  props: TabFlatListProps<T> & { ref?: React.Ref<FlatList<T>> }
) => React.ReactElement
