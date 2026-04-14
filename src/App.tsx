import { useState, useCallback, useRef } from 'react'
import { PolicyProvider } from '@/state/context'
import { VisualCanvas } from '@/components/canvas/VisualCanvas'
import { DraggableDivider } from '@/components/ui/DraggableDivider'
import { YamlPanel } from '@/components/yaml/YamlPanel'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { PolicyPageBar, type PolicyPage } from '@/components/ui/PolicyPageBar'
import { initialState } from '@/state/reducer'
import type { PolicyState } from '@/types/policy'
import { generateId } from '@/lib/utils'

interface PageData {
  page: PolicyPage;
  state: PolicyState;
}

function createPage(label: string): PageData {
  return {
    page: { id: generateId(), label },
    state: { ...initialState, policyName: label.toLowerCase().replace(/\s+/g, '-') },
  };
}

function App() {
  const [splitPercent, setSplitPercent] = useState(60)
  const [pages, setPages] = useState<PageData[]>(() => [createPage('Policy 1')])
  const [activeId, setActiveId] = useState(() => pages[0].page.id)
  const stateRef = useRef<Record<string, PolicyState>>({})

  const activePage = pages.find(p => p.page.id === activeId) ?? pages[0]

  const handleStateChange = useCallback((state: PolicyState) => {
    stateRef.current[activeId] = state;
  }, [activeId])

  const handleAddPage = useCallback(() => {
    const num = pages.length + 1
    const newPage = createPage(`Policy ${num}`)
    // Save current page state before switching
    setPages(prev => {
      const updated = prev.map(p =>
        p.page.id === activeId && stateRef.current[activeId]
          ? { ...p, state: stateRef.current[activeId] }
          : p
      )
      return [...updated, newPage]
    })
    setActiveId(newPage.page.id)
  }, [pages.length, activeId])

  const handleRemovePage = useCallback((id: string) => {
    setPages(prev => {
      const filtered = prev.filter(p => p.page.id !== id)
      if (filtered.length === 0) return prev
      return filtered
    })
    if (activeId === id) {
      setPages(prev => {
        const idx = prev.findIndex(p => p.page.id === id)
        const remaining = prev.filter(p => p.page.id !== id)
        if (remaining.length > 0) {
          const newIdx = Math.min(idx, remaining.length - 1)
          setActiveId(remaining[newIdx].page.id)
        }
        return remaining
      })
    }
  }, [activeId])

  const handleSelectPage = useCallback((id: string) => {
    // Save current page state before switching
    setPages(prev => prev.map(p =>
      p.page.id === activeId && stateRef.current[activeId]
        ? { ...p, state: stateRef.current[activeId] }
        : p
    ))
    setActiveId(id)
  }, [activeId])

  const handleRenamePage = useCallback((id: string, label: string) => {
    setPages(prev => prev.map(p =>
      p.page.id === id ? { ...p, page: { ...p.page, label } } : p
    ))
  }, [])

  return (
    <div className="flex flex-col h-screen">
      {/* Page tabs */}
      <div className="flex items-center justify-between bg-surface border-b border-divider">
        <PolicyPageBar
          pages={pages.map(p => p.page)}
          activeId={activeId}
          onSelect={handleSelectPage}
          onAdd={handleAddPage}
          onRemove={handleRemovePage}
          onRename={handleRenamePage}
        />
        <div className="pr-2">
          <ThemeToggle />
        </div>
      </div>

      {/* Main content — keyed by active page to force remount */}
      <PolicyProvider
        key={activeId}
        initial={activePage.state}
        onStateChange={handleStateChange}
      >
        <div className="flex flex-col flex-1 min-h-0">
          {/* Visual Canvas */}
          <div
            className="bg-canvas overflow-auto relative"
            style={{ height: `${splitPercent}%` }}
          >
            <VisualCanvas />
          </div>

          {/* Draggable Divider */}
          <DraggableDivider onResize={setSplitPercent} />

          {/* YAML Panel */}
          <div
            className="bg-yaml-bg overflow-auto"
            style={{ height: `${100 - splitPercent}%` }}
          >
            <YamlPanel />
          </div>
        </div>
      </PolicyProvider>
    </div>
  )
}

export default App
