import * as core from '@actions/core'
import * as github from '@actions/github'
import {updateBotComment} from './bot-comment'
import {parseUserComment} from './parse'

async function main(): Promise<void> {
  try {
    const payload = github.context.payload
    core.info(`PAYLOAD: ${JSON.stringify(payload, null, 2)}`)

    if (!payload.comment) {
      throw Error('no comment found in payload')
    }

    const {owner, repo} = github.context.repo
    const botUsername = core.getInput('bot-username', {required: true})
    const githubToken = core.getInput('github-token', {required: true})
    const octokit = github.getOctokit(githubToken)
    const username = payload.comment.user.login
    const issue_number = (payload.issue || payload.pull_request)!.number
    const operations = parseUserComment(payload.comment.body)

    // find possibly existing bot comment
    const botComment = (
      await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number,
        per_page: 100
      })
    ).data.find(c => c.user?.login === botUsername)

    // generate (updated) bot comment
    const {updatedComment, errors} = updateBotComment(
      botComment?.body || '',
      operations
    )

    // comment or reply errors
    if (errors.length) {
      const errorBody = `@${username}, there was a problem:
${errors.map(e => `  * ${e}`).join('\n')}`
      if (payload.pull_request) {
        await octokit.rest.pulls.createReplyForReviewComment({
          owner,
          repo,
          pull_number: issue_number,
          comment_id: payload.comment.id,
          body: errorBody
        })
      } else {
        await octokit.rest.issues.createComment({
          owner,
          repo,
          issue_number,
          body: errorBody
        })
      }
    }

    // post/update bot comment
    if (botComment && botComment.body !== updatedComment) {
      core.info(`Updating bot comment:\n${updatedComment}`)
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: botComment.id,
        body: updatedComment
      })
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
