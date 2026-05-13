import { createContext, useContext } from "react"

import { CollapsibleContextValue } from "./types"

export const CollapsibleContext = createContext<CollapsibleContextValue | null>(null)

export const TabIndexContext = createContext<number>(0)

export const useCollapsible = () => {
  const ctx = useContext(CollapsibleContext)
  if (!ctx) {
    throw new Error("useCollapsible must be used within CollapsibleTabView")
  }
  return ctx
}

export const useTabIndex = () => useContext(TabIndexContext)
