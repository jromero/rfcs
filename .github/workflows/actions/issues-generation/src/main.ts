import * as core from '@actions/core'
import * as github from '@actions/github'

function main() {
  try {
    core.info(`COMMENT: ${JSON.stringify(github.context.payload.comment)}`);
  } catch (error) {
    core.setFailed(error.message)
  }
}

main();

// function isCI(): boolean {
//   return process.env['CI'] === 'true'
// }
