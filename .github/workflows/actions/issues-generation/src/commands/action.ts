import {Command} from '@oclif/command'
import {action} from '../action'

export default class Action extends Command {
  static description = `process GitHub Action events

This command processes the following GitHub Action events:

  * issue_comment.[created]
  * pull_request_review_comment.[created]
  * pull_request_target.[opened, reopened]
`

  async run(): Promise<void> {
    if (process.env.CI !== 'true') {
      this.error('Refusing to proceed running action in a non-CI environment!')
    }

    action()
  }
}
