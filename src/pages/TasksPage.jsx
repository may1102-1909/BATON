import React, { useState } from 'react'
import { Brand } from '../components/Brand'
import { Icon } from '../components/Icon'
import { Button } from '../components/Button'
import { Link } from '../router'

const C = {
  bg: '#0c0d0e',
  surface: '#17181c',
  line: '#27282d',
  text: '#f4f4f5',
  muted: '#999ba5',
  green: '#34d399'
}

const sampleTasks = [
  {
    id: 'TASK-42',
    title: 'Migrate core authentication adapter to Supabase Auth',
    category: 'Architecture',
    status: 'Verified',
    statusColor: '#34d399',
    assignee: 'Rahul S.',
    note: 'Approved in PR #42. Production JWT limits resolved.'
  },
  {
    id: 'TASK-18',
    title: 'Implement retry webhook handler with signature verification',
    category: 'Billing & Payments',
    status: 'Inferred',
    statusColor: '#e8b86d',
    assignee: 'Rahul S.',
    note: 'Extracted from unmerged branch feat/pay. Needs unit tests.'
  },
  {
    id: 'TASK-07',
    title: 'Resolve deployment timeline discrepancy: Nov 10 vs Nov 15',
    category: 'Release Planning',
    status: 'Conflicting',
    statusColor: '#ef8585',
    assignee: 'Priya M.',
    note: 'Both dates preserved in handover note for lead resolution.'
  },
  {
    id: 'TASK-89',
    title: 'Quarantine production database seed keys and connection strings',
    category: 'Security',
    status: 'Verified',
    statusColor: '#34d399',
    assignee: 'Automated Daemon',
    note: '3 secret tokens isolated and redacted with zero leaks.'
  }
]

export function TasksPage() {
  const [filter, setFilter] = useState('All')

  const filteredTasks = sampleTasks.filter(
    (t) => filter === 'All' || t.status === filter
  )

  return (
    <div
      className="relative w-full min-h-screen text-[#f4f4f5] selection:bg-[#34d399]/30 selection:text-white"
      style={{ background: C.bg }}
    >
      {/* Top Navigation */}
      <header className="bt-nav sticky top-0 z-50 border-b border-[#27282d] bg-[#0c0d0ee6] backdrop-blur-md">
        <div className="bt-shell h-[76px] flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Link to="/" className="cursor-pointer no-underline flex items-center">
              <Brand size={24} />
            </Link>
            <span className="text-[#45484f]">/</span>
            <span className="text-[12px] font-mono font-medium text-[#34d399] tracking-wider uppercase">
              Tasks & Claims
            </span>
          </div>

          <nav className="bt-navlinks hidden md:flex items-center gap-6">
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#999ba5] hover:text-[#34d399] transition-colors no-underline"
            >
              <Icon name="back" size={13} />
              3D Paper
            </Link>
            <Link
              to="/dashboard"
              className="text-[12px] font-medium text-[#999ba5] hover:text-[#34d399] transition-colors no-underline"
            >
              Dashboard
            </Link>
            <Link
              to="/classic"
              className="text-[12px] font-medium text-[#999ba5] hover:text-[#34d399] transition-colors no-underline"
            >
              Classic App
            </Link>
            <Link
              to="/review"
              className="text-[12px] font-medium text-[#999ba5] hover:text-[#34d399] transition-colors no-underline"
            >
              Review
            </Link>
            <Link
              to="/tasks"
              className="text-[12px] font-semibold text-[#34d399] no-underline"
            >
              Tasks
            </Link>
          </nav>

          <div>
            <Link to="/review" className="no-underline">
              <Button primary style={{ padding: '8px 16px', fontSize: 12 }}>
                Inspect Handover
                <Icon size={13} />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="py-12">
        <div className="bt-shell space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="text-[10px] font-mono tracking-widest uppercase text-[#34d399]">
                REASONING INVENTORY
              </span>
              <h1 className="text-3xl font-bold mt-1 mb-2 text-[#f4f4f5]">
                Tasks & Grounded Claims
              </h1>
              <p className="text-[13px] text-[#999ba5] m-0">
                Track code decisions, unmerged PR branches, and conflicting requirements.
              </p>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#14161a] border border-[#27282d]">
              {['All', 'Verified', 'Inferred', 'Conflicting'].map((st) => (
                <button
                  key={st}
                  onClick={() => setFilter(st)}
                  className={`px-3 py-1 text-[11px] rounded transition-colors cursor-pointer border-0 font-medium ${
                    filter === st
                      ? 'bg-[#34d399] text-[#052e22]'
                      : 'bg-transparent text-[#999ba5] hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Task Grid */}
          <div className="grid grid-cols-1 gap-3">
            {filteredTasks.map((task) => (
              <div
                key={task.id}
                className="p-5 rounded-xl border border-[#27282d] bg-[#121316] hover:border-[#34d399]/30 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-mono text-[#71747d]">
                      {task.id}
                    </span>
                    <span
                      className="text-[10px] font-mono font-medium px-2 py-0.5 rounded border"
                      style={{
                        color: task.statusColor,
                        borderColor: `${task.statusColor}33`,
                        background: `${task.statusColor}12`
                      }}
                    >
                      {task.status}
                    </span>
                    <span className="text-[11px] text-[#868a94] font-medium">
                      {task.category}
                    </span>
                  </div>
                  <h3 className="text-[15px] font-semibold text-[#f4f4f5] m-0">
                    {task.title}
                  </h3>
                  <p className="text-[12px] text-[#999ba5] m-0">
                    {task.note}
                  </p>
                </div>

                <div className="flex sm:flex-col items-start sm:items-end gap-1 flex-shrink-0">
                  <span className="text-[11px] font-mono text-[#999ba5]">
                    Assignee: <strong className="text-white">{task.assignee}</strong>
                  </span>
                  <Link
                    to="/review"
                    className="text-[11px] text-[#34d399] hover:underline no-underline mt-1"
                  >
                    View Diff →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}

export default TasksPage

