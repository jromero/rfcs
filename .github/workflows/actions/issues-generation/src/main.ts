import * as core from '@actions/core'
import * as github from '@actions/github'
import {updateBotComment} from './bot-comment'
import {parseUserComment} from './parse'

async function main(): Promise<void> {
  try {
    core.info(`PAYLOAD: ${JSON.stringify(github.context.payload, null, 2)}`)

    if (!github.context.payload.comment) {
      throw Error('no comment found in payload')
    }

    const githubToken = core.getInput('github-token', {required: true})
    const octokit = github.getOctokit(githubToken)
    const comment = github.context.payload.comment
    // const username = comment.user.login;

    const issue_number = (github.context.payload.issue || github.context.payload.pull_request)?.number
    if (!issue_number) {
      throw Error("couldn't find issue/pr number")
    }

    const operations = parseUserComment(comment.body)
    if (operations.length) {
      core.info('No issue related comments found.')
      return
    }

    // TODO: Update bot comment if one exists.
    // TODO: If error, reply to user with error.
    const {updatedComment, errors} = updateBotComment('', operations)
    if (errors.length) {
      throw Error(`updating comment: ${errors.join(', ')}`)
    }

    const {owner, repo} = github.context.repo
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body: updatedComment
    })
  } catch (error) {
    core.setFailed(error.message)
  }
}

main()

// function isCI(): boolean {
//   return process.env['CI'] === 'true'
// }
