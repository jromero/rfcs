import * as core from '@actions/core'
import * as github from '@actions/github'
import {
  generateBotComment,
  extractIssuesFromBotComment,
  findFirstBotComment
} from './bot-comment'
import {Operation, parseUserComment} from './parse'

export async function action(): Promise<void> {
  try {
    const payload = github.context.payload
    core.info(`PAYLOAD: ${JSON.stringify(payload, null, 2)}`)

    const {owner, repo} = github.context.repo
    const botUsername = core.getInput('bot-username', {required: true})
    const githubToken = core.getInput('github-token', {required: true})
    const octokit = github.getOctokit(githubToken)
    const issueNumber = (payload.issue || payload.pull_request)!.number
    const username = payload.sender?.login
    if (username === botUsername) {
      core.info(`Not processing comments from bot account '${botUsername}'.`)
      return
    }

    let operations: Operation[] = []
    if (payload.comment) {
      core.info(`> Parsing user comment for operations...`)
      operations = parseUserComment(payload.comment.body)
    }

    const botComment = await findFirstBotComment(
      octokit,
      owner,
      repo,
      issueNumber,
      botUsername
    )
    const existingQueuedIssues = extractIssuesFromBotComment(
      (botComment && botComment.body) || ''
    )

    core.info(`> Generating (updated) bot comment...`)
    const [updatedComment, errors] = generateBotComment(
      existingQueuedIssues,
      operations
    )

    core.info(`> Checking for errors...`)
    if (errors.length) {
      core.info(`Posting errors: ${errors.join(',')}`)
      const errorBody = `@${username}, there was a problem:
${errors.map(e => `  * ${e}`).join('\n')}`
      if (payload.pull_request && payload.comment) {
        await octokit.rest.pulls.createReplyForReviewComment({
          owner,
          repo,
          pull_number: issueNumber,
          comment_id: payload.comment.id,
          body: errorBody
        })
      } else {
        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number: issueNumber,
          body: errorBody
        })
      }
    }

    core.info(`> Posting bot comment...`)
    if (botComment && botComment.body !== updatedComment) {
      core.info(`Updating bot comment:\n${updatedComment}`)
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: botComment.id,
        body: updatedComment
      })
    } else {
      core.info(`> Posting bot comment:${updatedComment}\n`)
      await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body: updatedComment
      })
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}
