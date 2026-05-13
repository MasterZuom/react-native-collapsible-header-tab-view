import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react"
import {
  Animated,
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  ScrollViewProps
} from "react-native"

import { useCollapsible, useTabIndex } from "./context"

export type TabScrollViewProps = Omit<ScrollViewProps, "onScroll"> & {
  onScroll?: (e: NativeSyntheticEvent<NativeScrollEvent>) => void
}

const TabScrollView = forwardRef<ScrollView, TabScrollViewProps>(
  ({ contentContainerStyle, onScroll, children, ...props }, ref) => {
    const index = useTabIndex()
    const { scrollY, activeIndex, headerHeight, tabBarHeight, registerRef, syncScrollY } =
      useCollapsible()

    const innerRef = useRef<ScrollView>(null)
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

    const paddingTop = headerHeight + tabBarHeight
    const collapseRange = headerHeight
    const [containerHeight, setContainerHeight] = useState(0)

    const handleLayout = useCallback((e: LayoutChangeEvent) => {
      setContainerHeight(e.nativeEvent.layout.height)
    }, [])

    const minHeight = containerHeight > 0 ? containerHeight + collapseRange : 0

    return (
      <Animated.ScrollView
        ref={innerRef}
        {...props}
        onLayout={handleLayout}
        contentContainerStyle={[
          { paddingTop },
          minHeight > 0 && { minHeight },
          contentContainerStyle
        ]}
        onScroll={
          isActive
            ? Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
                useNativeDriver: true,
                listener: handleScroll
              })
            : handleScroll
        }
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </Animated.ScrollView>
    )
  }
)

export { TabScrollView }
