// Demo export: one Markdown document (also the source of the PDF) built at download time from the approved
// handover and whatever commits, pull requests and records are in the workspace right now.
import { analyzeWorkspace } from '../../server/demoInsights.js'

const SECTION_TITLES = {
  decisions: 'Key decisions',
  unfinished_work: 'Unfinished work',
  risks: 'Risks',
  dependencies: 'Dependencies',
  next_actions: 'Next actions'
}

const oneLine = value => String(value ?? '').replace(/\s+/g, ' ').trim()
const day = value => (value ? String(value).slice(0, 10) : 'unknown date')
const shortSha = source => String(source?.metadata?.sha ?? '').slice(0, 7)

function evidenceLabel(source, nameOf) {
  const meta = source.metadata ?? {}
  const who = source.author_login ? ` by ${nameOf(source)}` : ''
  if (source.type === 'commit') return `Commit ${shortSha(source)}${who}, ${day(source.created_at)}: ${oneLine(String(source.content).split('\n')[0])}`
  if (source.type === 'pull_request') return `Pull request #${meta.number} (${meta.merged ? 'merged' : meta.state ?? 'state unknown'})${who}, ${day(source.created_at)}: ${oneLine(meta.title ?? source.content)}`
  if (source.type === 'branch') return `Branch ${meta.name}: ${meta.ahead_by} ahead, ${meta.behind_by} behind ${meta.base}`
  if (source.type === 'interview') return `Exit interview, ${day(source.created_at)}: ${oneLine(source.content).slice(0, 180)}`
  return `${source.type.replace(/_/g, ' ')} record, ${day(source.created_at)}: ${oneLine(meta.decision ?? meta.problem ?? source.content).slice(0, 180)}`
}

export function buildHandoverMarkdown({ detail, workspace, memberLabel, orgName, repositoryName, now = new Date() }) {
  const handover = detail.handover
  const analysis = analyzeWorkspace(workspace)
  const nameOf = analysis.nameOf
  const leaver = memberLabel(handover.leaver_id)
  const incoming = memberLabel(handover.incoming_id)
  const cited = new Map((detail.sources ?? []).map(source => [source.id, source]))
  const refs = []
  const ref = id => {
    if (!cited.has(id)) return ''
    if (!refs.includes(id)) refs.push(id)
    return `[${refs.indexOf(id) + 1}]`
  }
  const cite = ids => (ids ?? []).map(ref).filter(Boolean).join('')
  const claims = (detail.claims ?? []).filter(claim => claim.status !== 'rejected' && claim.confidence !== 'missing')
  const questions = (detail.questions ?? []).filter(question => !question.asked_by)
  const conflicts = detail.conflicts ?? []
  const out = []
  const push = (...lines) => out.push(...lines)

  push(`# Engineering handover: ${leaver} to ${incoming}`, '')
  push(`**Repository:** ${repositoryName} · **Team:** ${orgName}`)
  push(`**Status:** ${handover.status === 'approved' ? `approved by ${memberLabel(handover.approved_by)} on ${day(handover.approved_at)}` : handover.status}${handover.acknowledged_at ? `, acknowledged by ${incoming} on ${day(handover.acknowledged_at)}` : ''} · version ${handover.approved_version ?? handover.version ?? 1}`)
  push(`**Built from:** ${analysis.commits.length} commits, ${analysis.pulls.length} pull requests, ${analysis.branches.length} branches, ${analysis.decisions.length} decisions and ${analysis.blockers.length} open blockers in this workspace (${day(analysis.period.from)} to ${day(analysis.period.to)}), generated ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC`)
  push('', '> Every statement cites the record it came from; numbers in brackets refer to the Evidence list at the end. Records marked [SAMPLE] are planted demo examples, not repository history.', '')

  push('## 1. Summary', '')
  const top = analysis.modules.slice(0, 3).map(m => `${m.name} (${m.changes} commits)`).join(', ')
  push(`- ${incoming} takes over from ${leaver}. The most active areas are ${top || 'not yet known (sync the repository)'}.`)
  push(`- Contributors: ${analysis.people.map(p => `${p.name} (${p.commits} commits, ${p.pulls} pull requests)`).join('; ') || 'none recorded'}.`)
  const plural = (count, word) => `${count} ${word}${count === 1 ? '' : /(ch|sh|s)$/.test(word) ? 'es' : 's'}`
  push(`- Open work: ${plural(analysis.openPulls.length, 'open pull request')}, ${plural(analysis.branchesAhead.length, 'branch')} ahead of their base, ${plural(analysis.blockers.length, 'open blocker')}, ${plural(analysis.openTasks.length, 'open task')}.`)
  push(`- Knowledge risk: ${analysis.singleOwner.length} areas have a single contributor${analysis.singleOwner.length ? ` (${analysis.singleOwner.slice(0, 5).map(m => `${m.name}: ${m.people[0].name}`).join('; ')})` : ''}.`)
  push(`- Conflicts: ${conflicts.length} found, ${conflicts.filter(c => c.resolved).length} resolved by an admin.`, '')

  push('## 2. What you are inheriting', '')
  for (const module of analysis.modules.slice(0, 10)) {
    push(`- **${module.name}**: ${module.changes} commits, last ${day(module.last)}, by ${module.people.map(p => `${p.name} (${p.count})`).join(', ')}. Most changed: ${module.files.slice(0, 3).join(', ')}.`)
  }
  if (!analysis.modules.length) push('- No commits with file details yet. Sync the repository from the GitHub tab.')
  push('')

  let section = 3
  for (const [key, title] of Object.entries(SECTION_TITLES)) {
    const items = claims.filter(claim => claim.section === key && !claim.conflict)
    if (key === 'dependencies') {
      push(`## ${section++}. ${title}`, '')
      for (const claim of items) push(`- ${oneLine(claim.text)} ${cite(claim.source_ids)}`.trim())
      for (const dep of analysis.dependencies) push(`- **${dep.name}**: ${dep.role}. ${dep.changes} commits touch it (last ${day(dep.last)}), for example ${dep.files.slice(0, 2).join(', ')}.`)
      if (!items.length && !analysis.dependencies.length) push('- No external services appear in the synced changes.')
      push('')
      continue
    }
    if (!items.length && key !== 'unfinished_work') continue
    push(`## ${section++}. ${title}`, '')
    const seen = new Set()
    for (const claim of items) {
      const text = oneLine(claim.text)
      if (seen.has(text)) continue
      seen.add(text)
      push(`- ${text} ${cite(claim.source_ids)}`.trim())
    }
    if (key === 'unfinished_work') {
      for (const pr of analysis.openPulls) push(`- Open pull request #${pr.metadata?.number}: ${oneLine(pr.metadata?.title)} (${nameOf(pr)}).`)
      for (const branch of analysis.branchesAhead) push(`- Branch ${branch.metadata?.name} is ${branch.metadata?.ahead_by} commits ahead of ${branch.metadata?.base}.`)
      for (const task of analysis.openTasks) push(`- Task: ${oneLine(task.title)}, assigned to ${memberLabel(task.assignee_id)}${task.due_at ? `, due ${day(task.due_at)}` : ''}.`)
      if (!items.length && !analysis.openPulls.length && !analysis.branchesAhead.length && !analysis.openTasks.length) push('- Nothing open: every pull request is merged or closed and no branch is ahead.')
    }
    if (key === 'risks') {
      for (const module of analysis.singleOwner.slice(0, 6)) push(`- Bus factor 1: only ${module.people[0].name} has changed ${module.name} (${module.changes} commits).`)
    }
    push('')
  }

  if (conflicts.length) {
    push(`## ${section++}. Conflicts and how they were settled`, '')
    for (const conflict of conflicts) {
      push(`- ${oneLine(conflict.summary || conflict.subject)} ${cite((conflict.sides ?? []).map(side => side.source_id))}`.trim())
      const chosen = (conflict.sides ?? []).find(side => side.source_id === conflict.chosen_source_id)
      push(conflict.resolved
        ? `  - Resolved by ${memberLabel(conflict.resolved_by)}${chosen ? ` in favour of the ${chosen.label} (${chosen.date})` : ''}: ${oneLine(conflict.resolution)}`
        : '  - Not resolved yet; an admin must decide before approval.')
    }
    push('')
  }

  if (questions.length) {
    push(`## ${section++}. Exit interview with ${leaver}`, '')
    for (const question of questions) {
      push(`### ${oneLine(question.question_text)}`, '')
      push(`*Risk ${question.risk_label ?? question.risk}${question.risk_score ? ` (score ${question.risk_score})` : ''}${(question.risk_reasons ?? []).length ? `: ${question.risk_reasons.join('; ')}` : ''}*`, '')
      push(question.answer ? oneLine(question.answer) : question.status === 'skipped' ? 'Skipped by the leaver; treat this as an open gap.' : 'Not answered.', '')
    }
  }

  push(`## ${section++}. First week for ${incoming}`, '')
  const steps = []
  for (const blocker of analysis.blockers) steps.push(`Take ownership of the blocker "${oneLine(blocker.metadata?.problem ?? blocker.content)}"${blocker.metadata?.workaround_notes ? `; current workaround: ${oneLine(blocker.metadata.workaround_notes).replace(/\.$/, '')}` : ''}.`)
  if (analysis.migrations.length) steps.push(`Confirm the newest migration, ${analysis.migrations[analysis.migrations.length - 1]}, is applied in production.`)
  for (const module of analysis.singleOwner.slice(0, 3)) steps.push(`Pair with ${module.people[0].name} on ${module.name} (${module.files.slice(0, 2).join(', ')}) so it has a second maintainer.`)
  if (analysis.modules[0]) steps.push(`Read the latest changes in ${analysis.modules[0].name}, the most active area.`)
  steps.forEach((step, index) => push(`${index + 1}. ${step}`))
  push('')

  push(`## ${section++}. Recent activity`, '')
  for (const commit of analysis.realCommits.slice(0, 12)) push(`- ${day(commit.created_at)} \`${shortSha(commit)}\` ${oneLine(String(commit.content).split('\n')[0])} (${nameOf(commit)})`)
  push('')

  push('## Evidence', '')
  refs.forEach((id, index) => {
    const source = cited.get(id)
    push(`${index + 1}. ${evidenceLabel(source, nameOf)}${source.url || source.metadata?.url ? ` ${source.url || source.metadata.url}` : ''}`)
  })
  if (!refs.length) push('No cited records.')
  push('')
  return out.join('\n')
}
