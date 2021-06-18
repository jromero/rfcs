import {Command} from 'commander'
import {action} from '../action'
import log from 'loglevel'

export const actionCommand = new Command('action')
  .description('process GitHub Action events')
  .addHelpText(
    'after',
    `
Details:

This command processes the following GitHub Action events:

  * issue_comment.[created]
  * pull_request_review_comment.[created]
  * pull_request_target.[opened, reopened]
`
  )
  .action(function () {
    if (process.env.CI !== 'true') {
      log.error('Refusing to proceed running action in a non-CI environment!')
      process.exit(2)
    }

    action()
  })
