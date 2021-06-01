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

    const botUsername = core.getInput('bot-username', {required: true})
    const githubToken = core.getInput('github-token', {required: true})
    const octokit = github.getOctokit(githubToken)
    const comment = github.context.payload.comment
    // const username = comment.user.login;

    const issue_number = (
      github.context.payload.issue || github.context.payload.pull_request
    )?.number
    if (!issue_number) {
      throw Error("couldn't find issue/pr number")
    }

    // TODO: If error, reply to user with error.
    const {owner, repo} = github.context.repo
    const botComment = (
      await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number,
        per_page: 100
      })
    ).data.find(c => c.user?.login === botUsername)

    const operations = parseUserComment(comment.body)
    const {updatedComment, errors} = updateBotComment(
      botComment?.body || '',
      operations
    )
    if (errors.length) {
      throw Error(`updating comment: ${errors.join(', ')}`)
    }

    if (botComment) {
      if (botComment.body !== updatedComment) {
        core.info(`Updating bot comment:`)
        core.info(updatedComment)
        octokit.rest.issues.updateComment({
          owner,
          repo,
          comment_id: botComment.id,
          body: updatedComment
        })
      }
    } else {
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number,
        body: updatedComment
      })
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

main()

// function isCI(): boolean {
//   return process.env['CI'] === 'true'
// }
