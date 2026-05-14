import React from "react"
import { Animated, FlatList, ScrollView, SectionList, StyleProp, ViewStyle } from "react-native"

export interface TabBarProps {
  activeIndex: number
  onTabPress: (index: number) => void
}

export interface CollapsibleTabViewProps {
  children: React.ReactNode
  renderHeader: () => React.ReactNode
  estimatedHeaderHeight?: number
  estimatedTabBarHeight?: number
  stickyEnabled?: boolean
  stickyTop?: number
  renderTabBar: (props: TabBarProps) => React.ReactNode
  initialTabIndex?: number
  onTabChange?: (index: number) => void
  onScroll?: (scrollY: number) => void
  swipeEnabled?: boolean
  style?: StyleProp<ViewStyle>
}

export interface CollapsibleTabViewRef {
  scrollToTab: (index: number, animated?: boolean) => void
  getActiveIndex: () => number
}

export interface CollapsibleContextValue {
  scrollY: Animated.Value
  activeIndex: number
  stickyEnabled: boolean
  headerHeight: number
  tabBarHeight: number
  renderHeader?: () => React.ReactNode
  renderTabBar?: () => React.ReactNode
  registerRef: (index: number, ref: FlatList<any> | SectionList<any> | ScrollView | null) => void
  syncScrollY: (index: number, y: number) => void
}
