import {Command, flags} from '@oclif/command'
import {extractIssuesFromBotComment, findFirstBotComment} from '../bot-comment'
import {Octokit} from '@octokit/rest'
import {parseIssueReference} from '../parse'

export default class List extends Command {
  static description = 'list queued issues for a pull request'

  static examples = [
    `$ issues-generation list --pr my/repo#1 --bot my-bot

  * asdfgh - myorg/myrepo "some title" [a-label][b-label]
  * qwerty - myorg/myrepo "some other title"
`,
    `$ issues-generation list --pr my/repo#1 --bot my-bot --json

[
  {
    "id": "asdfgh",
    "repo": "myorg/myrepo",
    "title": "some title",
    "labels": ["a-label", "b-label"]
  },
  {
    "id": "qwerty",
    "repo": "myorg/myrepo",
    "title": "some other title",
    "labels": []
  }
]
`,
    `$ GITHUB_TOKEN=token issues-generation list --pr my/repo#1 --bot my-bot

* asdfgh - myorg/myrepo "some title" [a-label][b-label]
* qwerty - myorg/myrepo "some other title"
`
  ]

  static flags = {
    help: flags.help({char: 'h'}),
    json: flags.boolean({description: 'output as json'}),
    token: flags.string({char: 't', description: 'github token'}),
    pr: flags.string({
      description:
        'pull request reference (format: "{owner}/{repo}#{pr_number}")',
      required: true
    }),
    bot: flags.string({description: 'bot username', required: true})
  }

  async run(): Promise<void> {
    const {flags: options} = this.parse(List)
    const result = parseIssueReference(options.pr)
    if (result instanceof Error) {
      this.error(result.message)
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
      this.error('No bot comment found on PR!')
    }

    const queuedIssues = extractIssuesFromBotComment(comment.body)
    if (options.json) {
      this.log(JSON.stringify(queuedIssues, null, 2))
    } else {
      if (queuedIssues.length === 0) {
        this.log('No issue found!')
        this.exit(0)
      }

      for (const issue of queuedIssues) {
        let labelsString = ''
        if (issue.labels.length > 0) {
          labelsString = ` [${issue.labels.join('][')}]`
        }

        this.log(
          ` * ${issue.uid} - ${issue.repo} ${issue.title}${labelsString}`
        )
      }
    }
  }
}
