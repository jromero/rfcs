import {Command} from 'commander'
import log from 'loglevel'
import {
  extractIssuesFromBotComment,
  findFirstBotComment,
  generateIssueLineItem
} from '../bot-comment'
import {Octokit} from '@octokit/rest'
import {parseIssueReference} from '../parse'

export const listCommand = new Command('list')
  .description('list queued issues for a pull request')
  .option('--json', 'Output as JSON')
  .option('-t, --token <token>', 'GitHub Token')
  .requiredOption(
    '--pr <pr-reference>',
    'Pull request reference (format: "{owner}/{repo}#{number}'
  )
  .requiredOption('--bot <bot-username>', 'Username of the bot account')
  .action(async function (options) {
    const result = parseIssueReference(options.pr)
    if (result instanceof Error) {
      log.error(result.message)
      process.exit(2)
    }

    const {owner, repo, num: prNumber} = result
    const octokit = new Octokit({
      auth: options.token || process.env.GITHUB_TOKEN
    })
    const comment = await findFirstBotComment(
      octokit,
      owner,
      repo,
      prNumber,
      options.bot
    )
    if (!comment) {
      log.error('No bot comment found on PR!')
      process.exit(2)
    }

    const issues = extractIssuesFromBotComment(comment.body)
    if (options.json) {
      log.info(JSON.stringify(issues, null, 2))
    } else {
      if (issues.length === 0) {
        log.info('No issue found!')
        process.exit(0)
      }

      for (const issue of issues) {
        log.debug(issue)
        log.info(generateIssueLineItem(issue))
      }
    }
  })
