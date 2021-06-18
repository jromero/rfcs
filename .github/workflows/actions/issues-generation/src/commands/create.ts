import {
  extractIssuesFromBotComment,
  findFirstBotComment,
  generateBotComment,
  QueuedIssue
} from '../bot-comment'
import {Octokit} from '@octokit/rest'
import {RequestError} from '@octokit/request-error'
import {parseIssueReference} from '../parse'
import {Command} from 'commander'
import log from 'loglevel'

const TOKEN_REQUIREMENT = `This call requires a GitHub token. It may be provided via the '--token' flag or 'GITHUB_TOKEN' environment variable.`

export const createCommand = new Command('create')
  .description('create queued issues for a pull request')
  .option('--json', 'Output as JSON')
  .option('-t, --token <token>', 'GitHub Token')
  .option('--prepend <value>', 'Prepend value to title')
  .requiredOption(
    '--pr <pr-reference>',
    'Pull request reference (format: "{owner}/{repo}#{number}'
  )
  .requiredOption('--bot <bot-username>', 'Username of the bot account')
  .addHelpText(
    'after',
    `
NOTE: ${TOKEN_REQUIREMENT}
`
  )
  .action(async function (options) {
    const parseResult = parseIssueReference(options.pr)
    if (parseResult instanceof Error) {
      log.error(parseResult.message)
      process.exit(2)
    }
    const {owner, repo, num: prNumber} = parseResult
    const githubToken = options.token || process.env.GITHUB_TOKEN
    if (!githubToken) {
      log.error(TOKEN_REQUIREMENT)
      process.exit(2)
    }
    const octokit = new Octokit({auth: githubToken})
    const botComment = await findFirstBotComment(
      octokit,
      owner,
      repo,
      prNumber,
      options.bot
    )
    if (!botComment) {
      log.error('No bot comment found on PR!')
      process.exit(2)
    }
    let errors: Error[] = []
    const issues = extractIssuesFromBotComment(botComment.body)
    const [createdIssues, createErrors] = await createIssues(
      octokit,
      issues.filter(i => !i.num),
      options.prepend || '',
      `This issue have been automatically created from pull request ${options.pr}.`
    )
    errors = errors.concat(createErrors)
    log.debug(`${createdIssues.length} created issues...`)
    const [updatedComment, updateErrors] = generateBotComment(
      issues,
      createdIssues.map(({queued, created}) => {
        return {
          op: 'creation',
          uid: queued.uid,
          num: created.number
        }
      })
    )
    errors = errors.concat(updateErrors)
    log.debug(`Updated Comment:\n${updatedComment}`)
    if (botComment && botComment.body !== updatedComment) {
      try {
        await octokit.rest.issues.updateComment({
          owner,
          repo,
          comment_id: botComment.id,
          body: updatedComment
        })
      } catch (error) {
        errors.push(error)
      }
    }
    if (options.json) {
      log.log(JSON.stringify(createdIssues))
    } else {
      if (createdIssues.length === 0) {
        log.log('No issues created.')
      } else {
        for (const {queued, created} of createdIssues) {
          log.log(`  * ${queued.uid} → ${created.html_url}`)
        }
      }
    }
    if (errors.length > 0) {
      log.error(`Got the following errors:\n\n  * ${errors.join('\n  * ')}\n`)
      process.exit(2)
    }
  })

/**
 * A typed version of https://docs.github.com/en/rest/reference/issues#create-an-issue--code-samples
 */
interface CreatedIssue {
  number: number
  html_url: string
}

async function createIssues(
  octokit: Octokit,
  issuesToCreate: QueuedIssue[],
  titlePrepend: string,
  body: string
): Promise<[{queued: QueuedIssue; created: CreatedIssue}[], Error[]]> {
  const createdIssues: {queued: QueuedIssue; created: CreatedIssue}[] = []
  const errors: Error[] = []
  for (const issue of issuesToCreate.filter(i => !i.num)) {
    const [targetOwner, targetRepo] = issue.repo.split('/')
    try {
      const result = await octokit.rest.issues.create({
        owner: targetOwner,
        repo: targetRepo,
        title: titlePrepend + issue.title,
        labels: issue.labels,
        body
      })

      createdIssues.push({
        queued: issue,
        created: result.data
      })
    } catch (error) {
      if (error instanceof RequestError) {
        errors.push(
          Error(
            `creating issue ${issue.uid}: response=[status=${error.status},msg=${error.message}], request=[method=${error.request.method},url=${error.request.url}]`
          )
        )
      } else {
        errors.push(error)
      }
    }
  }

  return [createdIssues, errors]
}
