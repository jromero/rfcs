import {Command, flags} from '@oclif/command'
import {
  extractIssuesFromBotComment,
  findFirstBotComment,
  generateBotComment,
  QueuedIssue
} from '../bot-comment'
import {Octokit} from '@octokit/rest'
import {RequestError} from '@octokit/request-error'
import {parseIssueReference} from '../parse'

const TOKEN_REQUIREMENT = `This call requires a GitHub token. It may be provided via the '--token' flag or 'GITHUB_TOKEN' environment variable.`

export default class Create extends Command {
  static description = `create queued issues for a pull request

NOTE: ${TOKEN_REQUIREMENT}
`

  static examples = [
    `$ issues-generation create --pr my/repo#1 --bot my-bot

  * asdfgh → https://github.com/octocat/Hello-World/issues/1234
  * qwerty → https://github.com/octocat/Hello-World/issues/1235
`,
    `$ issues-generation create --pr my/repo#1 --bot my-bot --json

[
  {
    "queued": {
      "id": "asdfgh",
      "repo": "myorg/myrepo",
      "title": "some title",
      "labels": ["a-label", "b-label"]
    },
    "created": {
      "number": 1,
      "body": "...",
      "html_url": "...",
      ...
    }
  }
]
`
  ]

  static flags = {
    help: flags.help({char: 'h'}),
    json: flags.boolean({description: 'output as json'}),
    token: flags.string({char: 't', description: 'github token'}),
    prepend: flags.string({description: 'prepend value to title'}),
    pr: flags.string({
      description:
        'pull request reference (format: "{owner}/{repo}#{pr_number}")',
      required: true
    }),
    bot: flags.string({description: 'bot username', required: true})
  }

  async run(): Promise<void> {
    const {flags: options} = this.parse(Create)
    const parseResult = parseIssueReference(options.pr)
    if (parseResult instanceof Error) {
      this.error(parseResult.message)
    }
    const {owner, repo, num: prNumber} = parseResult

    const githubToken = options.token || process.env.GITHUB_TOKEN
    if (!githubToken) {
      this.error(TOKEN_REQUIREMENT)
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
      this.error('No bot comment found on PR!')
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

    this.debug(`${createdIssues.length} created issues...`)
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

    this.debug(`Updated Comment:\n${updatedComment}`)
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
      this.log(JSON.stringify(createdIssues))
    } else {
      if (createdIssues.length === 0) {
        this.log('No issues created.')
      } else {
        for (const {queued, created} of createdIssues) {
          this.log(`  * ${queued.uid} → ${created.html_url}`)
        }
      }
    }

    if (errors.length > 0) {
      this.error(`Got the following errors:\n\n  * ${errors.join('\n  * ')}\n`)
    }
  }
}

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
