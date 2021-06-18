import {Command} from 'commander'
import {actionCommand} from './action'
import {listCommand} from './list'
import log from 'loglevel'
import {createCommand} from './create'

log.setLevel(process.env.DEBUG ? 'debug' : 'info')

new Command()
  .addCommand(actionCommand, {isDefault: true})
  .addCommand(listCommand)
  .addCommand(createCommand)
  .parse()
