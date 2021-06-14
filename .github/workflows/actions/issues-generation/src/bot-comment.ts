import {GitHub} from '@actions/github/lib/utils'
import {Octokit as OctokitRest} from '@octokit/rest'
import hash from 'hash.js'
import {IssueDetails, Operation, parseIssue} from './parse'

const TEMPLATE = `Maintainers,

As you review this RFC please queue up issues to be created using the following commands:

    queue-issue <repo> "<title>" [labels]...
    unqueue-issue <uid>

### Issues

__ISSUES__
`

const NONE = '__(none)__'

export interface QueuedIssue extends IssueDetails {
  uid: string
}

export function generateBotComment(
  issues: QueuedIssue[],
  amendments: Operation[]
): {updatedComment: string; errors: string[]} {
  const errors: string[] = []
  for (const amendment of amendments) {
    switch (amendment.op) {
      case 'addition':
        issues.push({
          uid: generateHash(amendment.issue),
          ...amendment.issue
        })
        break
      case 'removal':
        const issue = issues.find(issue => issue.uid == amendment.uid)
        if (!issue) {
          errors.push(`Issue with uid '${amendment.uid}' not found!`)
          continue
        }

        if (issue.num) {
          errors.push(
            `Cannot unqueue '${amendment.uid}' since it was already created!`
          )
          continue
        }

        issues = issues.filter(issue => issue.uid != amendment.uid)
        break
    }
  }

  let issuesOutput = NONE
  if (issues.length > 0) {
    issuesOutput = ''
    for (const issue of issues) {
      let labels = ''
      if (issue.labels.length > 0) {
        labels = ` [${issue.labels.join('][')}]`
      }

      let status = issue.num ? '✅' : '⬜️'
      let repoRef = issue.num ? `${issue.repo}#${issue.num}` : issue.repo

      issuesOutput += `  * ${status} ${issue.uid} - ${repoRef} "${issue.title}"${labels}\n`
    }
  }

  return {
    updatedComment: TEMPLATE.replace('__ISSUES__', issuesOutput.trimEnd()),
    errors
  }
}

export function extractIssuesFromBotComment(comment: string): QueuedIssue[] {
  const issues = new Array<QueuedIssue>()

  let match
  const regex = new RegExp(`\\*\\s+(✅|⬜️)\\s+(.*)\\s+-\\s+(.*)$`, 'mg')
  while ((match = regex.exec(comment))) {
    const issue = parseIssue(match[3])
    if (issue) {
      issues.push({
        uid: match[2],
        ...issue
      })
    }
  }

  return issues
}

function generateHash(issue: IssueDetails): string {
  let sha = hash.sha1().update(issue.repo).update(issue.title)

  for (const label of issue.labels) {
    sha = sha.update(label)
  }

  return sha.digest('hex').substring(0, 6)
}

interface BotComment {
  id: number
  body: string
  html_url: string
}

export async function findFirstBotComment(
  octokit: InstanceType<typeof GitHub> | OctokitRest,
  owner: string,
  repo: string,
  issueNumber: number,
  botUsername: string
): Promise<BotComment | void> {
  const comments = await octokit.paginate(octokit.rest.issues.listComments, {
    owner,
    repo,
    issue_number: issueNumber
  })

  const botComment = comments.find(c => c.user?.login === botUsername)
  if (!botComment) {
    return
  }

  return {
    id: botComment.id,
    body: botComment.body || '',
    html_url: botComment.html_url
  }
}
