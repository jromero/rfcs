const REGEX_ISSUE = `([^\\s]+)\\s+("([^\\"]+)"|'([^\\']+)')(.*)`

export interface IssueDetails {
  repo: string
  num?: number
  title: string
  labels: string[]
}

export interface Addition {
  op: 'addition'
  issue: IssueDetails
}

export interface Removal {
  op: 'removal'
  uid: string
}

export interface Creation {
  op: 'creation'
  uid: string
  num: number
}

export type Operation = Addition | Removal | Creation

/**
 * Extract Operations found in any content
 *
 * @param contents
 * @returns array of operations extracted
 */
export function parseUserComment(contents: string): Operation[] {
  const actions: Operation[] = []

  for (const addition of extractAdditions(contents)) {
    actions.push(addition)
  }

  for (const removals of parseRemovals(contents)) {
    actions.push(removals)
  }

  return actions
}

/**
 * Extract additions from any content
 *
 * @param contents
 * @returns array of additions
 */
function extractAdditions(contents: string): Addition[] {
  const issues: Addition[] = []

  let match
  const regex = /^\/queue-issue\s+(.*)$/gm
  while ((match = regex.exec(contents))) {
    const issue = parseIssue(match[1])
    if (issue) {
      issues.push({op: 'addition', issue})
    }
  }

  return issues
}

/**
 * Extract labels from any content
 *
 * @param contents
 * @returns array of labels
 */
export function extractLabels(contents: string): string[] {
  const labels: string[] = []

  let match
  const regex = /(\[([^\]]+)\])/g
  while ((match = regex.exec(contents))) {
    labels.push(match[2])
  }

  return labels
}

/**
 * Extract removals from any content
 *
 * @param contents
 * @returns array of removals found
 */
function parseRemovals(contents: string): Removal[] {
  const issues: Removal[] = []

  let match
  const regex = /^\/unqueue-issue\s+(\w+)/gm
  while ((match = regex.exec(contents))) {
    issues.push({
      op: 'removal',
      uid: match[1]
    })
  }

  return issues
}

/**
 * parse an individual issue
 *
 * @returns IssueDetails or undefined when not a match
 */
export function parseIssue(str: string): IssueDetails | undefined {
  const match = new RegExp(REGEX_ISSUE).exec(str)
  if (match && match.length >= 6) {
    // parse repo with potential issue reference
    let repo = match[1]
    let num: number | undefined = undefined
    const result = parseIssueReference(match[1])
    if (!(result instanceof Error)) {
      repo = `${result.owner}/${result.repo}`
      num = result.num
    }

    return {
      repo,
      title: match[3] || match[4],
      labels: extractLabels(match[5]),
      num
    }
  }

  return
}

export function parseIssueReference(
  ref: string
): {owner: string; repo: string; num: number} | Error {
  const match = /^([^\/]+)\/([^\/]+)#(\d+)$/.exec(ref)
  if (!match) {
    return Error(
      "Invalid pull request reference! Expected format '{owner}/{repo}#{pr_number}'."
    )
  }

  const [_, owner, repo, num] = match
  return {
    owner,
    repo,
    num: Number(num)
  }
}
